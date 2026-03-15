import type {
	AuthSession,
	LoginStartResult,
	OtpRequestResult,
	SessionCheckResult,
} from "./types";

interface StartLoginInput {
	email: string;
}

interface RequestOtpInput {
	email: string;
	turnstileToken: string | null;
	inviteCode?: string | null;
}

interface VerifyOtpInput {
	email: string;
	code: string;
}

interface AuthClient {
	startLogin(input: StartLoginInput): Promise<LoginStartResult>;
	requestOtp(input: RequestOtpInput): Promise<OtpRequestResult>;
	verifyOtp(input: VerifyOtpInput): Promise<AuthSession>;
	getSession(): Promise<SessionCheckResult>;
	refresh(): Promise<AuthSession>;
	signOut(): Promise<void>;
}

const parseJson = async <T>(response: Response): Promise<T> =>
	(await response.json()) as T;

const normalizeLoginStart = (payload: unknown): LoginStartResult => {
	if (!payload || typeof payload !== "object") {
		throw new Error("Invalid login-start payload");
	}
	const value = payload as { status?: unknown };
	if (value.status !== "approved" && value.status !== "invite_required") {
		throw new Error("Invalid login-start payload");
	}
	return { status: value.status };
};

const normalizeSession = (session: unknown): AuthSession => {
	if (!session || typeof session !== "object") {
		throw new Error("Invalid session payload");
	}
	const value = session as {
		expiresAt?: unknown;
		user?: { id?: unknown; email?: unknown };
	};
	if (
		typeof value.expiresAt !== "number" ||
		typeof value.user?.id !== "string"
	) {
		throw new Error("Invalid session payload");
	}

	return {
		expiresAt: value.expiresAt,
		user: {
			id: value.user.id,
			email: typeof value.user.email === "string" ? value.user.email : null,
		},
	};
};

export const createAuthClient = (fetchImpl: typeof fetch): AuthClient => ({
	async startLogin(input) {
		const response = await fetchImpl("/api/auth/login/start", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify(input),
		});
		const payload = await parseJson<unknown>(response);
		if (!response.ok) {
			throw new Error("login_start_failed");
		}
		return normalizeLoginStart(payload);
	},
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
			status: "otp_sent",
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
	async getSession() {
		const response = await fetchImpl("/api/auth/session", {
			method: "GET",
			headers: {
				"content-type": "application/json",
			},
		});
		if (!response.ok) {
			throw new Error("session_failed");
		}
		return parseJson<SessionCheckResult>(response);
	},
	async refresh() {
		const response = await fetchImpl("/api/auth/refresh", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
		});
		const payload = await parseJson<{ session?: unknown }>(response);
		if (!response.ok || !payload.session) {
			throw new Error("refresh_failed");
		}
		return normalizeSession(payload.session);
	},
	async signOut() {
		await fetchImpl("/api/auth/signout", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
		});
	},
});
