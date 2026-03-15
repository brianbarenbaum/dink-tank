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
	isApprovedEmail,
	findActiveInviteCodeByHash,
	getPendingEnrollment,
	upsertPendingEnrollment,
	deletePendingEnrollment,
	insertApprovedEmail,
} = vi.hoisted(() => ({
	fetchRecentOtpRequestCounts: vi.fn(),
	insertOtpRequestEvent: vi.fn(),
	insertAuthAuditEvent: vi.fn(),
	insertOtpVerifyEvent: vi.fn(),
	getVerifyState: vi.fn(),
	upsertVerifyState: vi.fn(),
	clearVerifyState: vi.fn(),
	cleanupExpiredAuthRecords: vi.fn(),
	isApprovedEmail: vi.fn(),
	findActiveInviteCodeByHash: vi.fn(),
	getPendingEnrollment: vi.fn(),
	upsertPendingEnrollment: vi.fn(),
	deletePendingEnrollment: vi.fn(),
	insertApprovedEmail: vi.fn(),
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
	isApprovedEmail,
	findActiveInviteCodeByHash,
	getPendingEnrollment,
	upsertPendingEnrollment,
	deletePendingEnrollment,
	insertApprovedEmail,
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

import * as authHandlerModule from "../worker/src/runtime/auth/handler";
import { handleFetch } from "../worker/src/runtime/index";

const {
	handleAuthSession,
	handleAuthSignOut,
	handleAuthRefresh,
	handleOtpRequest,
	handleOtpVerify,
	requireAuthenticatedRequest,
} = authHandlerModule;

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
	AUTH_INVITE_CODE_HASH_SECRET: "invite-secret",
	LLM_MODEL: "gpt-4.1-mini",
	LLM_REASONING_LEVEL: "medium",
	SQL_QUERY_TIMEOUT_MS: 25_000,
	SQL_CAPTURE_EXPLAIN_PLAN: false,
	EXPOSE_ERROR_DETAILS: false,
	LANGFUSE_TRACING_ENVIRONMENT: "default",
	LANGFUSE_ENABLED: false,
};

const rawFetchEnv = {
	OPENAI_API_KEY: "test-key",
	SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
	SUPABASE_URL: "https://example.supabase.co",
	SUPABASE_ANON_KEY: "anon-key",
	AUTH_IP_HASH_SALT: "test-salt",
	AUTH_INVITE_CODE_HASH_SECRET: "invite-secret",
	APP_ENV: "local",
	AUTH_TURNSTILE_BYPASS: "true",
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
		isApprovedEmail.mockResolvedValue(false);
		findActiveInviteCodeByHash.mockResolvedValue(null);
		getPendingEnrollment.mockResolvedValue(null);
		upsertPendingEnrollment.mockResolvedValue(undefined);
		deletePendingEnrollment.mockResolvedValue(undefined);
		insertApprovedEmail.mockResolvedValue(undefined);
		fetchRecentOtpRequestCounts.mockResolvedValue({
			emailCount: 0,
			ipCount: 0,
			oldestEmailAt: null,
			oldestIpAt: null,
		});
		verifyTurnstileToken.mockResolvedValue(true);
	});

	it("returns approved status from login-start for approved emails", async () => {
		isApprovedEmail.mockResolvedValue(true);
		const handleAuthLoginStart = (authHandlerModule as Record<string, unknown>)
			.handleAuthLoginStart as
			| ((request: Request, env: WorkerEnv) => Promise<Response>)
			| undefined;

		expect(handleAuthLoginStart).toBeTypeOf("function");
		if (!handleAuthLoginStart) {
			return;
		}

		const request = new Request("http://localhost/api/auth/login/start", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "friend@example.com" }),
		});
		const response = await handleAuthLoginStart(request, env);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(body.status).toBe("approved");
		expect(isApprovedEmail).toHaveBeenCalledWith(env, "friend@example.com");
	});

	it("returns invite-required status from login-start for unapproved emails", async () => {
		isApprovedEmail.mockResolvedValue(false);
		const handleAuthLoginStart = (authHandlerModule as Record<string, unknown>)
			.handleAuthLoginStart as
			| ((request: Request, env: WorkerEnv) => Promise<Response>)
			| undefined;

		expect(handleAuthLoginStart).toBeTypeOf("function");
		if (!handleAuthLoginStart) {
			return;
		}

		const request = new Request("http://localhost/api/auth/login/start", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "new@example.com" }),
		});
		const response = await handleAuthLoginStart(request, env);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(body.status).toBe("invite_required");
		expect(isApprovedEmail).toHaveBeenCalledWith(env, "new@example.com");
	});

	it("treats login-start as a public auth route in handleFetch", async () => {
		isApprovedEmail.mockResolvedValue(false);
		const request = new Request("http://localhost/api/auth/login/start", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "new@example.com" }),
		});

		const response = await handleFetch(request, rawFetchEnv);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(body.status).toBe("invite_required");
	});

	it("rejects OTP request when turnstile fails", async () => {
		isApprovedEmail.mockResolvedValue(true);
		verifyTurnstileToken.mockResolvedValue(false);
		const request = new Request("http://localhost/api/auth/otp/request", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				email: "user@example.com",
				turnstileToken: "token",
			}),
		});

		const response = await handleOtpRequest(request, {
			...env,
			AUTH_TURNSTILE_BYPASS: false,
		});

		expect(response.status).toBe(400);
		expect(verifyTurnstileToken).toHaveBeenCalled();
	});

	it("enforces OTP request rate limit", async () => {
		isApprovedEmail.mockResolvedValue(true);
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
		const response = await handleOtpRequest(request, {
			...env,
			AUTH_TURNSTILE_BYPASS: false,
		});
		const body = await parseJson(response);

		expect(response.status).toBe(429);
		expect(typeof body.retryAfterSeconds).toBe("number");
		expect(sendOtpRequest).not.toHaveBeenCalled();
	});

	it("sends OTP for approved emails without invite code", async () => {
		isApprovedEmail.mockResolvedValue(true);
		sendOtpRequest.mockResolvedValue({ ok: true });
		const request = new Request("http://localhost/api/auth/otp/request", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				email: "approved@example.com",
				turnstileToken: "token",
			}),
		});

		const response = await handleOtpRequest(request, {
			...env,
			AUTH_TURNSTILE_BYPASS: false,
		});
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(sendOtpRequest).toHaveBeenCalledWith(
			expect.objectContaining({ APP_ENV: "local" }),
			"approved@example.com",
		);
		expect(upsertPendingEnrollment).not.toHaveBeenCalled();
	});

	it("rejects OTP request for unapproved emails without invite context", async () => {
		isApprovedEmail.mockResolvedValue(false);
		const request = new Request("http://localhost/api/auth/otp/request", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				email: "new@example.com",
				turnstileToken: "token",
			}),
		});

		const response = await handleOtpRequest(request, {
			...env,
			AUTH_TURNSTILE_BYPASS: false,
		});

		expect(response.status).toBe(400);
		expect(sendOtpRequest).not.toHaveBeenCalled();
		expect(upsertPendingEnrollment).not.toHaveBeenCalled();
	});

	it("accepts valid invite code for an unapproved email and creates pending enrollment before sending OTP", async () => {
		isApprovedEmail.mockResolvedValue(false);
		findActiveInviteCodeByHash.mockResolvedValue({
			id: 7,
			expiresAt: new Date(Date.now() + 5 * 60 * 1000),
		});
		sendOtpRequest.mockResolvedValue({ ok: true });
		const request = new Request("http://localhost/api/auth/otp/request", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				email: "new@example.com",
				inviteCode: "DTNK-ABCD-EFGH-IJKL",
				turnstileToken: "token",
			}),
		});

		const response = await handleOtpRequest(request, {
			...env,
			AUTH_TURNSTILE_BYPASS: false,
		});

		expect(response.status).toBe(200);
		expect(findActiveInviteCodeByHash).toHaveBeenCalled();
		expect(upsertPendingEnrollment).toHaveBeenCalled();
		expect(sendOtpRequest).toHaveBeenCalledWith(
			expect.objectContaining({ APP_ENV: "local" }),
			"new@example.com",
		);
	});

	it("allows resend for unapproved emails when pending enrollment already exists", async () => {
		isApprovedEmail.mockResolvedValue(false);
		getPendingEnrollment.mockResolvedValue({
			inviteCodeId: 7,
			expiresAt: new Date(Date.now() + 5 * 60 * 1000),
		});
		sendOtpRequest.mockResolvedValue({ ok: true });
		const request = new Request("http://localhost/api/auth/otp/request", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				email: "new@example.com",
				turnstileToken: "token",
			}),
		});

		const response = await handleOtpRequest(request, {
			...env,
			AUTH_TURNSTILE_BYPASS: false,
		});

		expect(response.status).toBe(200);
		expect(getPendingEnrollment).toHaveBeenCalledWith(
			expect.objectContaining({ AUTH_TURNSTILE_BYPASS: false }),
			"new@example.com",
		);
		expect(findActiveInviteCodeByHash).not.toHaveBeenCalled();
		expect(sendOtpRequest).toHaveBeenCalledWith(
			expect.objectContaining({ APP_ENV: "local" }),
			"new@example.com",
		);
	});

	it("returns session payload on successful OTP verify", async () => {
		getVerifyState.mockResolvedValue(null);
		isApprovedEmail.mockResolvedValue(true);
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
		expect(response.headers.get("set-cookie")).toContain(
			"dink_tank_access_token=",
		);
		expect(response.headers.get("set-cookie")).toContain("HttpOnly");
		expect(clearVerifyState).toHaveBeenCalled();
	});

	it("approves unapproved emails on successful OTP verify when a pending enrollment exists", async () => {
		getVerifyState.mockResolvedValue(null);
		isApprovedEmail.mockResolvedValue(false);
		getPendingEnrollment.mockResolvedValue({
			inviteCodeId: 7,
			expiresAt: new Date(Date.now() + 5 * 60 * 1000),
		});
		verifyOtpCode.mockResolvedValue({
			ok: true,
			session: {
				accessToken: "access",
				refreshToken: "refresh",
				expiresAt: Math.floor(Date.now() / 1000) + 3600,
				user: {
					id: "user-123",
					email: "new@example.com",
				},
			},
		});

		const request = new Request("http://localhost/api/auth/otp/verify", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "new@example.com", code: "123456" }),
		});
		const response = await handleOtpVerify(request, env);

		expect(response.status).toBe(200);
		expect(getPendingEnrollment).toHaveBeenCalledWith(env, "new@example.com");
		expect(insertApprovedEmail).toHaveBeenCalledWith(env, {
			emailNormalized: "new@example.com",
			inviteCodeId: 7,
		});
		expect(deletePendingEnrollment).toHaveBeenCalledWith(
			env,
			"new@example.com",
		);
	});

	it("rejects OTP verify for unapproved emails when no pending enrollment exists", async () => {
		getVerifyState.mockResolvedValue(null);
		isApprovedEmail.mockResolvedValue(false);
		getPendingEnrollment.mockResolvedValue(null);
		verifyOtpCode.mockResolvedValue({
			ok: true,
			session: {
				accessToken: "access",
				refreshToken: "refresh",
				expiresAt: Math.floor(Date.now() / 1000) + 3600,
				user: {
					id: "user-123",
					email: "new@example.com",
				},
			},
		});

		const request = new Request("http://localhost/api/auth/otp/verify", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "new@example.com", code: "123456" }),
		});
		const response = await handleOtpVerify(request, env);

		expect(response.status).toBe(400);
		expect(insertApprovedEmail).not.toHaveBeenCalled();
		expect(verifyOtpCode).not.toHaveBeenCalled();
	});

	it("allows in-progress enrollment to finish after the invite code is later deactivated", async () => {
		getVerifyState.mockResolvedValue(null);
		isApprovedEmail.mockResolvedValue(false);
		getPendingEnrollment.mockResolvedValue({
			inviteCodeId: 7,
			expiresAt: new Date(Date.now() + 5 * 60 * 1000),
		});
		verifyOtpCode.mockResolvedValue({
			ok: true,
			session: {
				accessToken: "access",
				refreshToken: "refresh",
				expiresAt: Math.floor(Date.now() / 1000) + 3600,
				user: {
					id: "user-123",
					email: "new@example.com",
				},
			},
		});

		const request = new Request("http://localhost/api/auth/otp/verify", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "new@example.com", code: "123456" }),
		});
		const response = await handleOtpVerify(request, env);

		expect(response.status).toBe(200);
		expect(insertApprovedEmail).toHaveBeenCalledWith(env, {
			emailNormalized: "new@example.com",
			inviteCodeId: 7,
		});
		expect(deletePendingEnrollment).toHaveBeenCalledWith(
			env,
			"new@example.com",
		);
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

	it("ignores malformed cookie encoding during auth-session lookup", async () => {
		const request = new Request("http://localhost/api/auth/session", {
			method: "GET",
			headers: { cookie: "dink_tank_access_token=%E0%A4%A" },
		});

		const response = await handleAuthSession(request, env);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(body.authenticated).toBe(false);
		expect(verifyAccessToken).not.toHaveBeenCalled();
	});

	it("returns authenticated auth-session response with valid access-token cookie", async () => {
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
			headers: { cookie: "dink_tank_access_token=cookie-token" },
		});
		const response = await handleAuthSession(request, env);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(body.authenticated).toBe(true);
		expect(verifyAccessToken).toHaveBeenCalledWith(env, "cookie-token");
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
			headers: {
				"content-type": "application/json",
				cookie: "dink_tank_refresh_token=bad",
			},
		});
		const response = await handleAuthRefresh(request, env);
		expect(response.status).toBe(401);
	});

	it("refreshes session from refresh-token cookie and rotates cookies", async () => {
		refreshSupabaseSession.mockResolvedValue({
			ok: true,
			session: {
				accessToken: "next-access",
				refreshToken: "next-refresh",
				expiresAt: Math.floor(Date.now() / 1000) + 3600,
				user: {
					id: "user-123",
					email: "user@example.com",
				},
			},
		});
		const request = new Request("http://localhost/api/auth/refresh", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				cookie: "dink_tank_refresh_token=refresh-cookie",
			},
		});
		const response = await handleAuthRefresh(request, env);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(body.session).toBeTruthy();
		expect(refreshSupabaseSession).toHaveBeenCalledWith(env, "refresh-cookie");
		expect(response.headers.get("set-cookie")).toContain(
			"dink_tank_refresh_token=next-refresh",
		);
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

	it("clears auth cookies on signout", async () => {
		const request = new Request("http://localhost/api/auth/signout", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				cookie:
					"dink_tank_access_token=access; dink_tank_refresh_token=refresh",
			},
		});
		const response = await handleAuthSignOut(request, env);

		expect(response.status).toBe(200);
		expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
	});

	it("accepts protected API requests with access-token cookie", async () => {
		verifyAccessToken.mockResolvedValue({
			ok: true,
			value: {
				userId: "user-123",
				email: "user@example.com",
				expiresAt: Math.floor(Date.now() / 1000) + 3600,
				issuedAt: Math.floor(Date.now() / 1000),
			},
		});
		const request = new Request("http://localhost/api/chat", {
			method: "POST",
			headers: { cookie: "dink_tank_access_token=cookie-token" },
		});

		const result = await requireAuthenticatedRequest(request, env);

		expect(result.ok).toBe(true);
		expect(verifyAccessToken).toHaveBeenCalledWith(env, "cookie-token");
	});
});
