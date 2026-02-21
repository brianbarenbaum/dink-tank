import { describe, expect, it } from "vitest";

import {
	resolveReasoningEffort,
	shouldAllowSqlToolCall,
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

	it("allows SQL tool calls within count and time budget", () => {
		const result = shouldAllowSqlToolCall(1_000, 1, 20_000);
		expect(result).toEqual({ allowed: true });
	});

	it("blocks SQL tool calls after reaching max call count", () => {
		const result = shouldAllowSqlToolCall(1_000, 2, 20_000);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("sql_tool_call_limit_exceeded");
	});

	it("blocks SQL tool calls after elapsed time budget", () => {
		const result = shouldAllowSqlToolCall(1_000, 0, 46_500);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("sql_tool_time_budget_exceeded");
	});
});
