import { describe, expect, it } from "vitest";

import type { WorkerEnv } from "../worker/src/runtime/env";
import { resolveChatExecutionEnv } from "../worker/src/runtime/sqlAgent";

const baseEnv: WorkerEnv = {
	OPENAI_API_KEY: "test-key",
	SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
	SUPABASE_DB_SSL_NO_VERIFY: true,
	APP_ENV: "local",
	SUPABASE_URL: "https://example.supabase.co",
	SUPABASE_ANON_KEY: "anon-key",
	AUTH_ALLOWED_ORIGINS: ["http://localhost:5173"],
	AUTH_JWT_ISSUER: "https://example.supabase.co/auth/v1",
	AUTH_JWT_AUDIENCE: "authenticated",
	AUTH_BYPASS_ENABLED: false,
	AUTH_TURNSTILE_BYPASS: true,
	AUTH_IP_HASH_SALT: "test-salt",
	AUTH_INVITE_CODE_HASH_SECRET: "invite-secret",
	LLM_MODEL: "gpt-4.1-mini",
	LLM_REASONING_LEVEL: "medium",
	SQL_QUERY_TIMEOUT_MS: 25_000,
	SQL_CAPTURE_EXPLAIN_PLAN: false,
	EXPOSE_ERROR_DETAILS: false,
	LANGFUSE_TRACING_ENVIRONMENT: "default",
	LANGFUSE_ENABLED: false,
};

describe("sql agent env selection", () => {
	it("uses the dedicated chat database url when configured", () => {
		const env = resolveChatExecutionEnv({
			...baseEnv,
			CHAT_SUPABASE_DB_URL:
				"postgres://chat_reader:secret@localhost:5432/postgres",
		});

		expect(env.SUPABASE_DB_URL).toBe(
			"postgres://chat_reader:secret@localhost:5432/postgres",
		);
		expect(env.OPENAI_API_KEY).toBe(baseEnv.OPENAI_API_KEY);
		expect(env.SUPABASE_URL).toBe(baseEnv.SUPABASE_URL);
	});

	it("keeps the shared database url when a dedicated chat url is absent", () => {
		const env = resolveChatExecutionEnv(baseEnv);

		expect(env).toBe(baseEnv);
		expect(env.SUPABASE_DB_URL).toBe(baseEnv.SUPABASE_DB_URL);
	});
});
