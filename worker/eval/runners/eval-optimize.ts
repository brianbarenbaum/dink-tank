import { LangfuseClient, type Evaluator } from "@langfuse/client";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { applyPlannedFixes } from "../lib/applyFixes.ts";
import {
	attributeFailure,
	summarizeAttribution,
} from "../lib/attribution.ts";
import {
	applyDatasetLimit,
	parseEvalOptimizeConfig,
} from "../lib/evalOptimizeConfig.ts";
import { DEFAULT_EVAL_MAX_CONCURRENCY } from "../lib/evalDefaults.ts";
import {
	type ExternalScore,
	buildStopDecision,
	normalizeItemResults,
	summarizeLoop,
} from "../lib/evalResults.ts";
import { buildFixPlan } from "../lib/fixPlanner.ts";

interface ChatResponseBody {
	reply?: string;
	error?: string;
	message?: string;
}

interface JudgeResult {
	score: number;
	comment: string;
}

interface LangfuseScoreRecord {
	traceId?: string;
	name?: string;
	value?: unknown;
	comment?: unknown;
	source?: string;
}

interface FailureSnapshot {
	score: number;
	output: string;
}

const CLARIFICATION_OUTPUT_PATTERN =
	/\b(do you want|which division|should i use|i can help with that)\b/i;

const isClarificationLikeOutput = (output: string): boolean =>
	CLARIFICATION_OUTPUT_PATTERN.test(output);

const extractResponsesOutputText = (payload: unknown): string => {
	if (!payload || typeof payload !== "object") {
		return "";
	}
	const record = payload as Record<string, unknown>;
	if (typeof record.output_text === "string" && record.output_text.trim()) {
		return record.output_text.trim();
	}
	const output = record.output;
	if (!Array.isArray(output)) {
		return "";
	}
	const chunks: string[] = [];
	for (const item of output) {
		if (!item || typeof item !== "object") {
			continue;
		}
		const content = (item as Record<string, unknown>).content;
		if (!Array.isArray(content)) {
			continue;
		}
		for (const part of content) {
			if (!part || typeof part !== "object") {
				continue;
			}
			const text = (part as Record<string, unknown>).text;
			if (typeof text === "string" && text.trim()) {
				chunks.push(text.trim());
			}
		}
	}
	return chunks.join("\n").trim();
};

const loadDevVars = (): void => {
	const candidates = [resolve(process.cwd(), "worker/.dev.vars"), resolve(process.cwd(), ".env")];
	for (const filePath of candidates) {
		if (!existsSync(filePath)) {
			continue;
		}
		const raw = readFileSync(filePath, "utf8");
		for (const line of raw.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) {
				continue;
			}
			const eqIndex = trimmed.indexOf("=");
			if (eqIndex <= 0) {
				continue;
			}
			const key = trimmed.slice(0, eqIndex).trim();
			if (!key || process.env[key] !== undefined) {
				continue;
			}
			let value = trimmed.slice(eqIndex + 1).trim();
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			process.env[key] = value;
		}
	}
};

const requiredEnv = (name: string): string => {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
};

const parseOptionalInt = (value: string | undefined, fallback: number): number => {
	if (!value?.trim()) {
		return fallback;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toStringSafe = (value: unknown): string => {
	if (typeof value === "string") {
		return value;
	}
	if (value === null || value === undefined) {
		return "";
	}
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
};

const callChatApi = async (
	apiUrl: string,
	question: string,
	requestTimeoutMs: number,
): Promise<{ reply: string; status: number }> => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
	try {
		const response = await fetch(apiUrl, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				messages: [{ role: "user", content: question }],
			}),
			signal: controller.signal,
		});
		let body: ChatResponseBody = {};
		try {
			body = (await response.json()) as ChatResponseBody;
		} catch {
			// fall through
		}
		if (!response.ok) {
			const reason = body.message || body.error || `HTTP ${response.status}`;
			return {
				reply: `ERROR: ${reason}`,
				status: response.status,
			};
		}
		return {
			reply: typeof body.reply === "string" ? body.reply : "",
			status: response.status,
		};
	} finally {
		clearTimeout(timeout);
	}
};

const llmJudgeCorrectness = async (
	openAiApiKey: string,
	input: string,
	expectedOutput: string,
	output: string,
): Promise<JudgeResult> => {
	const response = await fetch("https://api.openai.com/v1/responses", {
		method: "POST",
		headers: {
			authorization: `Bearer ${openAiApiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: process.env.EVAL_JUDGE_MODEL?.trim() || "gpt-4.1-mini",
			input: [
				{
					role: "system",
					content:
						"You are an impartial evaluator. Score semantic correctness from 0.0 to 1.0 comparing assistant output to expected output. Return strict JSON: {\"score\": number, \"comment\": string}.",
				},
				{
					role: "user",
					content: `Question:\n${input}\n\nExpected Output:\n${expectedOutput}\n\nAssistant Output:\n${output}`,
				},
			],
			temperature: 0,
			max_output_tokens: 220,
			text: {
				format: {
					type: "json_schema",
					name: "judge_score",
					schema: {
						type: "object",
						additionalProperties: false,
						properties: {
							score: { type: "number", minimum: 0, maximum: 1 },
							comment: { type: "string" },
						},
						required: ["score", "comment"],
					},
				},
			},
		}),
	});

	if (!response.ok) {
		throw new Error(`Judge API failed with HTTP ${response.status}`);
	}
	const payload = (await response.json()) as unknown;
	const raw = extractResponsesOutputText(payload);
	if (!raw) {
		throw new Error("Judge API returned empty output text");
	}
	const parsed = JSON.parse(raw) as { score?: unknown; comment?: unknown };
	const score =
		typeof parsed.score === "number"
			? Math.max(0, Math.min(1, parsed.score))
			: 0;
	const comment =
		typeof parsed.comment === "string" && parsed.comment.trim().length > 0
			? parsed.comment.trim()
			: "No judge comment.";
	return { score, comment };
};

const heuristicJudge = (
	expectedOutput: string,
	output: string,
): JudgeResult => {
	const expected = expectedOutput.toLowerCase().trim();
	const actual = output.toLowerCase().trim();
	if (!expected) {
		return { score: 0.5, comment: "No expected output provided." };
	}
	if (actual.includes(expected)) {
		return { score: 1, comment: "Output includes expected answer text." };
	}
	const expectedTokens = new Set(expected.split(/\s+/).filter(Boolean));
	const outputTokens = new Set(actual.split(/\s+/).filter(Boolean));
	let overlap = 0;
	for (const token of expectedTokens) {
		if (outputTokens.has(token)) {
			overlap += 1;
		}
	}
	const score = expectedTokens.size > 0 ? overlap / expectedTokens.size : 0;
	return {
		score: Math.max(0, Math.min(1, score)),
		comment: "Heuristic token-overlap fallback score.",
	};
};

const sleep = async (ms: number): Promise<void> =>
	new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const fetchRunScoresByTrace = async (
	langfuse: LangfuseClient,
	datasetRunId: string,
): Promise<Map<string, ExternalScore[]>> => {
	const scoresByTraceId = new Map<string, ExternalScore[]>();
	const api = (langfuse as unknown as { api?: unknown }).api as
		| { scoreV2?: { get?: (request: Record<string, unknown>) => Promise<unknown> } }
		| undefined;
	if (!api?.scoreV2?.get) {
		return scoresByTraceId;
	}

	const maxAttempts = 4;
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const response = (await api.scoreV2.get({
				datasetRunId,
				limit: 500,
				name: "correctness",
			})) as {
				data?: LangfuseScoreRecord[];
			};
			const data = Array.isArray(response.data) ? response.data : [];
			for (const score of data) {
				const traceId =
					typeof score.traceId === "string" ? score.traceId : null;
				const name = typeof score.name === "string" ? score.name : null;
				if (!traceId || !name) {
					continue;
				}
				const existing = scoresByTraceId.get(traceId) ?? [];
				existing.push({
					traceId,
					name,
					value: score.value,
					comment: score.comment,
					source: score.source,
				});
				scoresByTraceId.set(traceId, existing);
			}
			const foundEval = [...scoresByTraceId.values()]
				.flat()
				.some((score) => (score.source ?? "").toLowerCase() === "eval");
			if (foundEval || attempt === maxAttempts) {
				return scoresByTraceId;
			}
		} catch {
			if (attempt === maxAttempts) {
				return scoresByTraceId;
			}
		}
		await sleep(1_200 * attempt);
	}

	return scoresByTraceId;
};

const run = async (): Promise<void> => {
	loadDevVars();

	const langfusePublicKey = requiredEnv("LANGFUSE_PUBLIC_KEY");
	const langfuseSecretKey = requiredEnv("LANGFUSE_SECRET_KEY");
	const langfuseBaseUrl =
		process.env.LANGFUSE_BASE_URL?.trim() || "https://cloud.langfuse.com";
	const langfuseEnvironment =
		process.env.LANGFUSE_TRACING_ENVIRONMENT?.trim() || "default";
	const optimizeConfig = parseEvalOptimizeConfig(process.env);

	const otelSdk = new NodeSDK({
		spanProcessors: [
			new LangfuseSpanProcessor({
				publicKey: langfusePublicKey,
				secretKey: langfuseSecretKey,
				baseUrl: langfuseBaseUrl,
				environment: langfuseEnvironment,
				exportMode: "immediate",
			}),
		],
	});
	await otelSdk.start();

	const langfuse = new LangfuseClient({
		publicKey: langfusePublicKey,
		secretKey: langfuseSecretKey,
		baseUrl: langfuseBaseUrl,
	});

	const datasetName = process.env.EVAL_DATASET_NAME?.trim() || "golden_30";
	const experimentName =
		process.env.EVAL_EXPERIMENT_NAME?.trim() || "golden_30_optimize";
	const runPrefix =
		process.env.EVAL_RUN_NAME?.trim() ||
		`golden-30-optimize-${new Date().toISOString().replace(/[:.]/g, "-")}`;
	const runDescription =
		process.env.EVAL_RUN_DESCRIPTION?.trim() ||
		"Bounded optimization loop for golden dataset.";
	const apiUrl =
		process.env.CHAT_EVAL_API_URL?.trim() || "http://127.0.0.1:8787/api/chat";
	const requestTimeoutMs = parseOptionalInt(
		process.env.EVAL_REQUEST_TIMEOUT_MS,
		60_000,
	);
	const expectedItemCount = parseOptionalInt(
		process.env.EVAL_EXPECTED_ITEM_COUNT,
		30,
	);
	const maxConcurrency = parseOptionalInt(
		process.env.EVAL_MAX_CONCURRENCY,
		DEFAULT_EVAL_MAX_CONCURRENCY,
	);
	const openAiApiKey = process.env.OPENAI_API_KEY?.trim();

	const artifactRoot = resolve(
		process.cwd(),
		`worker/eval/artifacts/${runPrefix.replace(/[^\w.-]+/g, "-")}`,
	);
	await mkdir(artifactRoot, { recursive: true });

	console.log(`Dataset: ${datasetName}`);
	console.log(`Experiment: ${experimentName}`);
	console.log(`Run prefix: ${runPrefix}`);
	console.log(`Chat API: ${apiUrl}`);
	console.log(`Max loops: ${optimizeConfig.maxLoops}`);
	console.log(
		`Dataset limit: ${optimizeConfig.datasetLimit ?? "all"} (EVAL_DATASET_LIMIT)`,
	);

	const dataset = await langfuse.dataset.get(datasetName);
	if (dataset.items.length !== expectedItemCount) {
		throw new Error(
			`Expected ${expectedItemCount} dataset items for "${datasetName}", found ${dataset.items.length}.`,
		);
	}

	const selectedDatasetItems = applyDatasetLimit(
		dataset.items,
		optimizeConfig.datasetLimit,
	);
	console.log(
		`Loaded ${selectedDatasetItems.length}/${dataset.items.length} dataset items for this optimization session.`,
	);

	const correctnessEvaluator: Evaluator = async ({
		input,
		expectedOutput,
		output,
	}) => {
		const inputText = toStringSafe(input);
		const expectedText = toStringSafe(expectedOutput);
		const outputText = toStringSafe(output);
		if (!expectedText) {
			return {
				name: "correctness",
				value: 0.5,
				comment: "Skipped: expected output missing.",
			};
		}

		try {
			if (openAiApiKey) {
				const judged = await llmJudgeCorrectness(
					openAiApiKey,
					inputText,
					expectedText,
					outputText,
				);
				return {
					name: "correctness",
					value: judged.score,
					comment: judged.comment,
				};
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const fallback = heuristicJudge(expectedText, outputText);
			return {
				name: "correctness",
				value: fallback.score,
				comment: `Judge fallback used after error: ${message}`,
			};
		}

		const fallback = heuristicJudge(expectedText, outputText);
		return {
			name: "correctness",
			value: fallback.score,
			comment: "OPENAI_API_KEY missing; heuristic fallback evaluator used.",
		};
	};

	let previousAverageScore: number | null = null;
	let consecutiveLowDeltaLoops = 0;
	const loopSummaries: Array<Record<string, unknown>> = [];
	let previousFailureByInput: Map<string, FailureSnapshot> = new Map();

	try {
		for (let loopIndex = 1; loopIndex <= optimizeConfig.maxLoops; loopIndex += 1) {
			const loopRunName = `${runPrefix}-loop-${loopIndex}`;
			console.log(`\n=== Loop ${loopIndex}/${optimizeConfig.maxLoops} ===`);

			const result = await langfuse.experiment.run({
				name: experimentName,
				runName: loopRunName,
				description: runDescription,
				data: selectedDatasetItems,
				maxConcurrency,
				metadata: {
					apiUrl,
					requestTimeoutMs,
					loopIndex,
					maxLoops: optimizeConfig.maxLoops,
					datasetLimit: optimizeConfig.datasetLimit,
					datasetItemCount: selectedDatasetItems.length,
					script: "worker/eval/runners/eval-optimize.ts",
					judgeModel: process.env.EVAL_JUDGE_MODEL?.trim() || "gpt-4.1-mini",
					judgeMode: openAiApiKey ? "llm" : "heuristic",
					autoApply: optimizeConfig.autoApply,
				},
				task: async ({ input }) => {
					const question = toStringSafe(input);
					if (!question) {
						return "ERROR: empty input";
					}
					const response = await callChatApi(apiUrl, question, requestTimeoutMs);
					return response.reply;
				},
				evaluators: [correctnessEvaluator],
			});

			const datasetRunId =
				typeof result.itemResults[0]?.datasetRunId === "string"
					? result.itemResults[0].datasetRunId
					: null;
			const externalScoresByTraceId =
				datasetRunId !== null
					? await fetchRunScoresByTrace(langfuse, datasetRunId)
					: new Map();
			const normalizedItems = normalizeItemResults(
				result.itemResults,
				externalScoresByTraceId,
			);
			const itemAttributions = normalizedItems.map((item) => ({
				index: item.index,
				attribution: attributeFailure(item),
			}));
			const attributionSummary = summarizeAttribution(
				itemAttributions.map((item) => item.attribution),
			);
			const summary = summarizeLoop(normalizedItems);
			const repeatedClarificationInputs = normalizedItems
				.filter((item) => item.correctnessScore === 0)
				.filter((item) => isClarificationLikeOutput(item.output))
				.filter((item) => {
					const previousFailure = previousFailureByInput.get(item.input);
					return (
						previousFailure?.score === 0 &&
						isClarificationLikeOutput(previousFailure.output)
					);
				})
				.map((item) => item.input)
				.filter(Boolean);

			const fixPlan = buildFixPlan(
				summary.worstItems,
				optimizeConfig.maxPatchesPerLoop,
				{
					repeatedClarificationInputs,
				},
			);
			const applyResult = await applyPlannedFixes({
				plannedFixes: fixPlan,
				maxPatchesPerLoop: optimizeConfig.maxPatchesPerLoop,
				autoApply: optimizeConfig.autoApply,
			});

			const delta =
				previousAverageScore === null
					? 0
					: summary.averageScore - previousAverageScore;
			if (Math.abs(delta) < optimizeConfig.minDelta) {
				consecutiveLowDeltaLoops += 1;
			} else {
				consecutiveLowDeltaLoops = 0;
			}
			previousAverageScore = summary.averageScore;
			previousFailureByInput = new Map(
				normalizedItems.map((item) => [
					item.input,
					{
						score: item.correctnessScore,
						output: item.output,
					},
				]),
			);

			const stopDecision = buildStopDecision({
				loopIndex,
				maxLoops: optimizeConfig.maxLoops,
				averageScore: summary.averageScore,
				targetScore: optimizeConfig.targetScore,
				improvementDelta: Math.max(0, delta),
				minDelta: optimizeConfig.minDelta,
				consecutiveLowDeltaLoops,
				actionableFixCount: fixPlan.length,
			});

			const loopRecord = {
				loopIndex,
				runName: loopRunName,
				scoreAverage: summary.averageScore,
				scoreMin: summary.minScore,
				scoreMax: summary.maxScore,
				lowScoreCount: summary.lowScoreCount,
				itemCount: summary.itemCount,
				improvementDelta: delta,
				consecutiveLowDeltaLoops,
				datasetRunUrl: result.datasetRunUrl ?? null,
				applyResult,
				attributionSummary,
				repeatedClarificationCount: repeatedClarificationInputs.length,
				stopReason: stopDecision.reason,
			};
			loopSummaries.push(loopRecord);

			await writeFile(
				resolve(artifactRoot, `loop-${loopIndex}-raw.json`),
				JSON.stringify(
					{
						loop: loopRecord,
						itemResults: normalizedItems,
						itemAttributions,
						repeatedClarificationInputs,
						fixPlan,
					},
					null,
					2,
				),
				"utf8",
			);

			await writeFile(
				resolve(artifactRoot, `loop-${loopIndex}-analysis.json`),
				JSON.stringify(
					{
						loop: loopRecord,
						attributionSummary,
						topFailures: summary.worstItems,
						topFailureAttributions: summary.worstItems.map((item) => ({
							index: item.index,
							input: item.input,
							correctnessScore: item.correctnessScore,
							attribution: attributeFailure(item),
						})),
						repeatedClarificationInputs,
						fixPlan,
					},
					null,
					2,
				),
				"utf8",
			);

			await writeFile(
				resolve(artifactRoot, "leaderboard.json"),
				JSON.stringify({ loops: loopSummaries }, null, 2),
				"utf8",
			);

			console.log(
				`Loop ${loopIndex}: avg=${summary.averageScore.toFixed(3)}, low=${summary.lowScoreCount}, fixes=${fixPlan.length}, addedRules=${applyResult.addedRules}`,
			);
			if (result.datasetRunUrl) {
				console.log(`Dataset run URL: ${result.datasetRunUrl}`);
			}

			if (stopDecision.stop) {
				console.log(`Stopping optimization: ${stopDecision.reason}`);
				break;
			}
		}
	} finally {
		await langfuse.flush();
		await otelSdk.shutdown();
	}

	console.log("\nOptimization session summary:");
	for (const loop of loopSummaries) {
		console.log(JSON.stringify(loop));
	}
	console.log(`Artifacts: ${artifactRoot}`);
};

run().catch((error) => {
	console.error("Eval optimization run failed:", error);
	process.exitCode = 1;
});
