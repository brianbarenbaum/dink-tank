import type {
	KnownOpponentRoundInput,
	LineupLabRecommendRequest,
	LineupLabValidationResult,
	OpponentRosterEntry,
	ValidationFailure,
	ValidationSuccess,
} from "./types";

type NormalizedGender = "male" | "female";

function normalizeGender(value: unknown): NormalizedGender | null {
	if (value == null || typeof value !== "string") {
		return null;
	}
	const normalized = value.trim().toLowerCase();
	if (normalized === "m" || normalized === "male" || normalized === "man") {
		return "male";
	}
	if (
		normalized === "f" ||
		normalized === "female" ||
		normalized === "woman" ||
		normalized === "women"
	) {
		return "female";
	}
	return null;
}

const MIN_PLAYERS = 8;
const MAX_PLAYERS = 20;
const MAX_RECOMMENDATIONS = 10;
const MIN_SCENARIOS = 1;
const MAX_SCENARIOS = 30;

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ROUND_SLOT_TEMPLATE: Array<Array<"mixed" | "female" | "male">> = [
	["mixed", "mixed", "mixed", "mixed"],
	["female", "female", "male", "male"],
	["mixed", "mixed", "mixed", "mixed"],
	["female", "female", "male", "male"],
	["mixed", "mixed", "mixed", "mixed"],
	["female", "female", "male", "male"],
	["mixed", "mixed", "mixed", "mixed"],
	["female", "female", "male", "male"],
];

const fail = (error: string): ValidationFailure => ({ ok: false, error });

const isUuid = (value: unknown): value is string =>
	typeof value === "string" && UUID_PATTERN.test(value);

const success = (value: LineupLabRecommendRequest): ValidationSuccess => ({
	ok: true,
	value,
});

const parseKnownOpponentRounds = (
	candidate: unknown,
): { ok: true; value: KnownOpponentRoundInput[] } | ValidationFailure => {
	if (!Array.isArray(candidate)) {
		return fail(
			"opponentRounds must be an array when mode is known_opponent.",
		);
	}
	if (candidate.length !== ROUND_SLOT_TEMPLATE.length) {
		return fail("opponentRounds must include exactly 8 rounds.");
	}

	const seenRoundNumbers = new Set<number>();
	const normalizedRounds: KnownOpponentRoundInput[] = [];

	for (const rawRound of candidate) {
		if (!rawRound || typeof rawRound !== "object" || Array.isArray(rawRound)) {
			return fail("Each opponent round must be an object.");
		}
		const round = rawRound as Record<string, unknown>;
		if (
			typeof round.roundNumber !== "number" ||
			!Number.isInteger(round.roundNumber) ||
			round.roundNumber < 1 ||
			round.roundNumber > ROUND_SLOT_TEMPLATE.length
		) {
			return fail("Each opponent round must include a valid roundNumber (1-8).");
		}
		if (seenRoundNumbers.has(round.roundNumber)) {
			return fail("opponentRounds must not include duplicate roundNumber values.");
		}
		seenRoundNumbers.add(round.roundNumber);

		if (!Array.isArray(round.games)) {
			return fail("Each opponent round must include a games array.");
		}
		if (round.games.length !== 4) {
			return fail("Each opponent round must include exactly 4 games.");
		}

		const expectedRoundTemplate = ROUND_SLOT_TEMPLATE[round.roundNumber - 1] ?? [];
		const seenSlotNumbers = new Set<number>();
		const normalizedGames: KnownOpponentRoundInput["games"] = [];
		for (const rawGame of round.games) {
			if (!rawGame || typeof rawGame !== "object" || Array.isArray(rawGame)) {
				return fail("Each opponent game assignment must be an object.");
			}
			const game = rawGame as Record<string, unknown>;
			if (
				typeof game.slotNumber !== "number" ||
				!Number.isInteger(game.slotNumber) ||
				game.slotNumber < 1 ||
				game.slotNumber > 4
			) {
				return fail("Each opponent game must include slotNumber between 1 and 4.");
			}
			if (seenSlotNumbers.has(game.slotNumber)) {
				return fail("Opponent game slotNumber values must be unique per round.");
			}
			seenSlotNumbers.add(game.slotNumber);

			if (
				typeof game.roundNumber !== "number" ||
				!Number.isInteger(game.roundNumber) ||
				game.roundNumber !== round.roundNumber
			) {
				return fail(
					"Each opponent game roundNumber must match its parent roundNumber.",
				);
			}
			if (
				game.matchType !== "mixed" &&
				game.matchType !== "female" &&
				game.matchType !== "male"
			) {
				return fail("Each opponent game matchType must be mixed, female, or male.");
			}

			const expectedMatchType = expectedRoundTemplate[game.slotNumber - 1];
			if (expectedMatchType !== game.matchType) {
				return fail(
					`opponentRounds slot pattern mismatch at round ${round.roundNumber}, slot ${game.slotNumber}.`,
				);
			}
			if (!isUuid(game.opponentPlayerAId) || !isUuid(game.opponentPlayerBId)) {
				return fail("Opponent slot players must be valid UUIDs.");
			}
			if (game.opponentPlayerAId === game.opponentPlayerBId) {
				return fail("Opponent slot players must be different within a game.");
			}
			// Gender validation is done after parsing opponentRoster below.

			normalizedGames.push({
				roundNumber: round.roundNumber,
				slotNumber: game.slotNumber,
				matchType: game.matchType,
				opponentPlayerAId: game.opponentPlayerAId,
				opponentPlayerBId: game.opponentPlayerBId,
			});
		}

		normalizedRounds.push({
			roundNumber: round.roundNumber,
			games: normalizedGames.sort((left, right) => left.slotNumber - right.slotNumber),
		});
	}

	normalizedRounds.sort((left, right) => left.roundNumber - right.roundNumber);
	return { ok: true, value: normalizedRounds };
};

const parseOpponentRoster = (
	candidate: unknown,
): { ok: true; value: OpponentRosterEntry[] } | ValidationFailure => {
	if (!Array.isArray(candidate)) {
		return fail(
			"opponentRoster must be an array when mode is known_opponent.",
		);
	}
	const roster: OpponentRosterEntry[] = [];
	for (let i = 0; i < candidate.length; i++) {
		const raw = candidate[i];
		if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
			return fail("Each opponentRoster entry must be an object with playerId and gender.");
		}
		const entry = raw as Record<string, unknown>;
		if (!isUuid(entry.playerId)) {
			return fail("Each opponentRoster entry must have a valid playerId (UUID).");
		}
		const gender =
			entry.gender !== undefined && entry.gender !== null
				? String(entry.gender)
				: null;
		roster.push({ playerId: entry.playerId, gender });
	}
	return { ok: true, value: roster };
};

function validateOpponentRoundsGender(
	opponentRounds: KnownOpponentRoundInput[],
	roster: OpponentRosterEntry[],
): ValidationFailure | null {
	const genderByPlayerId = new Map<string, NormalizedGender>();
	for (const entry of roster) {
		const g = normalizeGender(entry.gender);
		if (g) genderByPlayerId.set(entry.playerId, g);
	}

	for (const round of opponentRounds) {
		for (const game of round.games) {
			const genderA = genderByPlayerId.get(game.opponentPlayerAId) ?? null;
			const genderB = genderByPlayerId.get(game.opponentPlayerBId) ?? null;
			if (genderA == null || genderB == null) {
				return fail(
					"Opponent roster must include gender for all players in opponent assignments.",
				);
			}
			if (game.matchType === "mixed") {
				const oneMaleOneFemale =
					(genderA === "male" && genderB === "female") ||
					(genderA === "female" && genderB === "male");
				if (!oneMaleOneFemale) {
					return fail("Mixed slots must have one male and one female opponent.");
				}
			} else if (game.matchType === "female") {
				if (genderA !== "female" || genderB !== "female") {
					return fail("Female slots must have two female opponents.");
				}
			} else {
				if (genderA !== "male" || genderB !== "male") {
					return fail("Male slots must have two male opponents.");
				}
			}
		}
	}
	return null;
}

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

	if (candidate.mode !== "blind" && candidate.mode !== "known_opponent") {
		return fail("mode must be blind or known_opponent.");
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

	let opponentRounds: KnownOpponentRoundInput[] | undefined;
	let opponentRoster: OpponentRosterEntry[] | undefined;
	if (candidate.mode === "known_opponent") {
		const parsedRounds = parseKnownOpponentRounds(candidate.opponentRounds);
		if (!parsedRounds.ok) {
			return parsedRounds;
		}
		opponentRounds = parsedRounds.value;

		const parsedRoster = parseOpponentRoster(candidate.opponentRoster);
		if (!parsedRoster.ok) {
			return parsedRoster;
		}
		opponentRoster = parsedRoster.value;

		const genderError = validateOpponentRoundsGender(
			opponentRounds,
			opponentRoster,
		);
		if (genderError) {
			return genderError;
		}
	}

	return success({
		divisionId: candidate.divisionId,
		seasonYear: candidate.seasonYear,
		seasonNumber: candidate.seasonNumber,
		teamId: candidate.teamId,
		oppTeamId: candidate.oppTeamId,
		matchupId: candidate.matchupId,
		mode: candidate.mode,
		availablePlayerIds: candidate.availablePlayerIds,
		objective: candidate.objective,
		maxRecommendations,
		downsideQuantile,
		scenarioLimit,
		opponentRounds,
		opponentRoster,
	});
};
