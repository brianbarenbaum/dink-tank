import { afterEach, describe, expect, it, vi } from "vitest";

import { emitLangfuseTelemetry } from "../worker/src/observability/langfuseTelemetry";
import type { WorkerEnv } from "../worker/src/runtime/env";

const baseEnv: WorkerEnv = {
	OPENAI_API_KEY: "test-key",
	SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
	SUPABASE_DB_SSL_NO_VERIFY: true,
	LLM_MODEL: "gpt-4.1-mini",
	LLM_REASONING_LEVEL: "medium",
	SQL_QUERY_TIMEOUT_MS: 10_000,
	EXPOSE_ERROR_DETAILS: false,
	LANGFUSE_PUBLIC_KEY: "pk-lf-test",
	LANGFUSE_SECRET_KEY: "sk-lf-test",
	LANGFUSE_BASE_URL: "https://cloud.langfuse.com",
	LANGFUSE_TRACING_ENVIRONMENT: "test",
	LANGFUSE_ENABLED: true,
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("langfuse telemetry", () => {
	it("returns disabled result when langfuse is off", async () => {
		const env = { ...baseEnv, LANGFUSE_ENABLED: false };
		const result = await emitLangfuseTelemetry(
			env,
			"legacy_sql_telemetry",
			{ orchestrator: "legacy" },
			{ input: "question", output: "answer" },
		);

		expect(result.ok).toBe(false);
		expect(result.reason).toBe("disabled");
	});

	it("returns http_error result for non-2xx responses", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("forbidden", { status: 403 }),
		);

		const result = await emitLangfuseTelemetry(
			baseEnv,
			"legacy_sql_telemetry",
			{ orchestrator: "legacy" },
			{ input: "question", output: "answer" },
		);

		expect(result.ok).toBe(false);
		expect(result.reason).toBe("http_error");
		expect(result.statusCode).toBe(403);
	});
});
