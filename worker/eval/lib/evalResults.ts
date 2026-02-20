interface MinimalEvaluation {
	name: string;
	value?: unknown;
	comment?: unknown;
	metadata?: unknown;
}

interface MinimalExperimentItemResult {
	input?: unknown;
	expectedOutput?: unknown;
	output?: unknown;
	evaluations?: MinimalEvaluation[];
	item?: {
		input?: unknown;
		expectedOutput?: unknown;
	};
	traceId?: string;
	datasetRunId?: string;
}

export interface ExternalScore {
	traceId: string;
	name: string;
	value?: unknown;
	comment?: unknown;
	source?: string;
}

export interface NormalizedEvalItem {
	index: number;
	input: string;
	expectedOutput: string;
	output: string;
	correctnessScore: number;
	judgeComment: string;
	judgeScoreName: string;
	judgeScores: Array<{
		name: string;
		source: string;
		value: number;
		comment: string;
	}>;
	traceId: string | null;
	datasetRunId: string | null;
}

export interface LoopSummary {
	averageScore: number;
	minScore: number;
	maxScore: number;
	lowScoreCount: number;
	itemCount: number;
	worstItems: NormalizedEvalItem[];
}

export interface LoopStopDecision {
	stop: boolean;
	reason: string;
}

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

const extractTextLikeValue = (value: unknown): string => {
	if (typeof value === "string") {
		return value;
	}
	if (value === null || value === undefined) {
		return "";
	}
	if (Array.isArray(value)) {
		return value.map((entry) => extractTextLikeValue(entry)).join("\n").trim();
	}
	if (typeof value === "object") {
		const record = value as Record<string, unknown>;
		const priorityKeys = [
			"input",
			"question",
			"prompt",
			"content",
			"text",
			"value",
			"expectedOutput",
			"expected_output",
			"answer",
		];
		for (const key of priorityKeys) {
			const candidate = record[key];
			const text = extractTextLikeValue(candidate);
			if (text) {
				return text;
			}
		}
	}
	return toStringSafe(value);
};

const getEvaluationSource = (evaluation: MinimalEvaluation): string => {
	if (!evaluation.metadata || typeof evaluation.metadata !== "object") {
		return "";
	}
	const source = (evaluation.metadata as Record<string, unknown>).source;
	return typeof source === "string" ? source.toLowerCase() : "";
};

const getExternalScoreSource = (score: ExternalScore): string =>
	typeof score.source === "string" ? score.source.toLowerCase() : "";

const getCorrectnessEvaluation = (
	evaluations: MinimalEvaluation[],
): MinimalEvaluation | null => {
	const candidates = evaluations.filter((evaluation) =>
		evaluation.name.toLowerCase().includes("correctness"),
	);
	if (candidates.length === 0) {
		return null;
	}
	const scoreEvaluation = (evaluation: MinimalEvaluation): number => {
		let score = 0;
		const name = evaluation.name.toLowerCase();
		const comment =
			typeof evaluation.comment === "string"
				? evaluation.comment.toLowerCase()
				: "";
		const source = getEvaluationSource(evaluation);
		if (name.includes("(eval)")) {
			score += 100;
		}
		if (source === "eval") {
			score += 80;
		}
		if (!comment.startsWith("judge fallback used")) {
			score += 40;
		}
		if (typeof evaluation.value === "number") {
			score += 10;
		}
		return score;
	};
	return [...candidates].sort((a, b) => scoreEvaluation(b) - scoreEvaluation(a))[0];
};

export const normalizeItemResults = (
	itemResults: MinimalExperimentItemResult[],
	externalScoresByTraceId: Map<string, ExternalScore[]> = new Map(),
): NormalizedEvalItem[] =>
	itemResults.map((item, index) => {
		const localCorrectness = getCorrectnessEvaluation(item.evaluations ?? []);
		const externalScores = item.traceId
			? (externalScoresByTraceId.get(item.traceId) ?? [])
			: [];
		const combinedJudgeScores: Array<{
			name: string;
			source: string;
			value: number;
			comment: string;
		}> = [];
		if (localCorrectness) {
			combinedJudgeScores.push({
				name: localCorrectness.name,
				source: "api",
				value:
					typeof localCorrectness.value === "number"
						? Math.max(0, Math.min(1, localCorrectness.value))
						: 0,
				comment: toStringSafe(localCorrectness.comment),
			});
		}
		for (const externalScore of externalScores) {
			if (!externalScore.name.toLowerCase().includes("correctness")) {
				continue;
			}
			combinedJudgeScores.push({
				name: externalScore.name,
				source: (externalScore.source ?? "external").toLowerCase(),
				value:
					typeof externalScore.value === "number"
						? Math.max(0, Math.min(1, externalScore.value))
						: 0,
				comment: toStringSafe(externalScore.comment),
			});
		}
		const dedupedJudgeScores = [...combinedJudgeScores].filter(
			(score, scoreIndex, allScores) =>
				allScores.findIndex(
					(existing) =>
						existing.name === score.name && existing.source === score.source,
				) === scoreIndex,
		);
		const externalCorrectness = externalScores
			.filter((score) => score.name.toLowerCase().includes("correctness"))
			.sort((a, b) => {
				const aScore =
					(getExternalScoreSource(a) === "eval" ? 100 : 0) +
					(getExternalScoreSource(a) === "api" ? 20 : 0);
				const bScore =
					(getExternalScoreSource(b) === "eval" ? 100 : 0) +
					(getExternalScoreSource(b) === "api" ? 20 : 0);
				return bScore - aScore;
			})[0];
		const correctness = externalCorrectness
			? {
					name: `correctness (${(externalCorrectness.source ?? "external").toLowerCase()})`,
					value: externalCorrectness.value,
					comment: externalCorrectness.comment,
				}
			: localCorrectness;
		const value =
			typeof correctness?.value === "number"
				? Math.max(0, Math.min(1, correctness.value))
				: 0;
		return {
			index,
			input: extractTextLikeValue(item.input ?? item.item?.input),
			expectedOutput: extractTextLikeValue(
				item.expectedOutput ?? item.item?.expectedOutput,
			),
			output: toStringSafe(item.output),
			correctnessScore: value,
			judgeComment: toStringSafe(correctness?.comment),
			judgeScoreName: correctness?.name ?? "",
			judgeScores: dedupedJudgeScores,
			traceId: item.traceId ?? null,
			datasetRunId: item.datasetRunId ?? null,
		};
	});

export const summarizeLoop = (
	items: NormalizedEvalItem[],
): LoopSummary => {
	if (items.length === 0) {
		return {
			averageScore: 0,
			minScore: 0,
			maxScore: 0,
			lowScoreCount: 0,
			itemCount: 0,
			worstItems: [],
		};
	}

	const scores = items.map((item) => item.correctnessScore);
	const averageScore =
		scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length);
	const minScore = Math.min(...scores);
	const maxScore = Math.max(...scores);
	const lowScoreCount = items.filter((item) => item.correctnessScore < 0.7).length;
	const worstItems = [...items]
		.sort((a, b) => a.correctnessScore - b.correctnessScore)
		.slice(0, 5);

	return {
		averageScore,
		minScore,
		maxScore,
		lowScoreCount,
		itemCount: items.length,
		worstItems,
	};
};

export const buildStopDecision = (params: {
	loopIndex: number;
	maxLoops: number;
	averageScore: number;
	targetScore: number;
	improvementDelta: number;
	minDelta: number;
	consecutiveLowDeltaLoops: number;
	actionableFixCount: number;
}): LoopStopDecision => {
	if (params.loopIndex >= params.maxLoops) {
		return { stop: true, reason: "max_loops_reached" };
	}
	if (params.averageScore >= params.targetScore) {
		return { stop: true, reason: "target_score_reached" };
	}
	if (params.actionableFixCount === 0) {
		return { stop: true, reason: "no_actionable_fixes" };
	}
	if (
		params.improvementDelta < params.minDelta &&
		params.consecutiveLowDeltaLoops >= 2
	) {
		return { stop: true, reason: "stalled_improvement" };
	}
	return { stop: false, reason: "continue" };
};
