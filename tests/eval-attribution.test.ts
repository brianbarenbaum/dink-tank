import { describe, expect, it } from "vitest";

import {
	attributeFailure,
	summarizeAttribution,
} from "../worker/eval/lib/attribution";
import type { NormalizedEvalItem } from "../worker/eval/lib/evalResults";

const makeItem = (overrides: Partial<NormalizedEvalItem>): NormalizedEvalItem => ({
	index: 0,
	input: "How many games has Flemington Blue won?",
	expectedOutput: "225",
	output: "Do you want team match results or player match stats for wins/losses?",
	correctnessScore: 0,
	judgeComment: "The assistant did not answer the question and asked a clarifying question.",
	judgeScoreName: "correctness",
	judgeScores: [],
	traceId: null,
	datasetRunId: null,
	...overrides,
});

describe("failure attribution", () => {
	it("classifies prompt-level failures", () => {
		const attribution = attributeFailure(makeItem({}));
		expect(attribution.primary_layer).toBe("prompt");
		expect(attribution.proposed_fix_type).toBe("system_prompt");
	});

	it("classifies schema-level failures from SQL errors", () => {
		const attribution = attributeFailure(
			makeItem({
				judgeComment: "SQL error: column PPG does not exist.",
			}),
		);
		expect(attribution.primary_layer).toBe("schema");
	});

	it("summarizes layer counts", () => {
		const summary = summarizeAttribution([
			attributeFailure(makeItem({})),
			attributeFailure(makeItem({ judgeComment: "SQL error: relation missing" })),
		]);
		expect(summary.primaryLayerCounts.prompt).toBe(1);
		expect(summary.primaryLayerCounts.schema).toBe(1);
	});
});

