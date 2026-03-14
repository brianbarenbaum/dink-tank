import type { WorkerEnv } from "../env";
import { createRequestContext } from "../requestContext";
import { logError, logWarn } from "../runtimeLogger";
import {
	fetchDivisionPlayersQuery,
	fetchDivisionStandingsQuery,
	fetchTeamOverviewQuery,
	fetchTeamPlayersQuery,
	fetchTeamScheduleQuery,
} from "./repository";
import type {
	DataBrowserQueryRequest,
	DataBrowserQueryResponse,
} from "./types";
import { parseDataBrowserQueryRequest } from "./validation";

const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});

type QueryRunner = (
	env: WorkerEnv,
	request: DataBrowserQueryRequest,
) => Promise<DataBrowserQueryResponse>;

const QUERY_RUNNERS: Record<DataBrowserQueryRequest["queryType"], QueryRunner> =
	{
		division_players: fetchDivisionPlayersQuery,
		division_standings: fetchDivisionStandingsQuery,
		team_overview: fetchTeamOverviewQuery,
		team_players: fetchTeamPlayersQuery,
		team_schedule: fetchTeamScheduleQuery,
	};

export const handleDataBrowserQueryRequest = async (
	request: Request,
	env?: WorkerEnv,
): Promise<Response> => {
	const context = createRequestContext(request);
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		logWarn("data_browser_invalid_json", context);
		return json({ error: "invalid_json" }, 400);
	}

	const parsed = parseDataBrowserQueryRequest(payload);
	if (!parsed.ok) {
		logWarn("data_browser_invalid_request", context, { reason: parsed.error });
		return json({ error: "invalid_request", message: parsed.error }, 400);
	}

	if (!env) {
		logError("misconfigured_env", context);
		return json({ error: "misconfigured_env" }, 500);
	}

	try {
		const response = await QUERY_RUNNERS[parsed.value.queryType](
			env,
			parsed.value,
		);
		return json(response, 200);
	} catch (error) {
		logError("data_browser_query_failed", context, {
			queryType: parsed.value.queryType,
			error:
				error instanceof Error
					? { name: error.name, message: error.message }
					: String(error),
		});

		const message =
			env.EXPOSE_ERROR_DETAILS && error instanceof Error
				? error.message
				: "Unable to load data browser query results.";
		return json({ error: "data_browser_query_failed", message }, 500);
	}
};
