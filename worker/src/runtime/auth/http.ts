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
