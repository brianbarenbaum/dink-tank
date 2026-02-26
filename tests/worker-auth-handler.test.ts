import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkerEnv } from "../worker/src/runtime/env";

const {
	fetchRecentOtpRequestCounts,
	insertOtpRequestEvent,
	insertAuthAuditEvent,
	insertOtpVerifyEvent,
	getVerifyState,
	upsertVerifyState,
	clearVerifyState,
	cleanupExpiredAuthRecords,
} = vi.hoisted(() => ({
	fetchRecentOtpRequestCounts: vi.fn(),
	insertOtpRequestEvent: vi.fn(),
	insertAuthAuditEvent: vi.fn(),
	insertOtpVerifyEvent: vi.fn(),
	getVerifyState: vi.fn(),
	upsertVerifyState: vi.fn(),
	clearVerifyState: vi.fn(),
	cleanupExpiredAuthRecords: vi.fn(),
}));

const {
	sendOtpRequest,
	verifyOtpCode,
	refreshSupabaseSession,
	signOutSupabaseSession,
} = vi.hoisted(() => ({
	sendOtpRequest: vi.fn(),
	verifyOtpCode: vi.fn(),
	refreshSupabaseSession: vi.fn(),
	signOutSupabaseSession: vi.fn(),
}));

const { verifyTurnstileToken } = vi.hoisted(() => ({
	verifyTurnstileToken: vi.fn(),
}));

const { verifyAccessToken } = vi.hoisted(() => ({
	verifyAccessToken: vi.fn(),
}));

vi.mock("../worker/src/runtime/auth/repository", () => ({
	fetchRecentOtpRequestCounts,
	insertOtpRequestEvent,
	insertAuthAuditEvent,
	insertOtpVerifyEvent,
	getVerifyState,
	upsertVerifyState,
	clearVerifyState,
	cleanupExpiredAuthRecords,
}));

vi.mock("../worker/src/runtime/auth/supabaseAuthClient", () => ({
	sendOtpRequest,
	verifyOtpCode,
	refreshSupabaseSession,
	signOutSupabaseSession,
}));

vi.mock("../worker/src/runtime/auth/turnstile", () => ({
	verifyTurnstileToken,
}));

vi.mock("../worker/src/runtime/auth/jwt", () => ({
	verifyAccessToken,
}));

import {
	handleAuthSession,
	handleAuthSignOut,
	handleAuthRefresh,
	handleOtpRequest,
	handleOtpVerify,
} from "../worker/src/runtime/auth/handler";

const env: WorkerEnv = {
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
	LLM_MODEL: "gpt-4.1-mini",
	LLM_REASONING_LEVEL: "medium",
	SQL_QUERY_TIMEOUT_MS: 25_000,
	SQL_CAPTURE_EXPLAIN_PLAN: false,
	EXPOSE_ERROR_DETAILS: false,
	LANGFUSE_TRACING_ENVIRONMENT: "default",
	LANGFUSE_ENABLED: false,
};

const parseJson = async (response: Response) =>
	JSON.parse(await response.text()) as Record<string, unknown>;

describe("worker auth handler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		cleanupExpiredAuthRecords.mockResolvedValue(undefined);
		insertOtpRequestEvent.mockResolvedValue(undefined);
		insertAuthAuditEvent.mockResolvedValue(undefined);
		insertOtpVerifyEvent.mockResolvedValue(undefined);
		upsertVerifyState.mockResolvedValue(undefined);
		clearVerifyState.mockResolvedValue(undefined);
		signOutSupabaseSession.mockResolvedValue(true);
	});

	it("rejects OTP request when turnstile fails", async () => {
		verifyTurnstileToken.mockResolvedValue(false);
		const request = new Request("http://localhost/api/auth/otp/request", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				email: "user@example.com",
				turnstileToken: "token",
			}),
		});

		const response = await handleOtpRequest(request, { ...env, AUTH_TURNSTILE_BYPASS: false });

		expect(response.status).toBe(400);
		expect(verifyTurnstileToken).toHaveBeenCalled();
	});

	it("enforces OTP request rate limit", async () => {
		verifyTurnstileToken.mockResolvedValue(true);
		fetchRecentOtpRequestCounts.mockResolvedValue({
			emailCount: 3,
			ipCount: 1,
			oldestEmailAt: new Date(Date.now() - 1000),
			oldestIpAt: new Date(Date.now() - 1000),
		});

		const request = new Request("http://localhost/api/auth/otp/request", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				email: "user@example.com",
				turnstileToken: "token",
			}),
		});
		const response = await handleOtpRequest(request, { ...env, AUTH_TURNSTILE_BYPASS: false });
		const body = await parseJson(response);

		expect(response.status).toBe(429);
		expect(typeof body.retryAfterSeconds).toBe("number");
		expect(sendOtpRequest).not.toHaveBeenCalled();
	});

	it("returns session payload on successful OTP verify", async () => {
		getVerifyState.mockResolvedValue(null);
		verifyOtpCode.mockResolvedValue({
			ok: true,
			session: {
				accessToken: "access",
				refreshToken: "refresh",
				expiresAt: Math.floor(Date.now() / 1000) + 3600,
				user: {
					id: "user-123",
					email: "user@example.com",
				},
			},
		});

		const request = new Request("http://localhost/api/auth/otp/verify", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "user@example.com", code: "123456" }),
		});
		const response = await handleOtpVerify(request, env);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(body.session).toBeTruthy();
		expect(clearVerifyState).toHaveBeenCalled();
	});

	it("returns unauthenticated auth-session response without bearer token", async () => {
		const request = new Request("http://localhost/api/auth/session", {
			method: "GET",
		});
		const response = await handleAuthSession(request, env);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(body.authenticated).toBe(false);
	});

	it("returns authenticated auth-session response with valid bearer token", async () => {
		verifyAccessToken.mockResolvedValue({
			ok: true,
			value: {
				userId: "user-123",
				email: "user@example.com",
				expiresAt: Math.floor(Date.now() / 1000) + 3600,
				issuedAt: Math.floor(Date.now() / 1000),
			},
		});
		const request = new Request("http://localhost/api/auth/session", {
			method: "GET",
			headers: { authorization: "Bearer token" },
		});
		const response = await handleAuthSession(request, env);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(body.authenticated).toBe(true);
	});

	it("returns 401 on refresh failure", async () => {
		refreshSupabaseSession.mockResolvedValue({ ok: false });
		const request = new Request("http://localhost/api/auth/refresh", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ refreshToken: "bad" }),
		});
		const response = await handleAuthRefresh(request, env);
		expect(response.status).toBe(401);
	});

	it("returns success from signout even without access token", async () => {
		const request = new Request("http://localhost/api/auth/signout", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ refreshToken: "refresh" }),
		});
		const response = await handleAuthSignOut(request, env);
		expect(response.status).toBe(200);
	});
});
