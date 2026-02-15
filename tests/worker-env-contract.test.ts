import { describe, expect, it } from "vitest";

import { parseWorkerEnv } from "../worker/src/env";

describe("worker env contract", () => {
	it("accepts required env with defaults", () => {
		const parsed = parseWorkerEnv({
			OPENAI_API_KEY: "test-key",
			SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
		});

		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.value.LLM_MODEL).toBeTruthy();
			expect(parsed.value.SUPABASE_DB_SSL_NO_VERIFY).toBe(false);
		}
	});

	it("rejects missing required env vars", () => {
		const parsed = parseWorkerEnv({});
		expect(parsed.ok).toBe(false);
	});
});
