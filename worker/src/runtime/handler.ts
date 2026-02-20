import type { WorkerEnv } from "./env";
import { createRequestContext, type RequestContext } from "./requestContext";
import { logError, logWarn } from "./runtimeLogger";
import { isSqlSafetyError } from "./sql/sqlErrors";
import { parseChatRequest } from "./validation";

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
 * Validates request input, executes the chat agent, and maps runtime failures to HTTP responses.
 */
export const handleChatRequest = async (
	request: Request,
	runAgent: (
		env: WorkerEnv,
		messages: Array<{ role: "user" | "assistant"; content: string }>,
		context: RequestContext,
	) => Promise<string>,
	env?: WorkerEnv,
): Promise<Response> => {
	const context = createRequestContext(request);
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		logWarn("invalid_json", context);
		return json({ error: "invalid_json" }, 400);
	}

	const parsed = parseChatRequest(payload);
	if (!parsed.ok) {
		logWarn("invalid_request", context, { reason: parsed.error });
		return json({ error: "invalid_request", message: parsed.error }, 400);
	}

	if (!env) {
		logError("misconfigured_env", context);
		return json({ error: "misconfigured_env" }, 500);
	}

	try {
		const reply = await runAgent(env, parsed.value.messages, context);
		return json({ reply }, 200);
	} catch (error) {
		logError("chat_request_failed", context, {
			error:
				error instanceof Error
					? { name: error.name, message: error.message }
					: String(error),
		});

		if (isSqlSafetyError(error)) {
			return json(
				{
					error: "query_blocked",
					message: "Only read-only SQL queries are permitted.",
				},
				422,
			);
		}

		const message =
			env.EXPOSE_ERROR_DETAILS && error instanceof Error
				? error.message
				: "Unable to process request.";
		return json({ error: "chat_failed", message }, 500);
	}
};
