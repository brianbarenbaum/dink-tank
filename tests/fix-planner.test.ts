import { describe, expect, it } from "vitest";

import { buildFixPlan } from "../worker/eval/lib/fixPlanner";
import type { NormalizedEvalItem } from "../worker/eval/lib/evalResults";

const makeItem = (input: string): NormalizedEvalItem => ({
	index: 0,
	input,
	expectedOutput: "expected",
	output: "Do you want team match results or player match stats for wins/losses?",
	correctnessScore: 0,
	judgeComment:
		"The assistant did not answer the question and asked an unrelated clarifying question.",
	judgeScoreName: "correctness",
	judgeScores: [],
	traceId: null,
	datasetRunId: null,
});

describe("fix planner", () => {
	it("adds no-repeat clarification guard when repeated clarification prompts are detected", () => {
		const fixes = buildFixPlan(
			[makeItem("How many games has 3.0 Flemington Blue won total?")],
			5,
			{
				repeatedClarificationInputs: [
					"How many games has 3.0 Flemington Blue won total?",
				],
			},
		);

		expect(fixes.some((fix) => fix.id === "no-repeat-clarification-guard")).toBe(
			true,
		);
	});
});

