import { describe, expect, it } from "vitest";

import { parseChatRequest } from "../worker/src/runtime/validation";

describe("worker chat validation", () => {
	it("accepts valid chat payload", () => {
		const result = parseChatRequest({
			messages: [{ role: "user", content: "hello" }],
			options: { extendedThinking: true },
		});

		expect(result.ok).toBe(true);
	});

	it("rejects unknown roles and empty content", () => {
		const result = parseChatRequest({
			messages: [{ role: "system", content: "" }],
		});

		expect(result.ok).toBe(false);
	});

	it("rejects invalid extendedThinking option type", () => {
		const result = parseChatRequest({
			messages: [{ role: "user", content: "hello" }],
			options: { extendedThinking: "yes" },
		});

		expect(result.ok).toBe(false);
	});

});
