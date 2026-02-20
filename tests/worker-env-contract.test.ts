import { describe, expect, it } from "vitest";

import { parseWorkerEnv } from "../worker/src/runtime/env";

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
			expect(parsed.value.LANGFUSE_ENABLED).toBe(false);
			expect(parsed.value.LANGFUSE_TRACING_ENVIRONMENT).toBe("default");
		}
	});

	it("rejects missing required env vars", () => {
		const parsed = parseWorkerEnv({});
		expect(parsed.ok).toBe(false);
	});

	it("ignores unknown legacy graph env vars", () => {
		const parsed = parseWorkerEnv({
			OPENAI_API_KEY: "test-key",
			SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
			AGENT_ORCHESTRATOR: "invalid",
			GRAPH_SELECTOR_MODE: "invalid",
		});

		expect(parsed.ok).toBe(true);
	});

	it("enables langfuse when all langfuse credentials are present", () => {
		const parsed = parseWorkerEnv({
			OPENAI_API_KEY: "test-key",
			SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
			LANGFUSE_PUBLIC_KEY: "pk-lf-test",
			LANGFUSE_SECRET_KEY: "sk-lf-test",
			LANGFUSE_BASE_URL: "https://cloud.langfuse.com",
			LANGFUSE_TRACING_ENVIRONMENT: "development",
		});
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.value.LANGFUSE_ENABLED).toBe(true);
			expect(parsed.value.LANGFUSE_PUBLIC_KEY).toBe("pk-lf-test");
			expect(parsed.value.LANGFUSE_SECRET_KEY).toBe("sk-lf-test");
			expect(parsed.value.LANGFUSE_BASE_URL).toBe("https://cloud.langfuse.com");
			expect(parsed.value.LANGFUSE_TRACING_ENVIRONMENT).toBe("development");
		}
	});
});
