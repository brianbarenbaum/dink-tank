import { describe, expect, it } from "vitest";

import { parseWorkerEnv } from "../worker/src/runtime/env";

const baseEnv = {
	OPENAI_API_KEY: "test-key",
	SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
	SUPABASE_URL: "https://example.supabase.co",
	SUPABASE_ANON_KEY: "anon-key",
	AUTH_IP_HASH_SALT: "test-salt",
	AUTH_TURNSTILE_BYPASS: "true",
};

describe("worker env contract", () => {
	it("accepts required env with defaults", () => {
		const parsed = parseWorkerEnv(baseEnv);

		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.value.LLM_MODEL).toBeTruthy();
			expect(parsed.value.LLM_REASONING_LEVEL).toBe("medium");
			expect(parsed.value.SQL_QUERY_TIMEOUT_MS).toBe(25_000);
			expect(parsed.value.SQL_CAPTURE_EXPLAIN_PLAN).toBe(false);
			expect(parsed.value.SUPABASE_DB_SSL_NO_VERIFY).toBe(false);
			expect(parsed.value.LANGFUSE_ENABLED).toBe(false);
			expect(parsed.value.LANGFUSE_TRACING_ENVIRONMENT).toBe("default");
			expect(parsed.value.LINEUP_ENABLE_DUPR_BLEND).toBe(true);
			expect(parsed.value.LINEUP_DUPR_MAJOR_WEIGHT).toBe(0.65);
			expect(parsed.value.LINEUP_ENABLE_TEAM_STRENGTH_ADJUSTMENT).toBe(true);
			expect(parsed.value.LINEUP_DUPR_SLOPE).toBe(1.6);
			expect(parsed.value.LINEUP_TEAM_STRENGTH_FACTOR).toBe(0.45);
			expect(parsed.value.LINEUP_TEAM_STRENGTH_CAP).toBe(0.35);
		}
	});

	it("rejects missing required env vars", () => {
		const parsed = parseWorkerEnv({});
		expect(parsed.ok).toBe(false);
	});

	it("ignores unknown legacy graph env vars", () => {
		const parsed = parseWorkerEnv({
			...baseEnv,
			AGENT_ORCHESTRATOR: "invalid",
			GRAPH_SELECTOR_MODE: "invalid",
		});

		expect(parsed.ok).toBe(true);
	});

	it("enables langfuse when all langfuse credentials are present", () => {
		const parsed = parseWorkerEnv({
			...baseEnv,
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

	it("accepts configured reasoning level", () => {
		const parsed = parseWorkerEnv({
			...baseEnv,
			LLM_REASONING_LEVEL: "high",
		});

		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.value.LLM_REASONING_LEVEL).toBe("high");
		}
	});

	it("enables SQL explain plan capture when configured", () => {
		const parsed = parseWorkerEnv({
			...baseEnv,
			SQL_CAPTURE_EXPLAIN_PLAN: "true",
		});

		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.value.SQL_CAPTURE_EXPLAIN_PLAN).toBe(true);
		}
	});

	it("rejects invalid reasoning level", () => {
		const parsed = parseWorkerEnv({
			...baseEnv,
			LLM_REASONING_LEVEL: "turbo",
		});

		expect(parsed.ok).toBe(false);
	});

	it("accepts configured lineup scoring env vars", () => {
		const parsed = parseWorkerEnv({
			...baseEnv,
			LINEUP_ENABLE_DUPR_BLEND: "false",
			LINEUP_DUPR_MAJOR_WEIGHT: "0.7",
			LINEUP_ENABLE_TEAM_STRENGTH_ADJUSTMENT: "false",
			LINEUP_DUPR_SLOPE: "1.2",
			LINEUP_TEAM_STRENGTH_FACTOR: "0.3",
			LINEUP_TEAM_STRENGTH_CAP: "0.2",
		});

		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.value.LINEUP_ENABLE_DUPR_BLEND).toBe(false);
			expect(parsed.value.LINEUP_DUPR_MAJOR_WEIGHT).toBe(0.7);
			expect(parsed.value.LINEUP_ENABLE_TEAM_STRENGTH_ADJUSTMENT).toBe(false);
			expect(parsed.value.LINEUP_DUPR_SLOPE).toBe(1.2);
			expect(parsed.value.LINEUP_TEAM_STRENGTH_FACTOR).toBe(0.3);
			expect(parsed.value.LINEUP_TEAM_STRENGTH_CAP).toBe(0.2);
		}
	});

	it("rejects invalid lineup dupr major weight", () => {
		const parsed = parseWorkerEnv({
			...baseEnv,
			LINEUP_DUPR_MAJOR_WEIGHT: "1.2",
		});
		expect(parsed.ok).toBe(false);
	});

	it("rejects non-positive lineup dupr slope", () => {
		const parsed = parseWorkerEnv({
			...baseEnv,
			LINEUP_DUPR_SLOPE: "0",
		});
		expect(parsed.ok).toBe(false);
	});

	it("rejects invalid team strength factor/cap", () => {
		const negativeFactor = parseWorkerEnv({
			...baseEnv,
			LINEUP_TEAM_STRENGTH_FACTOR: "-0.1",
		});
		expect(negativeFactor.ok).toBe(false);

		const nonPositiveCap = parseWorkerEnv({
			...baseEnv,
			LINEUP_TEAM_STRENGTH_CAP: "0",
		});
		expect(nonPositiveCap.ok).toBe(false);
	});

	it("rejects production auth bypass", () => {
		const parsed = parseWorkerEnv({
			...baseEnv,
			APP_ENV: "production",
			AUTH_BYPASS_ENABLED: "true",
			AUTH_TURNSTILE_SECRET: "turnstile-secret",
			AUTH_TURNSTILE_BYPASS: "false",
			AUTH_ALLOWED_ORIGINS: "https://example.com",
		});
		expect(parsed.ok).toBe(false);
	});

	it("requires turnstile secret when bypass is disabled", () => {
		const parsed = parseWorkerEnv({
			...baseEnv,
			AUTH_TURNSTILE_BYPASS: "false",
		});
		expect(parsed.ok).toBe(false);
	});
});
