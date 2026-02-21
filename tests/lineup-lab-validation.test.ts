import { describe, expect, it } from "vitest";

import { parseLineupLabRecommendRequest } from "../worker/src/runtime/lineupLab/validation";

describe("lineup lab validation", () => {
	it("accepts valid recommend payload", () => {
		const parsed = parseLineupLabRecommendRequest({
			divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
			seasonYear: 2025,
			seasonNumber: 3,
			teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
			oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
			availablePlayerIds: [
				"11111111-1111-4111-8111-111111111111",
				"22222222-2222-4222-8222-222222222222",
				"33333333-3333-4333-8333-333333333333",
				"44444444-4444-4444-8444-444444444444",
			],
			objective: "MAX_EXPECTED_WINS",
			maxRecommendations: 3,
		});

		expect(parsed.ok).toBe(true);
	});

	it("rejects invalid objective", () => {
		const parsed = parseLineupLabRecommendRequest({
			divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
			seasonYear: 2025,
			seasonNumber: 3,
			teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
			oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
			availablePlayerIds: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"],
			objective: "HIGHEST_CEILING",
		});

		expect(parsed.ok).toBe(false);
	});

	it("rejects odd count available players", () => {
		const parsed = parseLineupLabRecommendRequest({
			divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
			seasonYear: 2025,
			seasonNumber: 3,
			teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
			oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
			availablePlayerIds: [
				"11111111-1111-4111-8111-111111111111",
				"22222222-2222-4222-8222-222222222222",
				"33333333-3333-4333-8333-333333333333",
			],
			objective: "MINIMIZE_DOWNSIDE",
		});

		expect(parsed.ok).toBe(false);
	});
});
