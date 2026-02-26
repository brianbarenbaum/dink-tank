import type { WorkerEnv } from "../env";
import { createRequestContext } from "../requestContext";
import { logError, logWarn } from "../runtimeLogger";
import {
	clearVerifyState,
	cleanupExpiredAuthRecords,
	fetchRecentOtpRequestCounts,
	getVerifyState,
	insertAuthAuditEvent,
	insertOtpRequestEvent,
	insertOtpVerifyEvent,
	upsertVerifyState,
} from "./repository";
import {
	refreshSupabaseSession,
	sendOtpRequest,
	signOutSupabaseSession,
	verifyOtpCode,
} from "./supabaseAuthClient";
import { getBearerToken, json } from "./http";
import { getRequestIpAddress, hashWithSalt, isValidEmail, normalizeEmail } from "./crypto";
import { verifyAccessToken } from "./jwt";
import { verifyTurnstileToken } from "./turnstile";
import type {
	OtpRequestBody,
	OtpVerifyBody,
	RefreshBody,
	SignOutBody,
	VerifyStateSnapshot,
} from "./types";

const OTP_REQUEST_EMAIL_LIMIT = 3;
const OTP_REQUEST_IP_LIMIT = 20;
const OTP_REQUEST_WINDOW_SECONDS = 15 * 60;
const OTP_RESEND_SECONDS = 60;
const OTP_VERIFY_COOLDOWN_SECONDS = 5;
const OTP_VERIFY_LOCK_SECONDS = 5 * 60;
const OTP_VERIFY_LOCK_ATTEMPTS = 5;
const RETENTION_CLEANUP_PROBABILITY = 0.05;
const VERIFY_FAILURE_RESET_WINDOW_SECONDS = 10 * 60;

const GENERIC_AUTH_FAILURE_MESSAGE = "Unable to complete authentication.";
const GENERIC_AUTH_REQUEST_MESSAGE = "If the address is eligible, a code will be sent.";

const jsonWithRetryAfter = (
	body: unknown,
	status: number,
	retryAfterSeconds: number,
): Response => {
	const response = json(body, status);
	response.headers.set("retry-after", String(Math.max(1, retryAfterSeconds)));
	return response;
};

const maybeCleanupAuthRetention = async (env: WorkerEnv): Promise<void> => {
	if (Math.random() >= RETENTION_CLEANUP_PROBABILITY) {
		return;
	}
	await cleanupExpiredAuthRecords(env);
};

const parseJsonBody = async <T>(request: Request): Promise<T | null> => {
	try {
		return (await request.json()) as T;
	} catch {
		return null;
	}
};

const toRetrySeconds = (until: Date, nowMs: number): number =>
	Math.max(1, Math.ceil((until.getTime() - nowMs) / 1000));

const sanitizeRequestBody = (body: OtpRequestBody | null): OtpRequestBody | null => {
	if (!body || typeof body.email !== "string") {
		return null;
	}
	return {
		email: body.email,
		turnstileToken:
			typeof body.turnstileToken === "string" && body.turnstileToken.trim().length > 0
				? body.turnstileToken.trim()
				: null,
	};
};

const sanitizeVerifyBody = (body: OtpVerifyBody | null): OtpVerifyBody | null => {
	if (!body || typeof body.email !== "string" || typeof body.code !== "string") {
		return null;
	}
	return {
		email: body.email,
		code: body.code.trim(),
	};
};

const shouldResetFailedAttempts = (
	state: VerifyStateSnapshot | null,
	nowMs: number,
): boolean => {
	if (!state) {
		return false;
	}
	if (state.lockedUntil && state.lockedUntil.getTime() <= nowMs) {
		return true;
	}
	if (
		state.lastFailedAt &&
		nowMs - state.lastFailedAt.getTime() > VERIFY_FAILURE_RESET_WINDOW_SECONDS * 1000
	) {
		return true;
	}
	return false;
};

export const handleOtpRequest = async (
	request: Request,
	env: WorkerEnv,
): Promise<Response> => {
	const context = createRequestContext(request);
	const body = sanitizeRequestBody(await parseJsonBody<OtpRequestBody>(request));
	if (!body || !isValidEmail(body.email)) {
		logWarn("auth_otp_request_invalid", context);
		return json({ error: "auth_failed", message: GENERIC_AUTH_FAILURE_MESSAGE }, 400);
	}

	const normalizedEmail = normalizeEmail(body.email);
	const ipAddress = getRequestIpAddress(request);
	const [emailHash, ipHash] = await Promise.all([
		hashWithSalt(env.AUTH_IP_HASH_SALT, normalizedEmail),
		hashWithSalt(env.AUTH_IP_HASH_SALT, ipAddress),
	]);

	try {
		await maybeCleanupAuthRetention(env);
	} catch (error) {
		logWarn("auth_cleanup_failed", context, {
			error: error instanceof Error ? error.message : String(error),
		});
	}

	const turnstileOk = await verifyTurnstileToken(
		env,
		body.turnstileToken,
		ipAddress,
	);
	if (!turnstileOk) {
		await Promise.all([
			insertOtpRequestEvent(env, {
				requestId: context.requestId,
				emailNormalized: normalizedEmail,
				emailHash,
				ipHash,
				outcome: "turnstile_rejected",
				reason: "turnstile_failed",
			}),
			insertAuthAuditEvent(env, {
				requestId: context.requestId,
				eventType: "otp_request",
				status: "failure",
				emailNormalized: normalizedEmail,
				emailHash,
				details: { reason: "turnstile_failed" },
			}),
		]);
		return json({ error: "auth_failed", message: GENERIC_AUTH_FAILURE_MESSAGE }, 400);
	}

	let counts;
	try {
		counts = await fetchRecentOtpRequestCounts(env, emailHash, ipHash);
	} catch (error) {
		logError("auth_otp_request_rate_limit_check_failed", context, {
			error: error instanceof Error ? error.message : String(error),
		});
		return json({ error: "auth_failed", message: GENERIC_AUTH_FAILURE_MESSAGE }, 500);
	}

	const emailLimited = counts.emailCount >= OTP_REQUEST_EMAIL_LIMIT;
	const ipLimited = counts.ipCount >= OTP_REQUEST_IP_LIMIT;
	if (emailLimited || ipLimited) {
		const nowMs = Date.now();
		const oldest = emailLimited ? counts.oldestEmailAt : counts.oldestIpAt;
		const retryAfterSeconds = oldest
			? Math.max(
				1,
				Math.ceil(
					(OTP_REQUEST_WINDOW_SECONDS * 1000 - (nowMs - oldest.getTime())) / 1000,
				),
			)
			: OTP_REQUEST_WINDOW_SECONDS;
		await Promise.all([
			insertOtpRequestEvent(env, {
				requestId: context.requestId,
				emailNormalized: normalizedEmail,
				emailHash,
				ipHash,
				outcome: "rate_limited",
				reason: emailLimited ? "email_window_limit" : "ip_window_limit",
			}),
			insertAuthAuditEvent(env, {
				requestId: context.requestId,
				eventType: "otp_request",
				status: "failure",
				emailNormalized: normalizedEmail,
				emailHash,
				details: { reason: emailLimited ? "email_limit" : "ip_limit" },
			}),
		]);
		return jsonWithRetryAfter(
			{
				error: "auth_failed",
				message: GENERIC_AUTH_FAILURE_MESSAGE,
				retryAfterSeconds,
			},
			429,
			retryAfterSeconds,
		);
	}

	const otpResult = await sendOtpRequest(env, normalizedEmail);
	if (!otpResult.ok) {
		await Promise.all([
			insertOtpRequestEvent(env, {
				requestId: context.requestId,
				emailNormalized: normalizedEmail,
				emailHash,
				ipHash,
				outcome: "failure",
				reason: "supabase_otp_request_failed",
			}),
			insertAuthAuditEvent(env, {
				requestId: context.requestId,
				eventType: "otp_request",
				status: "failure",
				emailNormalized: normalizedEmail,
				emailHash,
				details: { reason: "supabase_otp_request_failed" },
			}),
		]);
		return json(
			{ ok: true, message: GENERIC_AUTH_REQUEST_MESSAGE, resendAfterSeconds: OTP_RESEND_SECONDS },
			200,
		);
	}

	await Promise.all([
		insertOtpRequestEvent(env, {
			requestId: context.requestId,
			emailNormalized: normalizedEmail,
			emailHash,
			ipHash,
			outcome: "success",
		}),
		insertAuthAuditEvent(env, {
			requestId: context.requestId,
			eventType: "otp_request",
			status: "success",
			emailNormalized: normalizedEmail,
			emailHash,
		}),
	]);

	return json(
		{ ok: true, message: GENERIC_AUTH_REQUEST_MESSAGE, resendAfterSeconds: OTP_RESEND_SECONDS },
		200,
	);
};

export const handleOtpVerify = async (
	request: Request,
	env: WorkerEnv,
): Promise<Response> => {
	const context = createRequestContext(request);
	const body = sanitizeVerifyBody(await parseJsonBody<OtpVerifyBody>(request));
	if (!body || !isValidEmail(body.email) || !/^\d{6}$/.test(body.code)) {
		logWarn("auth_otp_verify_invalid", context);
		return json({ error: "auth_failed", message: GENERIC_AUTH_FAILURE_MESSAGE }, 400);
	}

	const normalizedEmail = normalizeEmail(body.email);
	const ipAddress = getRequestIpAddress(request);
	const [emailHash, ipHash] = await Promise.all([
		hashWithSalt(env.AUTH_IP_HASH_SALT, normalizedEmail),
		hashWithSalt(env.AUTH_IP_HASH_SALT, ipAddress),
	]);
	const nowMs = Date.now();

	try {
		await maybeCleanupAuthRetention(env);
	} catch (error) {
		logWarn("auth_cleanup_failed", context, {
			error: error instanceof Error ? error.message : String(error),
		});
	}

	let verifyState = await getVerifyState(env, emailHash);
	if (shouldResetFailedAttempts(verifyState, nowMs)) {
		await clearVerifyState(env, emailHash);
		verifyState = null;
	}

	if (
		verifyState?.lockedUntil &&
		verifyState.lockedUntil.getTime() > nowMs
	) {
		const retryAfterSeconds = toRetrySeconds(verifyState.lockedUntil, nowMs);
		return jsonWithRetryAfter(
			{
				error: "auth_failed",
				message: GENERIC_AUTH_FAILURE_MESSAGE,
				retryAfterSeconds,
			},
			429,
			retryAfterSeconds,
		);
	}

	if (
		verifyState?.cooldownUntil &&
		verifyState.cooldownUntil.getTime() > nowMs
	) {
		const retryAfterSeconds = toRetrySeconds(verifyState.cooldownUntil, nowMs);
		return jsonWithRetryAfter(
			{
				error: "auth_failed",
				message: GENERIC_AUTH_FAILURE_MESSAGE,
				retryAfterSeconds,
			},
			429,
			retryAfterSeconds,
		);
	}

	const result = await verifyOtpCode(env, normalizedEmail, body.code);
	if (result.ok) {
		await Promise.all([
			clearVerifyState(env, emailHash),
			insertOtpVerifyEvent(env, {
				requestId: context.requestId,
				emailNormalized: normalizedEmail,
				emailHash,
				ipHash,
				success: true,
			}),
			insertAuthAuditEvent(env, {
				requestId: context.requestId,
				eventType: "otp_verify",
				status: "success",
				emailNormalized: normalizedEmail,
				emailHash,
			}),
		]);
		return json({ session: result.session }, 200);
	}

	const resetWindowExceeded =
		!verifyState?.lastFailedAt ||
		nowMs - verifyState.lastFailedAt.getTime() >
			VERIFY_FAILURE_RESET_WINDOW_SECONDS * 1000;
	const priorAttempts = resetWindowExceeded ? 0 : (verifyState?.failedAttempts ?? 0);
	const nextAttempts = priorAttempts + 1;
	const nowDate = new Date(nowMs);
	const cooldownUntil = new Date(nowMs + OTP_VERIFY_COOLDOWN_SECONDS * 1000);
	const lockedUntil =
		nextAttempts >= OTP_VERIFY_LOCK_ATTEMPTS
			? new Date(nowMs + OTP_VERIFY_LOCK_SECONDS * 1000)
			: null;
	await Promise.all([
		upsertVerifyState(env, {
			emailHash,
			failedAttempts: nextAttempts,
			cooldownUntil,
			lockedUntil,
			lastFailedAt: nowDate,
		}),
		insertOtpVerifyEvent(env, {
			requestId: context.requestId,
			emailNormalized: normalizedEmail,
			emailHash,
			ipHash,
			success: false,
			reason: lockedUntil ? "locked" : "invalid_code",
		}),
		insertAuthAuditEvent(env, {
			requestId: context.requestId,
			eventType: "otp_verify",
			status: "failure",
			emailNormalized: normalizedEmail,
			emailHash,
			details: {
				reason: lockedUntil ? "locked" : "invalid_code",
				attempt: nextAttempts,
			},
		}),
	]);

	if (lockedUntil) {
		return jsonWithRetryAfter(
			{
				error: "auth_failed",
				message: GENERIC_AUTH_FAILURE_MESSAGE,
				retryAfterSeconds: OTP_VERIFY_LOCK_SECONDS,
			},
			429,
			OTP_VERIFY_LOCK_SECONDS,
		);
	}

	return jsonWithRetryAfter(
		{
			error: "auth_failed",
			message: GENERIC_AUTH_FAILURE_MESSAGE,
			retryAfterSeconds: OTP_VERIFY_COOLDOWN_SECONDS,
		},
		401,
		OTP_VERIFY_COOLDOWN_SECONDS,
	);
};

export const handleAuthSession = async (
	request: Request,
	env: WorkerEnv,
): Promise<Response> => {
	if (env.AUTH_BYPASS_ENABLED) {
		return json(
			{
				authenticated: true,
				session: {
					user: {
						id: "local-auth-bypass-user",
						email: "local-bypass@example.com",
					},
					expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
				},
			},
			200,
		);
	}

	const token = getBearerToken(request);
	if (!token) {
		return json({ authenticated: false }, 200);
	}

	const verified = await verifyAccessToken(env, token);
	if (!verified.ok) {
		return json({ authenticated: false }, 200);
	}

	return json(
		{
			authenticated: true,
			session: {
				user: {
					id: verified.value.userId,
					email: verified.value.email,
				},
				expiresAt: verified.value.expiresAt,
			},
		},
		200,
	);
};

export const handleAuthRefresh = async (
	request: Request,
	env: WorkerEnv,
): Promise<Response> => {
	const context = createRequestContext(request);
	const body = await parseJsonBody<RefreshBody>(request);
	const refreshToken =
		typeof body?.refreshToken === "string" ? body.refreshToken.trim() : "";
	if (!refreshToken) {
		return json({ error: "auth_failed", message: GENERIC_AUTH_FAILURE_MESSAGE }, 400);
	}

	const refreshed = await refreshSupabaseSession(env, refreshToken);
	if (!refreshed.ok) {
		await insertAuthAuditEvent(env, {
			requestId: context.requestId,
			eventType: "refresh_failure",
			status: "failure",
		});
		return json({ error: "auth_failed", message: GENERIC_AUTH_FAILURE_MESSAGE }, 401);
	}

	return json({ session: refreshed.session }, 200);
};

export const handleAuthSignOut = async (
	request: Request,
	env: WorkerEnv,
): Promise<Response> => {
	const context = createRequestContext(request);
	const body = await parseJsonBody<SignOutBody>(request);
	const token = getBearerToken(request);

	if (token) {
		const signOutOk = await signOutSupabaseSession(env, token);
		await insertAuthAuditEvent(env, {
			requestId: context.requestId,
			eventType: "signout",
			status: signOutOk ? "success" : "failure",
		});
		return json({ success: true }, 200);
	}

	if (typeof body?.refreshToken !== "string" || body.refreshToken.trim().length === 0) {
		await insertAuthAuditEvent(env, {
			requestId: context.requestId,
			eventType: "signout",
			status: "failure",
			details: { reason: "missing_tokens" },
		});
		return json({ success: true }, 200);
	}

	if (env.AUTH_BYPASS_ENABLED) {
		await insertAuthAuditEvent(env, {
			requestId: context.requestId,
			eventType: "signout",
			status: "success",
		});
		return json({ success: true }, 200);
	}

	// Supabase local sign-out requires an access token; clear locally even when remote revoke is unavailable.
	logWarn("auth_signout_without_access_token", context);
	await insertAuthAuditEvent(env, {
		requestId: context.requestId,
		eventType: "signout",
		status: "success",
		details: { remoteRevocation: false },
	});
	return json({ success: true }, 200);
};

export const requireAuthenticatedRequest = async (
	request: Request,
	env: WorkerEnv,
): Promise<{ ok: true } | { ok: false; response: Response }> => {
	if (env.AUTH_BYPASS_ENABLED) {
		return { ok: true };
	}

	const token = getBearerToken(request);
	if (!token) {
		return {
			ok: false,
			response: json({ error: "unauthorized", message: GENERIC_AUTH_FAILURE_MESSAGE }, 401),
		};
	}

	const verified = await verifyAccessToken(env, token);
	if (!verified.ok) {
		return {
			ok: false,
			response: json({ error: "unauthorized", message: GENERIC_AUTH_FAILURE_MESSAGE }, 401),
		};
	}

	return { ok: true };
};
