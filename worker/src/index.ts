import { parseWorkerEnv } from "./env";
import { handleChatRequest } from "./chat/handler";
import { runSqlAgent } from "./chat/sqlAgent";

export interface Env {
	OPENAI_API_KEY?: string;
	SUPABASE_DB_URL?: string;
	LLM_MODEL?: string;
	SQL_QUERY_TIMEOUT_MS?: string;
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
			SUPABASE_DB_URL: env.SUPABASE_DB_URL,
			LLM_MODEL: env.LLM_MODEL,
			SQL_QUERY_TIMEOUT_MS: env.SQL_QUERY_TIMEOUT_MS,
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
