import type { AuthSession, SessionCheckResult } from "./types";

interface RequestOtpInput {
	email: string;
	turnstileToken: string | null;
}

interface VerifyOtpInput {
	email: string;
	code: string;
}

interface RefreshInput {
	refreshToken: string;
}

interface SignOutInput {
	accessToken: string | null;
	refreshToken: string | null;
}

interface AuthClient {
	requestOtp(input: RequestOtpInput): Promise<{ resendAfterSeconds: number }>;
	verifyOtp(input: VerifyOtpInput): Promise<AuthSession>;
	getSession(accessToken: string | null): Promise<SessionCheckResult>;
	refresh(input: RefreshInput): Promise<AuthSession>;
	signOut(input: SignOutInput): Promise<void>;
}

const parseJson = async <T>(response: Response): Promise<T> =>
	(await response.json()) as T;

const normalizeSession = (session: unknown): AuthSession => {
	if (!session || typeof session !== "object") {
		throw new Error("Invalid session payload");
	}
	const value = session as {
		accessToken?: unknown;
		refreshToken?: unknown;
		expiresAt?: unknown;
		user?: { id?: unknown; email?: unknown };
	};
	if (
		typeof value.accessToken !== "string" ||
		typeof value.refreshToken !== "string" ||
		typeof value.expiresAt !== "number" ||
		typeof value.user?.id !== "string"
	) {
		throw new Error("Invalid session payload");
	}

	return {
		accessToken: value.accessToken,
		refreshToken: value.refreshToken,
		expiresAt: value.expiresAt,
		user: {
			id: value.user.id,
			email: typeof value.user.email === "string" ? value.user.email : null,
		},
	};
};

export const createAuthClient = (fetchImpl: typeof fetch): AuthClient => ({
	async requestOtp(input) {
		const response = await fetchImpl("/api/auth/otp/request", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify(input),
		});
		const payload = await parseJson<{
			resendAfterSeconds?: number;
			retryAfterSeconds?: number;
		}>(response);

		if (!response.ok && response.status !== 200) {
			if (typeof payload.retryAfterSeconds === "number") {
				throw new Error(`retry_after:${payload.retryAfterSeconds}`);
			}
			throw new Error("otp_request_failed");
		}

		return {
			resendAfterSeconds:
				typeof payload.resendAfterSeconds === "number"
					? payload.resendAfterSeconds
					: 60,
		};
	},
	async verifyOtp(input) {
		const response = await fetchImpl("/api/auth/otp/verify", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify(input),
		});
		const payload = await parseJson<{
			session?: unknown;
			retryAfterSeconds?: number;
		}>(response);

		if (!response.ok || !payload.session) {
			if (typeof payload.retryAfterSeconds === "number") {
				throw new Error(`retry_after:${payload.retryAfterSeconds}`);
			}
			throw new Error("otp_verify_failed");
		}

		return normalizeSession(payload.session);
	},
	async getSession(accessToken) {
		const response = await fetchImpl("/api/auth/session", {
			method: "GET",
			headers: {
				"content-type": "application/json",
				...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
			},
		});
		if (!response.ok) {
			throw new Error("session_failed");
		}
		return parseJson<SessionCheckResult>(response);
	},
	async refresh(input) {
		const response = await fetchImpl("/api/auth/refresh", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify(input),
		});
		const payload = await parseJson<{ session?: unknown }>(response);
		if (!response.ok || !payload.session) {
			throw new Error("refresh_failed");
		}
		return normalizeSession(payload.session);
	},
	async signOut(input) {
		await fetchImpl("/api/auth/signout", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				...(input.accessToken
					? { authorization: `Bearer ${input.accessToken}` }
					: {}),
			},
			body: JSON.stringify({ refreshToken: input.refreshToken }),
		});
	},
});
