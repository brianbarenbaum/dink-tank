import type { WorkerEnv } from "../env";
import { createRequestContext } from "../requestContext";
import { logError, logWarn } from "../runtimeLogger";
import {
	fetchLineupLabDivisions,
	fetchLineupLabMatchups,
	fetchLineupLabTeams,
} from "./repository";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});

const parseRequiredUuid = (
	value: string | null,
	fieldName: string,
): { ok: true; value: string } | { ok: false; error: string } => {
	if (!value || !UUID_PATTERN.test(value)) {
		return { ok: false, error: `${fieldName} must be a valid UUID` };
	}
	return { ok: true, value };
};

export const handleLineupLabDivisionsRequest = async (
	request: Request,
	env: WorkerEnv,
): Promise<Response> => {
	const context = createRequestContext(request);
	try {
		const divisions = await fetchLineupLabDivisions(env);
		return json({ divisions }, 200);
	} catch (error) {
		const message =
			env.EXPOSE_ERROR_DETAILS && error instanceof Error
				? error.message
				: "Unable to load lineup lab divisions.";
		logError("lineup_lab_divisions_failed", context, {
			error:
				error instanceof Error
					? { name: error.name, message: error.message }
					: String(error),
		});
		return json({ error: "lineup_lab_context_failed", message }, 500);
	}
};

export const handleLineupLabTeamsRequest = async (
	request: Request,
	env: WorkerEnv,
): Promise<Response> => {
	const context = createRequestContext(request);
	const url = new URL(request.url);
	const divisionIdResult = parseRequiredUuid(
		url.searchParams.get("divisionId"),
		"divisionId",
	);
	if (!divisionIdResult.ok) {
		logWarn("lineup_lab_invalid_request", context, {
			reason: divisionIdResult.error,
		});
		return json(
			{ error: "invalid_request", message: divisionIdResult.error },
			400,
		);
	}

	try {
		const teams = await fetchLineupLabTeams(env, divisionIdResult.value);
		return json({ teams }, 200);
	} catch (error) {
		const message =
			env.EXPOSE_ERROR_DETAILS && error instanceof Error
				? error.message
				: "Unable to load lineup lab teams.";
		logError("lineup_lab_teams_failed", context, {
			error:
				error instanceof Error
					? { name: error.name, message: error.message }
					: String(error),
		});
		return json({ error: "lineup_lab_context_failed", message }, 500);
	}
};

export const handleLineupLabMatchupsRequest = async (
	request: Request,
	env: WorkerEnv,
): Promise<Response> => {
	const context = createRequestContext(request);
	const url = new URL(request.url);
	const divisionIdResult = parseRequiredUuid(
		url.searchParams.get("divisionId"),
		"divisionId",
	);
	const teamIdResult = parseRequiredUuid(
		url.searchParams.get("teamId"),
		"teamId",
	);
	const seasonYear = Number.parseInt(
		url.searchParams.get("seasonYear") ?? "",
		10,
	);
	const seasonNumber = Number.parseInt(
		url.searchParams.get("seasonNumber") ?? "",
		10,
	);

	if (!divisionIdResult.ok) {
		const message = divisionIdResult.error;
		logWarn("lineup_lab_invalid_request", context, { reason: message });
		return json({ error: "invalid_request", message }, 400);
	}
	if (!teamIdResult.ok) {
		const message = teamIdResult.error;
		logWarn("lineup_lab_invalid_request", context, { reason: message });
		return json({ error: "invalid_request", message }, 400);
	}
	if (!Number.isInteger(seasonYear) || !Number.isInteger(seasonNumber)) {
		const message = "seasonYear and seasonNumber are required integers";
		logWarn("lineup_lab_invalid_request", context, { reason: message });
		return json({ error: "invalid_request", message }, 400);
	}

	try {
		const result = await fetchLineupLabMatchups(env, {
			divisionId: divisionIdResult.value,
			teamId: teamIdResult.value,
			seasonYear,
			seasonNumber,
		});
		return json(result, 200);
	} catch (error) {
		const message =
			env.EXPOSE_ERROR_DETAILS && error instanceof Error
				? error.message
				: "Unable to load lineup lab matchups.";
		logError("lineup_lab_matchups_failed", context, {
			error:
				error instanceof Error
					? { name: error.name, message: error.message }
					: String(error),
		});
		return json({ error: "lineup_lab_context_failed", message }, 500);
	}
};
