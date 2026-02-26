import type { WorkerEnv } from "../env";
import type { AuthSessionPayload } from "./types";

interface SupabaseUserShape {
	id?: unknown;
	email?: unknown;
}

interface SupabaseSessionShape {
	access_token?: unknown;
	refresh_token?: unknown;
	expires_in?: unknown;
	expires_at?: unknown;
	user?: SupabaseUserShape;
}

interface SupabaseVerifyResponse {
	session?: SupabaseSessionShape;
	user?: SupabaseUserShape;
}

const normalizeSessionPayload = (
	rawSession: SupabaseSessionShape,
	rawUser: SupabaseUserShape | undefined,
	fallbackEmail: string,
): AuthSessionPayload | null => {
	const accessToken =
		typeof rawSession.access_token === "string"
			? rawSession.access_token
			: null;
	const refreshToken =
		typeof rawSession.refresh_token === "string"
			? rawSession.refresh_token
			: null;
	if (!accessToken || !refreshToken) {
		return null;
	}

	const userId =
		typeof rawSession.user?.id === "string"
			? rawSession.user.id
			: typeof rawUser?.id === "string"
				? rawUser.id
				: "";
	if (!userId) {
		return null;
	}

	const nowSeconds = Math.floor(Date.now() / 1000);
	const expiresAtRaw =
		typeof rawSession.expires_at === "number" ? rawSession.expires_at : null;
	const expiresInRaw =
		typeof rawSession.expires_in === "number" ? rawSession.expires_in : null;
	const expiresAt =
		typeof expiresAtRaw === "number" && Number.isFinite(expiresAtRaw)
			? Math.floor(expiresAtRaw)
			: nowSeconds + Math.max(0, Math.floor(expiresInRaw ?? 0));

	const sessionEmail =
		typeof rawSession.user?.email === "string"
			? rawSession.user.email
			: typeof rawUser?.email === "string"
				? rawUser.email
				: fallbackEmail;

	return {
		accessToken,
		refreshToken,
		expiresAt,
		user: {
			id: userId,
			email: sessionEmail || null,
		},
	};
};

const authHeaders = (env: WorkerEnv): HeadersInit => ({
	apikey: env.SUPABASE_ANON_KEY,
	"content-type": "application/json",
});

const readJson = async (response: Response): Promise<unknown> => {
	try {
		return (await response.json()) as unknown;
	} catch {
		return null;
	}
};

export const sendOtpRequest = async (
	env: WorkerEnv,
	normalizedEmail: string,
): Promise<{ ok: true } | { ok: false }> => {
	const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/otp`, {
		method: "POST",
		headers: authHeaders(env),
		body: JSON.stringify({
			email: normalizedEmail,
			create_user: true,
		}),
	});

	if (!response.ok) {
		await readJson(response);
		return { ok: false };
	}

	return { ok: true };
};

export const verifyOtpCode = async (
	env: WorkerEnv,
	normalizedEmail: string,
	token: string,
): Promise<{ ok: true; session: AuthSessionPayload } | { ok: false }> => {
	const response = await fetch(
		`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/verify`,
		{
			method: "POST",
			headers: authHeaders(env),
			body: JSON.stringify({
				email: normalizedEmail,
				token,
				type: "email",
			}),
		},
	);

	const payload = (await readJson(response)) as SupabaseSessionShape | SupabaseVerifyResponse | null;
	if (!response.ok || !payload || typeof payload !== "object") {
		return { ok: false };
	}

	const rootSession = payload as SupabaseSessionShape;
	const nested = payload as SupabaseVerifyResponse;
	const session =
		typeof rootSession.access_token === "string"
			? normalizeSessionPayload(rootSession, nested.user, normalizedEmail)
			: nested.session
				? normalizeSessionPayload(nested.session, nested.user, normalizedEmail)
				: null;
	if (!session) {
		return { ok: false };
	}

	return { ok: true, session };
};

export const refreshSupabaseSession = async (
	env: WorkerEnv,
	refreshToken: string,
): Promise<{ ok: true; session: AuthSessionPayload } | { ok: false }> => {
	const response = await fetch(
		`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=refresh_token`,
		{
			method: "POST",
			headers: authHeaders(env),
			body: JSON.stringify({ refresh_token: refreshToken }),
		},
	);

	const payload = (await readJson(response)) as SupabaseSessionShape | { session?: SupabaseSessionShape } | null;
	if (!response.ok || !payload || typeof payload !== "object") {
		return { ok: false };
	}

	const rootSession = payload as SupabaseSessionShape;
	const nestedSession = (payload as { session?: SupabaseSessionShape }).session;
	const session =
		typeof rootSession.access_token === "string"
			? normalizeSessionPayload(rootSession, undefined, "")
			: nestedSession
				? normalizeSessionPayload(nestedSession, undefined, "")
				: null;
	if (!session) {
		return { ok: false };
	}

	return { ok: true, session };
};

export const signOutSupabaseSession = async (
	env: WorkerEnv,
	accessToken: string,
): Promise<boolean> => {
	const response = await fetch(
		`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/logout?scope=local`,
		{
			method: "POST",
			headers: {
				...authHeaders(env),
				authorization: `Bearer ${accessToken}`,
			},
		},
	);

	if (!response.ok) {
		await readJson(response);
		return false;
	}

	return true;
};
