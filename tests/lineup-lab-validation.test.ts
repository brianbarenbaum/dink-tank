import { describe, expect, it } from "vitest";

import { parseLineupLabRecommendRequest } from "../worker/src/runtime/lineupLab/validation";

const availablePlayerIds = [
	"11111111-1111-4111-8111-111111111111",
	"22222222-2222-4222-8222-222222222222",
	"33333333-3333-4333-8333-333333333333",
	"44444444-4444-4444-8444-444444444444",
	"55555555-5555-4555-8555-555555555555",
	"66666666-6666-4666-8666-666666666666",
	"77777777-7777-4777-8777-777777777777",
	"88888888-8888-4888-8888-888888888888",
];

const MALE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FEMALE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FEMALE_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MALE_D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const buildKnownRounds = () =>
	[
		["mixed", "mixed", "mixed", "mixed"],
		["female", "female", "male", "male"],
		["mixed", "mixed", "mixed", "mixed"],
		["female", "female", "male", "male"],
		["mixed", "mixed", "mixed", "mixed"],
		["female", "female", "male", "male"],
		["mixed", "mixed", "mixed", "mixed"],
		["female", "female", "male", "male"],
	].map((slotTypes, roundIndex) => ({
		roundNumber: roundIndex + 1,
		games: slotTypes.map((matchType, slotIndex) => ({
			roundNumber: roundIndex + 1,
			slotNumber: slotIndex + 1,
			matchType,
			opponentPlayerAId:
				matchType === "mixed" || matchType === "male" ? MALE_A : FEMALE_B,
			opponentPlayerBId:
				matchType === "mixed"
					? FEMALE_B
					: matchType === "female"
						? FEMALE_C
						: MALE_D,
		})),
	}));

const buildOpponentRoster = () => [
	{ playerId: MALE_A, gender: "Male" },
	{ playerId: FEMALE_B, gender: "Female" },
	{ playerId: FEMALE_C, gender: "Female" },
	{ playerId: MALE_D, gender: "Male" },
];

describe("lineup lab validation", () => {
	it("accepts valid blind payload", () => {
		const parsed = parseLineupLabRecommendRequest({
			divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
			seasonYear: 2025,
			seasonNumber: 3,
			teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
			oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
			matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
			mode: "blind",
			availablePlayerIds,
			objective: "MAX_EXPECTED_WINS",
			maxRecommendations: 3,
		});

		expect(parsed.ok).toBe(true);
	});

	it("accepts valid known-opponent payload with gender-valid opponentRoster", () => {
		const parsed = parseLineupLabRecommendRequest({
			divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
			seasonYear: 2025,
			seasonNumber: 3,
			teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
			oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
			matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
			mode: "known_opponent",
			availablePlayerIds,
			objective: "MAX_EXPECTED_WINS",
			opponentRounds: buildKnownRounds(),
			opponentRoster: buildOpponentRoster(),
		});

		expect(parsed.ok).toBe(true);
	});

	it("rejects known-opponent payload when opponentRoster is missing", () => {
		const parsed = parseLineupLabRecommendRequest({
			divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
			seasonYear: 2025,
			seasonNumber: 3,
			teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
			oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
			matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
			mode: "known_opponent",
			availablePlayerIds,
			objective: "MAX_EXPECTED_WINS",
			opponentRounds: buildKnownRounds(),
		});

		expect(parsed.ok).toBe(false);
		if (!parsed.ok) {
			expect(parsed.error).toContain("opponentRoster");
		}
	});

	it("rejects known-opponent when mixed slot has same-gender opponents", () => {
		const rounds = buildKnownRounds();
		rounds[0]!.games[0]!.opponentPlayerAId = MALE_A;
		rounds[0]!.games[0]!.opponentPlayerBId = MALE_D;
		const parsed = parseLineupLabRecommendRequest({
			divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
			seasonYear: 2025,
			seasonNumber: 3,
			teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
			oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
			matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
			mode: "known_opponent",
			availablePlayerIds,
			objective: "MAX_EXPECTED_WINS",
			opponentRounds: rounds,
			opponentRoster: buildOpponentRoster(),
		});

		expect(parsed.ok).toBe(false);
		if (!parsed.ok) {
			expect(parsed.error).toMatch(/mixed|male|female/i);
		}
	});

	it("rejects invalid objective", () => {
		const parsed = parseLineupLabRecommendRequest({
			divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
			seasonYear: 2025,
			seasonNumber: 3,
			teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
			oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
			matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
			mode: "blind",
			availablePlayerIds,
			objective: "HIGHEST_CEILING",
		});

		expect(parsed.ok).toBe(false);
	});

	it("rejects missing known-opponent rounds", () => {
		const parsed = parseLineupLabRecommendRequest({
			divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
			seasonYear: 2025,
			seasonNumber: 3,
			teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
			oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
			matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
			mode: "known_opponent",
			availablePlayerIds,
			objective: "MAX_EXPECTED_WINS",
		});

		expect(parsed.ok).toBe(false);
	});

	it("rejects known-opponent round pattern mismatch", () => {
		const rounds = buildKnownRounds();
		rounds[0]?.games.splice(0, 1);
		const parsed = parseLineupLabRecommendRequest({
			divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
			seasonYear: 2025,
			seasonNumber: 3,
			teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
			oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
			matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
			mode: "known_opponent",
			availablePlayerIds,
			objective: "MAX_EXPECTED_WINS",
			opponentRounds: rounds,
			opponentRoster: buildOpponentRoster(),
		});

		expect(parsed.ok).toBe(false);
	});
});
