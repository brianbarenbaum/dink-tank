import { describe, expect, it } from "vitest";

import {
	resolveReasoningEffort,
	type ReasoningEffortLevel,
} from "../worker/src/runtime/sqlAgent";

describe("sql agent reasoning effort", () => {
	it("uses none when extended thinking is disabled", () => {
		const level: ReasoningEffortLevel = "high";
		expect(resolveReasoningEffort({ extendedThinking: false }, level)).toBe(
			"none",
		);
	});

	it("uses env-configured level when extended thinking is enabled", () => {
		expect(resolveReasoningEffort({ extendedThinking: true }, "low")).toBe(
			"low",
		);
		expect(resolveReasoningEffort({ extendedThinking: true }, "medium")).toBe(
			"medium",
		);
	});
});
