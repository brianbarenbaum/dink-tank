import type { WorkerEnv } from "../env";
import { parseChatRequest } from "./validation";

const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});

const isSqlSafetyError = (error: unknown): boolean => {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message.toLowerCase();
	return (
		message.includes("read-only") ||
		message.includes("write or ddl") ||
		message.includes("blocked")
	);
};

export const handleChatRequest = async (
	request: Request,
	runAgent: (
		env: WorkerEnv,
		messages: Array<{ role: "user" | "assistant"; content: string }>,
	) => Promise<string>,
	env?: WorkerEnv,
): Promise<Response> => {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ error: "invalid_json" }, 400);
	}

	const parsed = parseChatRequest(payload);
	if (!parsed.ok) {
		return json({ error: "invalid_request", message: parsed.error }, 400);
	}

	if (!env) {
		return json({ error: "misconfigured_env" }, 500);
	}

	try {
		const reply = await runAgent(env, parsed.value.messages);
		return json({ reply }, 200);
	} catch (error) {
		if (isSqlSafetyError(error)) {
			return json(
				{
					error: "query_blocked",
					message: "Only read-only SQL queries are permitted.",
				},
				422,
			);
		}

		return json({ error: "chat_failed", message: "Unable to process request." }, 500);
	}
};
