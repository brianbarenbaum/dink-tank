import { describe, expect, it } from "vitest";

import {
	buildPairSets,
	rankPairSetResults,
	type PairSetScore,
} from "../worker/src/runtime/lineupLab/optimizer";

describe("lineup lab optimizer", () => {
	it("builds all pair sets for 4 players", () => {
		const sets = buildPairSets([
			"11111111-1111-4111-8111-111111111111",
			"22222222-2222-4222-8222-222222222222",
			"33333333-3333-4333-8333-333333333333",
			"44444444-4444-4444-8444-444444444444",
		]);

		expect(sets).toHaveLength(3);
	});

	it("ranks by expected wins for MAX_EXPECTED_WINS", () => {
		const scores: PairSetScore[] = [
			{ pairSetId: "a", expectedWins: 2.7, floorWinsQ20: 2.1, volatility: 0.3, confidence: "MEDIUM", pairs: [] },
			{ pairSetId: "b", expectedWins: 2.9, floorWinsQ20: 1.7, volatility: 0.5, confidence: "LOW", pairs: [] },
		];

		const ranked = rankPairSetResults(scores, "MAX_EXPECTED_WINS");
		expect(ranked[0]?.pairSetId).toBe("b");
	});

	it("ranks by floor for MINIMIZE_DOWNSIDE", () => {
		const scores: PairSetScore[] = [
			{ pairSetId: "a", expectedWins: 2.7, floorWinsQ20: 2.1, volatility: 0.3, confidence: "MEDIUM", pairs: [] },
			{ pairSetId: "b", expectedWins: 2.9, floorWinsQ20: 1.7, volatility: 0.5, confidence: "LOW", pairs: [] },
		];

		const ranked = rankPairSetResults(scores, "MINIMIZE_DOWNSIDE");
		expect(ranked[0]?.pairSetId).toBe("a");
	});
});
