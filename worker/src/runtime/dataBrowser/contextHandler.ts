import type { WorkerEnv } from "../env";
import { createRequestContext } from "../requestContext";
import { logError, logWarn } from "../runtimeLogger";
import {
	fetchDataBrowserDivisions,
	fetchDataBrowserSeasons,
	fetchDataBrowserTeams,
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

const parseRequiredInteger = (
	value: string | null,
	fieldName: string,
): { ok: true; value: number } | { ok: false; error: string } => {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isInteger(parsed)) {
		return { ok: false, error: `${fieldName} must be a valid integer` };
	}
	return { ok: true, value: parsed };
};

const parseRequiredUuid = (
	value: string | null,
	fieldName: string,
): { ok: true; value: string } | { ok: false; error: string } => {
	if (!value || !UUID_PATTERN.test(value)) {
		return { ok: false, error: `${fieldName} must be a valid UUID` };
	}
	return { ok: true, value };
};

export const handleDataBrowserSeasonsRequest = async (
	request: Request,
	env: WorkerEnv,
): Promise<Response> => {
	const context = createRequestContext(request);
	try {
		const seasons = await fetchDataBrowserSeasons(env);
		return json({ seasons }, 200);
	} catch (error) {
		const message =
			env.EXPOSE_ERROR_DETAILS && error instanceof Error
				? error.message
				: "Unable to load data browser seasons.";
		logError("data_browser_seasons_failed", context, {
			error:
				error instanceof Error
					? { name: error.name, message: error.message }
					: String(error),
		});
		return json({ error: "data_browser_context_failed", message }, 500);
	}
};

export const handleDataBrowserDivisionsRequest = async (
	request: Request,
	env: WorkerEnv,
): Promise<Response> => {
	const context = createRequestContext(request);
	const url = new URL(request.url);
	const seasonYearResult = parseRequiredInteger(
		url.searchParams.get("seasonYear"),
		"seasonYear",
	);
	const seasonNumberResult = parseRequiredInteger(
		url.searchParams.get("seasonNumber"),
		"seasonNumber",
	);

	if (!seasonYearResult.ok) {
		logWarn("data_browser_invalid_request", context, {
			reason: seasonYearResult.error,
		});
		return json(
			{ error: "invalid_request", message: seasonYearResult.error },
			400,
		);
	}
	if (!seasonNumberResult.ok) {
		logWarn("data_browser_invalid_request", context, {
			reason: seasonNumberResult.error,
		});
		return json(
			{ error: "invalid_request", message: seasonNumberResult.error },
			400,
		);
	}

	try {
		const divisions = await fetchDataBrowserDivisions(env, {
			seasonYear: seasonYearResult.value,
			seasonNumber: seasonNumberResult.value,
		});
		return json({ divisions }, 200);
	} catch (error) {
		const message =
			env.EXPOSE_ERROR_DETAILS && error instanceof Error
				? error.message
				: "Unable to load data browser divisions.";
		logError("data_browser_divisions_failed", context, {
			error:
				error instanceof Error
					? { name: error.name, message: error.message }
					: String(error),
		});
		return json({ error: "data_browser_context_failed", message }, 500);
	}
};

export const handleDataBrowserTeamsRequest = async (
	request: Request,
	env: WorkerEnv,
): Promise<Response> => {
	const context = createRequestContext(request);
	const url = new URL(request.url);
	const divisionIdResult = parseRequiredUuid(
		url.searchParams.get("divisionId"),
		"divisionId",
	);
	const seasonYearResult = parseRequiredInteger(
		url.searchParams.get("seasonYear"),
		"seasonYear",
	);
	const seasonNumberResult = parseRequiredInteger(
		url.searchParams.get("seasonNumber"),
		"seasonNumber",
	);

	if (!divisionIdResult.ok) {
		logWarn("data_browser_invalid_request", context, {
			reason: divisionIdResult.error,
		});
		return json(
			{ error: "invalid_request", message: divisionIdResult.error },
			400,
		);
	}
	if (!seasonYearResult.ok) {
		logWarn("data_browser_invalid_request", context, {
			reason: seasonYearResult.error,
		});
		return json(
			{ error: "invalid_request", message: seasonYearResult.error },
			400,
		);
	}
	if (!seasonNumberResult.ok) {
		logWarn("data_browser_invalid_request", context, {
			reason: seasonNumberResult.error,
		});
		return json(
			{ error: "invalid_request", message: seasonNumberResult.error },
			400,
		);
	}

	try {
		const teams = await fetchDataBrowserTeams(env, {
			divisionId: divisionIdResult.value,
			seasonYear: seasonYearResult.value,
			seasonNumber: seasonNumberResult.value,
		});
		return json({ teams }, 200);
	} catch (error) {
		const message =
			env.EXPOSE_ERROR_DETAILS && error instanceof Error
				? error.message
				: "Unable to load data browser teams.";
		logError("data_browser_teams_failed", context, {
			error:
				error instanceof Error
					? { name: error.name, message: error.message }
					: String(error),
		});
		return json({ error: "data_browser_context_failed", message }, 500);
	}
};
