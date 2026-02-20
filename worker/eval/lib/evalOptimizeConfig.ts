export interface EvalOptimizeConfig {
	maxLoops: number;
	targetScore: number;
	minDelta: number;
	maxPatchesPerLoop: number;
	datasetLimit: number | null;
	autoApply: boolean;
}

const parseOptionalInt = (value: string | undefined): number | null => {
	if (!value?.trim()) {
		return null;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : null;
};

const parseOptionalFloat = (value: string | undefined): number | null => {
	if (!value?.trim()) {
		return null;
	}
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : null;
};

const clampInt = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value));

const clampFloat = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value));

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
	if (!value?.trim()) {
		return fallback;
	}
	const normalized = value.trim().toLowerCase();
	if (["1", "true", "yes", "on"].includes(normalized)) {
		return true;
	}
	if (["0", "false", "no", "off"].includes(normalized)) {
		return false;
	}
	return fallback;
};

export const parseEvalOptimizeConfig = (
	env: NodeJS.ProcessEnv,
): EvalOptimizeConfig => {
	const rawLoops = parseOptionalInt(env.EVAL_OPTIMIZE_MAX_LOOPS);
	const rawTargetScore = parseOptionalFloat(env.EVAL_OPTIMIZE_TARGET_SCORE);
	const rawMinDelta = parseOptionalFloat(env.EVAL_OPTIMIZE_MIN_DELTA);
	const rawPatches = parseOptionalInt(env.EVAL_OPTIMIZE_MAX_PATCHES_PER_LOOP);
	const rawDatasetLimit = parseOptionalInt(env.EVAL_DATASET_LIMIT);

	if (rawDatasetLimit !== null && rawDatasetLimit <= 0) {
		throw new Error("EVAL_DATASET_LIMIT must be a positive integer.");
	}

	return {
		maxLoops: clampInt(rawLoops ?? 5, 1, 5),
		targetScore: clampFloat(rawTargetScore ?? 0.85, 0, 1),
		minDelta: clampFloat(rawMinDelta ?? 0.02, 0, 1),
		maxPatchesPerLoop: clampInt(rawPatches ?? 3, 1, 10),
		datasetLimit: rawDatasetLimit,
		autoApply: parseBoolean(env.EVAL_OPTIMIZE_AUTO_APPLY, true),
	};
};

export const applyDatasetLimit = <T>(
	items: T[],
	datasetLimit: number | null,
): T[] => {
	if (datasetLimit === null) {
		return items;
	}
	return items.slice(0, Math.min(datasetLimit, items.length));
};

