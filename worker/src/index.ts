import { parseWorkerEnv } from "./env";
import { handleChatRequest } from "./chat/handler";
import { runSqlAgent } from "./chat/sqlAgent";

export interface Env {
	HYPERDRIVE?: {
		connectionString?: string;
	};
	OPENAI_API_KEY?: string;
	SUPABASE_DB_URL?: string;
	SUPABASE_DB_SSL_NO_VERIFY?: string;
	LLM_MODEL?: string;
	SQL_QUERY_TIMEOUT_MS?: string;
	EXPOSE_ERROR_DETAILS?: string;
}

const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});

export const handleFetch = async (
	request: Request,
	env: Env,
): Promise<Response> => {
	const url = new URL(request.url);

	if (url.pathname === "/api/chat" && request.method === "POST") {
		const envResult = parseWorkerEnv({
			OPENAI_API_KEY: env.OPENAI_API_KEY,
			SUPABASE_DB_URL: env.HYPERDRIVE?.connectionString ?? env.SUPABASE_DB_URL,
			SUPABASE_DB_SSL_NO_VERIFY: env.SUPABASE_DB_SSL_NO_VERIFY,
			LLM_MODEL: env.LLM_MODEL,
			SQL_QUERY_TIMEOUT_MS: env.SQL_QUERY_TIMEOUT_MS,
			EXPOSE_ERROR_DETAILS: env.EXPOSE_ERROR_DETAILS,
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

		return handleChatRequest(request, runSqlAgent, envResult.value);
	}

	return json({ error: "not_found" }, 404);
};

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		return handleFetch(request, env);
	},
};
