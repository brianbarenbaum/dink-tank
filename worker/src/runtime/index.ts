import {
	handleAuthRefresh,
	handleAuthSession,
	handleAuthSignOut,
	handleOtpRequest,
	handleOtpVerify,
	requireAuthenticatedRequest,
} from "./auth/handler";
import {
	buildPreflightResponse,
	isAllowedOrigin,
	json,
	withApiResponseHeaders,
} from "./auth/http";
import { parseWorkerEnv } from "./env";
import { handleChatRequest } from "./handler";
import {
	handleLineupLabDivisionsRequest,
	handleLineupLabMatchupsRequest,
	handleLineupLabTeamsRequest,
} from "./lineupLab/contextHandler";
import { handleLineupLabRecommendRequest } from "./lineupLab/handler";
import { runLineupLabRecommend } from "./lineupLab/service";
import { runSqlAgent } from "./sqlAgent";

export interface Env {
	HYPERDRIVE?: {
		connectionString?: string;
	};
	OPENAI_API_KEY?: string;
	SUPABASE_DB_URL?: string;
	SUPABASE_DB_SSL_NO_VERIFY?: string;
	SUPABASE_URL?: string;
	SUPABASE_ANON_KEY?: string;
	APP_ENV?: string;
	ENVIRONMENT?: string;
	AUTH_ALLOWED_ORIGINS?: string;
	AUTH_JWT_ISSUER?: string;
	AUTH_JWT_AUDIENCE?: string;
	AUTH_BYPASS_ENABLED?: string;
	AUTH_TURNSTILE_BYPASS?: string;
	AUTH_TURNSTILE_SECRET?: string;
	AUTH_IP_HASH_SALT?: string;
	LLM_MODEL?: string;
	LLM_REASONING_LEVEL?: string;
	SQL_QUERY_TIMEOUT_MS?: string;
	SQL_CAPTURE_EXPLAIN_PLAN?: string;
	EXPOSE_ERROR_DETAILS?: string;
	LANGFUSE_PUBLIC_KEY?: string;
	LANGFUSE_SECRET_KEY?: string;
	LANGFUSE_BASE_URL?: string;
	LANGFUSE_TRACING_ENVIRONMENT?: string;
	LINEUP_ENABLE_DUPR_BLEND?: string;
	LINEUP_DUPR_MAJOR_WEIGHT?: string;
	LINEUP_ENABLE_TEAM_STRENGTH_ADJUSTMENT?: string;
	LINEUP_DUPR_SLOPE?: string;
	LINEUP_TEAM_STRENGTH_FACTOR?: string;
	LINEUP_TEAM_STRENGTH_CAP?: string;
}

const isAuthRoute = (request: Request, pathname: string): boolean =>
	(pathname === "/api/auth/otp/request" && request.method === "POST") ||
	(pathname === "/api/auth/otp/verify" && request.method === "POST") ||
	(pathname === "/api/auth/session" && request.method === "GET") ||
	(pathname === "/api/auth/signout" && request.method === "POST") ||
	(pathname === "/api/auth/refresh" && request.method === "POST");

const isChatRoute = (request: Request, pathname: string): boolean =>
	(pathname === "/api/chat" && request.method === "POST") ||
	(pathname === "/api/chat/config" && request.method === "GET");

const isLineupRoute = (request: Request, pathname: string): boolean =>
	(pathname === "/api/lineup-lab/recommend" && request.method === "POST") ||
	(pathname === "/api/lineup-lab/context/divisions" && request.method === "GET") ||
	(pathname === "/api/lineup-lab/context/teams" && request.method === "GET") ||
	(pathname === "/api/lineup-lab/context/matchups" && request.method === "GET");

const isKnownApiRoute = (request: Request, pathname: string): boolean =>
	isAuthRoute(request, pathname) ||
	isChatRoute(request, pathname) ||
	isLineupRoute(request, pathname);

/**
 * Routes incoming Worker requests and dispatches runtime handlers.
 */
export const handleFetch = async (
	request: Request,
	env: Env,
): Promise<Response> => {
	const url = new URL(request.url);
	const isApiPath = url.pathname.startsWith("/api/");

	const envResult = parseWorkerEnv({
		OPENAI_API_KEY: env.OPENAI_API_KEY,
		SUPABASE_DB_URL: env.HYPERDRIVE?.connectionString ?? env.SUPABASE_DB_URL,
		SUPABASE_DB_SSL_NO_VERIFY: env.SUPABASE_DB_SSL_NO_VERIFY,
		SUPABASE_URL: env.SUPABASE_URL,
		SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
		APP_ENV: env.APP_ENV,
		ENVIRONMENT: env.ENVIRONMENT,
		AUTH_ALLOWED_ORIGINS: env.AUTH_ALLOWED_ORIGINS,
		AUTH_JWT_ISSUER: env.AUTH_JWT_ISSUER,
		AUTH_JWT_AUDIENCE: env.AUTH_JWT_AUDIENCE,
		AUTH_BYPASS_ENABLED: env.AUTH_BYPASS_ENABLED,
		AUTH_TURNSTILE_BYPASS: env.AUTH_TURNSTILE_BYPASS,
		AUTH_TURNSTILE_SECRET: env.AUTH_TURNSTILE_SECRET,
		AUTH_IP_HASH_SALT: env.AUTH_IP_HASH_SALT,
		LLM_MODEL: env.LLM_MODEL,
		LLM_REASONING_LEVEL: env.LLM_REASONING_LEVEL,
		SQL_QUERY_TIMEOUT_MS: env.SQL_QUERY_TIMEOUT_MS,
		SQL_CAPTURE_EXPLAIN_PLAN: env.SQL_CAPTURE_EXPLAIN_PLAN,
		EXPOSE_ERROR_DETAILS: env.EXPOSE_ERROR_DETAILS,
		LANGFUSE_PUBLIC_KEY: env.LANGFUSE_PUBLIC_KEY,
		LANGFUSE_SECRET_KEY: env.LANGFUSE_SECRET_KEY,
		LANGFUSE_BASE_URL: env.LANGFUSE_BASE_URL,
		LANGFUSE_TRACING_ENVIRONMENT: env.LANGFUSE_TRACING_ENVIRONMENT,
		LINEUP_ENABLE_DUPR_BLEND: env.LINEUP_ENABLE_DUPR_BLEND,
		LINEUP_DUPR_MAJOR_WEIGHT: env.LINEUP_DUPR_MAJOR_WEIGHT,
		LINEUP_ENABLE_TEAM_STRENGTH_ADJUSTMENT:
			env.LINEUP_ENABLE_TEAM_STRENGTH_ADJUSTMENT,
		LINEUP_DUPR_SLOPE: env.LINEUP_DUPR_SLOPE,
		LINEUP_TEAM_STRENGTH_FACTOR: env.LINEUP_TEAM_STRENGTH_FACTOR,
		LINEUP_TEAM_STRENGTH_CAP: env.LINEUP_TEAM_STRENGTH_CAP,
	});
	if (!envResult.ok) {
		return json(
			{
				error: "misconfigured_env",
				message: envResult.error,
			},
			500,
		);
	}

	const origin = request.headers.get("origin") ?? undefined;
	const allowOrigin = origin
		? isAllowedOrigin(origin, envResult.value.AUTH_ALLOWED_ORIGINS)
		: false;

	if (request.method === "OPTIONS" && isApiPath) {
		return buildPreflightResponse({ origin, allowOrigin });
	}

	if (origin && !allowOrigin) {
		return withApiResponseHeaders(
			json({ error: "forbidden_origin" }, 403),
			{ origin, allowOrigin: false, noStore: true },
		);
	}

	if (!isApiPath || !isKnownApiRoute(request, url.pathname)) {
		return withApiResponseHeaders(json({ error: "not_found" }, 404), {
			origin,
			allowOrigin,
			noStore: true,
		});
	}

	if (!isAuthRoute(request, url.pathname)) {
		const authResult = await requireAuthenticatedRequest(request, envResult.value);
		if (!authResult.ok) {
			return withApiResponseHeaders(authResult.response, {
				origin,
				allowOrigin,
				noStore: true,
			});
		}
	}

	let response: Response;
	if (url.pathname === "/api/auth/otp/request" && request.method === "POST") {
		response = await handleOtpRequest(request, envResult.value);
	} else if (
		url.pathname === "/api/auth/otp/verify" &&
		request.method === "POST"
	) {
		response = await handleOtpVerify(request, envResult.value);
	} else if (
		url.pathname === "/api/auth/session" &&
		request.method === "GET"
	) {
		response = await handleAuthSession(request, envResult.value);
	} else if (
		url.pathname === "/api/auth/signout" &&
		request.method === "POST"
	) {
		response = await handleAuthSignOut(request, envResult.value);
	} else if (
		url.pathname === "/api/auth/refresh" &&
		request.method === "POST"
	) {
		response = await handleAuthRefresh(request, envResult.value);
	} else if (
		url.pathname === "/api/chat/config" &&
		request.method === "GET"
	) {
		response = json(
			{
				model: envResult.value.LLM_MODEL,
				defaultReasoningLevel: envResult.value.LLM_REASONING_LEVEL,
			},
			200,
		);
	} else if (url.pathname === "/api/chat" && request.method === "POST") {
		response = await handleChatRequest(request, runSqlAgent, envResult.value);
	} else if (
		url.pathname === "/api/lineup-lab/recommend" &&
		request.method === "POST"
	) {
		response = await handleLineupLabRecommendRequest(
			request,
			runLineupLabRecommend,
			envResult.value,
		);
	} else if (
		url.pathname === "/api/lineup-lab/context/divisions" &&
		request.method === "GET"
	) {
		response = await handleLineupLabDivisionsRequest(request, envResult.value);
	} else if (
		url.pathname === "/api/lineup-lab/context/teams" &&
		request.method === "GET"
	) {
		response = await handleLineupLabTeamsRequest(request, envResult.value);
	} else if (
		url.pathname === "/api/lineup-lab/context/matchups" &&
		request.method === "GET"
	) {
		response = await handleLineupLabMatchupsRequest(request, envResult.value);
	} else {
		response = json({ error: "not_found" }, 404);
	}

	return withApiResponseHeaders(response, {
		origin,
		allowOrigin,
		noStore: true,
	});
};

export default {
	/**
	 * Cloudflare Worker fetch handler entrypoint.
	 */
	async fetch(request: Request, env: Env): Promise<Response> {
		return handleFetch(request, env);
	},
};
