import { describe, expect, it } from "vitest";

import { parseChatRequest } from "../worker/src/chat/validation";

describe("worker chat validation", () => {
	it("accepts valid chat payload", () => {
		const result = parseChatRequest({
			messages: [{ role: "user", content: "hello" }],
		});

		expect(result.ok).toBe(true);
	});

	it("rejects unknown roles and empty content", () => {
		const result = parseChatRequest({
			messages: [{ role: "system", content: "" }],
		});

		expect(result.ok).toBe(false);
	});
});
