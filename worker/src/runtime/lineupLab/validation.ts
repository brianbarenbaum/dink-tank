import type {
	LineupLabRecommendRequest,
	LineupLabValidationResult,
	ValidationFailure,
	ValidationSuccess,
} from "./types";

const MIN_PLAYERS = 8;
const MAX_PLAYERS = 20;
const MAX_RECOMMENDATIONS = 10;
const MIN_SCENARIOS = 1;
const MAX_SCENARIOS = 30;

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const fail = (error: string): ValidationFailure => ({ ok: false, error });

const isUuid = (value: unknown): value is string =>
	typeof value === "string" && UUID_PATTERN.test(value);

const success = (value: LineupLabRecommendRequest): ValidationSuccess => ({
	ok: true,
	value,
});

export const parseLineupLabRecommendRequest = (
	payload: unknown,
): LineupLabValidationResult => {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		return fail("Request body must be an object.");
	}

	const candidate = payload as Record<string, unknown>;

	if (!isUuid(candidate.divisionId)) {
		return fail("divisionId must be a valid UUID.");
	}
	if (!isUuid(candidate.teamId)) {
		return fail("teamId must be a valid UUID.");
	}
	if (!isUuid(candidate.oppTeamId)) {
		return fail("oppTeamId must be a valid UUID.");
	}
	if (!isUuid(candidate.matchupId)) {
		return fail("matchupId must be a valid UUID.");
	}
	if (candidate.teamId === candidate.oppTeamId) {
		return fail("teamId and oppTeamId must be different.");
	}

	if (
		typeof candidate.seasonYear !== "number" ||
		!Number.isInteger(candidate.seasonYear) ||
		candidate.seasonYear < 2020 ||
		candidate.seasonYear > 2100
	) {
		return fail("seasonYear must be a valid integer year.");
	}

	if (
		typeof candidate.seasonNumber !== "number" ||
		!Number.isInteger(candidate.seasonNumber) ||
		candidate.seasonNumber <= 0
	) {
		return fail("seasonNumber must be a positive integer.");
	}

	if (!Array.isArray(candidate.availablePlayerIds)) {
		return fail("availablePlayerIds must be an array of UUIDs.");
	}

	if (
		candidate.availablePlayerIds.length < MIN_PLAYERS ||
		candidate.availablePlayerIds.length > MAX_PLAYERS ||
		candidate.availablePlayerIds.length % 2 !== 0
	) {
		return fail(
			`availablePlayerIds must include an even number of players between ${MIN_PLAYERS} and ${MAX_PLAYERS}.`,
		);
	}

	if (!candidate.availablePlayerIds.every(isUuid)) {
		return fail("availablePlayerIds must include only valid UUIDs.");
	}

	const uniquePlayerIds = new Set(candidate.availablePlayerIds);
	if (uniquePlayerIds.size !== candidate.availablePlayerIds.length) {
		return fail("availablePlayerIds must not contain duplicates.");
	}

	if (
		candidate.objective !== "MAX_EXPECTED_WINS" &&
		candidate.objective !== "MINIMIZE_DOWNSIDE"
	) {
		return fail(
			"objective must be MAX_EXPECTED_WINS or MINIMIZE_DOWNSIDE.",
		);
	}

	const maxRecommendations =
		typeof candidate.maxRecommendations === "number" &&
		Number.isInteger(candidate.maxRecommendations)
			? candidate.maxRecommendations
			: 3;

	if (maxRecommendations <= 0 || maxRecommendations > MAX_RECOMMENDATIONS) {
		return fail(
			`maxRecommendations must be between 1 and ${MAX_RECOMMENDATIONS}.`,
		);
	}

	const downsideQuantile =
		typeof candidate.downsideQuantile === "number"
			? candidate.downsideQuantile
			: 0.2;
	if (downsideQuantile <= 0 || downsideQuantile >= 1) {
		return fail("downsideQuantile must be between 0 and 1.");
	}

	const scenarioLimit =
		typeof candidate.scenarioLimit === "number" &&
		Number.isInteger(candidate.scenarioLimit)
			? candidate.scenarioLimit
			: 12;
	if (scenarioLimit < MIN_SCENARIOS || scenarioLimit > MAX_SCENARIOS) {
		return fail(
			`scenarioLimit must be between ${MIN_SCENARIOS} and ${MAX_SCENARIOS}.`,
		);
	}

	return success({
		divisionId: candidate.divisionId,
		seasonYear: candidate.seasonYear,
		seasonNumber: candidate.seasonNumber,
		teamId: candidate.teamId,
		oppTeamId: candidate.oppTeamId,
		matchupId: candidate.matchupId,
		availablePlayerIds: candidate.availablePlayerIds,
		objective: candidate.objective,
		maxRecommendations,
		downsideQuantile,
		scenarioLimit,
	});
};
