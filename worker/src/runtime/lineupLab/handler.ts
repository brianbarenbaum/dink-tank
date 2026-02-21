import type { WorkerEnv } from "../env";
import { createRequestContext, type RequestContext } from "../requestContext";
import { logError, logWarn } from "../runtimeLogger";
import { parseLineupLabRecommendRequest } from "./validation";
import type {
	LineupLabRecommendRequest,
	LineupLabRecommendResponse,
} from "./types";

const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});

export const handleLineupLabRecommendRequest = async (
	request: Request,
	runRecommendation: (
		env: WorkerEnv,
		input: LineupLabRecommendRequest,
		context: RequestContext,
	) => Promise<LineupLabRecommendResponse>,
	env?: WorkerEnv,
): Promise<Response> => {
	const context = createRequestContext(request);
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		logWarn("lineup_lab_invalid_json", context);
		return json({ error: "invalid_json" }, 400);
	}

	const parsed = parseLineupLabRecommendRequest(payload);
	if (!parsed.ok) {
		logWarn("lineup_lab_invalid_request", context, { reason: parsed.error });
		return json({ error: "invalid_request", message: parsed.error }, 400);
	}

	if (!env) {
		logError("misconfigured_env", context);
		return json({ error: "misconfigured_env" }, 500);
	}

	try {
		const response = await runRecommendation(env, parsed.value, context);
		return json(response, 200);
	} catch (error) {
		logError("lineup_lab_recommend_failed", context, {
			error:
				error instanceof Error
					? { name: error.name, message: error.message }
					: String(error),
		});

		const message =
			env.EXPOSE_ERROR_DETAILS && error instanceof Error
				? error.message
				: "Unable to generate lineup recommendations.";
		return json({ error: "lineup_lab_failed", message }, 500);
	}
};
