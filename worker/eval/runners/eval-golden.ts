import { LangfuseClient, type Evaluator } from "@langfuse/client";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

interface ChatResponseBody {
	reply?: string;
	error?: string;
	message?: string;
}

interface JudgeResult {
	score: number;
	comment: string;
}

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

const applyDatasetLimit = <T>(items: T[], limit: number | null): T[] => {
	if (limit === null) {
		return items;
	}
	return items.slice(0, Math.min(limit, items.length));
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

const run = async (): Promise<void> => {
	loadDevVars();

	const langfusePublicKey = requiredEnv("LANGFUSE_PUBLIC_KEY");
	const langfuseSecretKey = requiredEnv("LANGFUSE_SECRET_KEY");
	const langfuseBaseUrl =
		process.env.LANGFUSE_BASE_URL?.trim() || "https://cloud.langfuse.com";
	const langfuseEnvironment =
		process.env.LANGFUSE_TRACING_ENVIRONMENT?.trim() || "default";

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
	const experimentName = process.env.EVAL_EXPERIMENT_NAME?.trim() || "golden_30_eval";
	const runName =
		process.env.EVAL_RUN_NAME?.trim() ||
		`golden-30-${new Date().toISOString().replace(/[:.]/g, "-")}`;
	const runDescription =
		process.env.EVAL_RUN_DESCRIPTION?.trim() ||
		"Golden dataset experiment run for chat worker.";
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
	const datasetLimitRaw = process.env.EVAL_DATASET_LIMIT?.trim();
	const datasetLimit = datasetLimitRaw
		? Number.parseInt(datasetLimitRaw, 10)
		: null;
	if (datasetLimit !== null && (!Number.isFinite(datasetLimit) || datasetLimit < 1)) {
		throw new Error("EVAL_DATASET_LIMIT must be a positive integer.");
	}
	const maxConcurrency = parseOptionalInt(process.env.EVAL_MAX_CONCURRENCY, 4);
	const openAiApiKey = process.env.OPENAI_API_KEY?.trim();

	console.log(`Dataset: ${datasetName}`);
	console.log(`Experiment: ${experimentName}`);
	console.log(`Run name: ${runName}`);
	console.log(`Chat API: ${apiUrl}`);

	const dataset = await langfuse.dataset.get(datasetName);
	if (dataset.items.length !== expectedItemCount) {
		throw new Error(
			`Expected ${expectedItemCount} dataset items for "${datasetName}", found ${dataset.items.length}.`,
		);
	}
	const selectedItems = applyDatasetLimit(dataset.items, datasetLimit);
	console.log(
		`Loaded ${selectedItems.length}/${dataset.items.length} dataset items from Langfuse.`,
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

	try {
		const result = await langfuse.experiment.run({
			name: experimentName,
			runName,
			description: runDescription,
			data: selectedItems,
			metadata: {
				apiUrl,
				requestTimeoutMs,
				script: "worker/eval/runners/eval-golden.ts",
				judgeModel: process.env.EVAL_JUDGE_MODEL?.trim() || "gpt-4.1-mini",
				judgeMode: openAiApiKey ? "llm" : "heuristic",
				datasetLimit,
				datasetItemCount: selectedItems.length,
			},
			maxConcurrency,
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

		await langfuse.flush();

		console.log(await result.format({ includeItemResults: false }));
		console.log(`Item count: ${result.itemResults.length}`);
		if (result.datasetRunUrl) {
			console.log(`Dataset run URL: ${result.datasetRunUrl}`);
		}
	} finally {
		await otelSdk.shutdown();
	}
};

run().catch((error) => {
	console.error("Golden eval run failed:", error);
	process.exitCode = 1;
});
