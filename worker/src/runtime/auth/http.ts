import type { WorkerEnv } from "../env";

const ACCESS_TOKEN_COOKIE = "dink_tank_access_token";
const REFRESH_TOKEN_COOKIE = "dink_tank_refresh_token";
const HSTS_HEADER_VALUE = "max-age=31536000; includeSubDomains";

export const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});

export const getBearerToken = (request: Request): string | null => {
	const authHeader = request.headers.get("authorization");
	if (!authHeader) {
		return null;
	}
	const [scheme, token] = authHeader.split(" ");
	if (scheme !== "Bearer" || !token) {
		return null;
	}
	return token.trim() || null;
};

const parseCookieHeader = (request: Request): Map<string, string> => {
	const cookieHeader = request.headers.get("cookie");
	const cookies = new Map<string, string>();
	if (!cookieHeader) {
		return cookies;
	}
	for (const part of cookieHeader.split(";")) {
		const [rawName, ...rawValueParts] = part.split("=");
		const name = rawName?.trim();
		if (!name) {
			continue;
		}
		const value = rawValueParts.join("=").trim();
		if (!value) {
			continue;
		}
		cookies.set(name, decodeURIComponent(value));
	}
	return cookies;
};

export const getAccessTokenFromRequest = (request: Request): string | null =>
	getBearerToken(request) ?? parseCookieHeader(request).get(ACCESS_TOKEN_COOKIE) ?? null;

export const getRefreshTokenFromRequest = (request: Request): string | null =>
	parseCookieHeader(request).get(REFRESH_TOKEN_COOKIE) ?? null;

const buildCookie = (params: {
	name: string;
	value: string;
	maxAge: number;
	httpOnly?: boolean;
	sameSite?: "Lax" | "Strict" | "None";
	path?: string;
	secure?: boolean;
}): string => {
	const segments = [
		`${params.name}=${encodeURIComponent(params.value)}`,
		`Path=${params.path ?? "/"}`,
		`Max-Age=${Math.max(0, Math.floor(params.maxAge))}`,
		`SameSite=${params.sameSite ?? "Lax"}`,
	];
	if (params.httpOnly ?? true) {
		segments.push("HttpOnly");
	}
	if (params.secure) {
		segments.push("Secure");
	}
	return segments.join("; ");
};

const shouldUseSecureCookies = (env: WorkerEnv): boolean => env.APP_ENV !== "local";

export const appendAuthCookies = (
	response: Response,
	env: WorkerEnv,
	input: {
		accessToken: string;
		refreshToken: string;
		accessTokenExpiresAt: number;
	},
): Response => {
	const headers = new Headers(response.headers);
	const now = Math.floor(Date.now() / 1000);
	const accessMaxAge = Math.max(0, input.accessTokenExpiresAt - now);
	const secure = shouldUseSecureCookies(env);
	headers.append(
		"set-cookie",
		buildCookie({
			name: ACCESS_TOKEN_COOKIE,
			value: input.accessToken,
			maxAge: accessMaxAge,
			secure,
		}),
	);
	headers.append(
		"set-cookie",
		buildCookie({
			name: REFRESH_TOKEN_COOKIE,
			value: input.refreshToken,
			maxAge: 60 * 60 * 24 * 30,
			secure,
		}),
	);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
};

export const clearAuthCookies = (
	response: Response,
	env: WorkerEnv,
): Response => {
	const headers = new Headers(response.headers);
	const secure = shouldUseSecureCookies(env);
	for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]) {
		headers.append(
			"set-cookie",
			buildCookie({
				name,
				value: "",
				maxAge: 0,
				secure,
			}),
		);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
};

export const isAllowedOrigin = (
	origin: string,
	allowedOrigins: readonly string[],
): boolean => allowedOrigins.includes(origin);

const appendVary = (headers: Headers, value: string): void => {
	const existing = headers.get("vary");
	if (!existing) {
		headers.set("vary", value);
		return;
	}
	if (
		existing
			.split(",")
			.map((item) => item.trim().toLowerCase())
			.includes(value.toLowerCase())
	) {
		return;
	}
	headers.set("vary", `${existing}, ${value}`);
};

export const withApiResponseHeaders = (
	response: Response,
	input: {
		origin?: string;
		allowOrigin?: boolean;
		noStore?: boolean;
	},
): Response => {
	const headers = new Headers(response.headers);
	headers.set("x-content-type-options", "nosniff");
	headers.set("x-frame-options", "DENY");
	headers.set("referrer-policy", "strict-origin-when-cross-origin");
	headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
	headers.set("strict-transport-security", HSTS_HEADER_VALUE);
	if (input.noStore) {
		headers.set("cache-control", "no-store");
	}

	if (input.origin && input.allowOrigin) {
		headers.set("access-control-allow-origin", input.origin);
		headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
		headers.set("access-control-allow-headers", "content-type,authorization");
		headers.set("access-control-max-age", "600");
		appendVary(headers, "Origin");
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
};

export const buildPreflightResponse = (input: {
	origin?: string;
	allowOrigin?: boolean;
}): Response => {
	const status = input.origin && !input.allowOrigin ? 403 : 204;
	return withApiResponseHeaders(new Response(null, { status }), {
		origin: input.origin,
		allowOrigin: input.allowOrigin,
		noStore: true,
	});
};
