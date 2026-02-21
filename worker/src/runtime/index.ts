import { parseWorkerEnv } from "./env";
import { handleChatRequest } from "./handler";
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
	LLM_MODEL?: string;
	LLM_REASONING_LEVEL?: string;
	SQL_QUERY_TIMEOUT_MS?: string;
	SQL_CAPTURE_EXPLAIN_PLAN?: string;
	EXPOSE_ERROR_DETAILS?: string;
	LANGFUSE_PUBLIC_KEY?: string;
	LANGFUSE_SECRET_KEY?: string;
	LANGFUSE_BASE_URL?: string;
	LANGFUSE_TRACING_ENVIRONMENT?: string;
}

/**
 * Builds a JSON response with a consistent content-type header.
 */
const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});

/**
 * Routes incoming Worker requests and dispatches chat requests through the runtime pipeline.
 */
export const handleFetch = async (
	request: Request,
	env: Env,
): Promise<Response> => {
	const url = new URL(request.url);
	const isChatRoute =
		(url.pathname === "/api/chat" && request.method === "POST") ||
		(url.pathname === "/api/chat/config" && request.method === "GET");
	const isLineupLabRoute =
		url.pathname === "/api/lineup-lab/recommend" && request.method === "POST";
	if (!isChatRoute && !isLineupLabRoute) {
		return json({ error: "not_found" }, 404);
	}

	const envResult = parseWorkerEnv({
		OPENAI_API_KEY: env.OPENAI_API_KEY,
		SUPABASE_DB_URL: env.HYPERDRIVE?.connectionString ?? env.SUPABASE_DB_URL,
		SUPABASE_DB_SSL_NO_VERIFY: env.SUPABASE_DB_SSL_NO_VERIFY,
		LLM_MODEL: env.LLM_MODEL,
		LLM_REASONING_LEVEL: env.LLM_REASONING_LEVEL,
		SQL_QUERY_TIMEOUT_MS: env.SQL_QUERY_TIMEOUT_MS,
		SQL_CAPTURE_EXPLAIN_PLAN: env.SQL_CAPTURE_EXPLAIN_PLAN,
		EXPOSE_ERROR_DETAILS: env.EXPOSE_ERROR_DETAILS,
		LANGFUSE_PUBLIC_KEY: env.LANGFUSE_PUBLIC_KEY,
		LANGFUSE_SECRET_KEY: env.LANGFUSE_SECRET_KEY,
		LANGFUSE_BASE_URL: env.LANGFUSE_BASE_URL,
		LANGFUSE_TRACING_ENVIRONMENT: env.LANGFUSE_TRACING_ENVIRONMENT,
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

	if (url.pathname === "/api/chat/config" && request.method === "GET") {
		return json(
			{
				model: envResult.value.LLM_MODEL,
				defaultReasoningLevel: envResult.value.LLM_REASONING_LEVEL,
			},
			200,
		);
	}

	if (url.pathname === "/api/chat" && request.method === "POST") {
		return handleChatRequest(request, runSqlAgent, envResult.value);
	}
	if (url.pathname === "/api/lineup-lab/recommend" && request.method === "POST") {
		return handleLineupLabRecommendRequest(
			request,
			runLineupLabRecommend,
			envResult.value,
		);
	}

	return json({ error: "not_found" }, 404);
};

export default {
	/**
	 * Cloudflare Worker fetch handler entrypoint.
	 */
	async fetch(request: Request, env: Env): Promise<Response> {
		return handleFetch(request, env);
	},
};
