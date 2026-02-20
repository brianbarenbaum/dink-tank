import { describe, expect, it } from "vitest";

import {
	applyDatasetLimit,
	parseEvalOptimizeConfig,
} from "../worker/eval/lib/evalOptimizeConfig";
import { buildStopDecision } from "../worker/eval/lib/evalResults";

describe("eval optimize config", () => {
	it("enforces max loop hard cap at 5", () => {
		const config = parseEvalOptimizeConfig({
			EVAL_OPTIMIZE_MAX_LOOPS: "100",
		});
		expect(config.maxLoops).toBe(5);
	});

	it("applies dataset limit slicing", () => {
		const limited = applyDatasetLimit([1, 2, 3, 4, 5], 3);
		expect(limited).toEqual([1, 2, 3]);
	});

	it("leaves dataset unchanged when limit is null", () => {
		const values = [1, 2, 3];
		expect(applyDatasetLimit(values, null)).toEqual(values);
	});

	it("throws on invalid dataset limit", () => {
		expect(() =>
			parseEvalOptimizeConfig({
				EVAL_DATASET_LIMIT: "0",
			}),
		).toThrow("EVAL_DATASET_LIMIT must be a positive integer.");
	});
});

describe("loop stop decision", () => {
	it("stops when target score is reached", () => {
		const decision = buildStopDecision({
			loopIndex: 2,
			maxLoops: 5,
			averageScore: 0.9,
			targetScore: 0.85,
			improvementDelta: 0.03,
			minDelta: 0.02,
			consecutiveLowDeltaLoops: 0,
			actionableFixCount: 2,
		});
		expect(decision.stop).toBe(true);
		expect(decision.reason).toBe("target_score_reached");
	});

	it("stops when improvement stalls for two loops", () => {
		const decision = buildStopDecision({
			loopIndex: 3,
			maxLoops: 5,
			averageScore: 0.6,
			targetScore: 0.85,
			improvementDelta: 0.005,
			minDelta: 0.02,
			consecutiveLowDeltaLoops: 2,
			actionableFixCount: 2,
		});
		expect(decision.stop).toBe(true);
		expect(decision.reason).toBe("stalled_improvement");
	});
});

