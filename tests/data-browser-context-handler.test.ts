import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	fetchDataBrowserSeasons,
	fetchDataBrowserDivisions,
	fetchDataBrowserTeams,
	fetchDivisionPlayersQuery,
	fetchDivisionStandingsQuery,
	fetchTeamOverviewQuery,
	fetchTeamPlayersQuery,
	fetchTeamScheduleQuery,
} = vi.hoisted(() => ({
	fetchDataBrowserSeasons: vi.fn(),
	fetchDataBrowserDivisions: vi.fn(),
	fetchDataBrowserTeams: vi.fn(),
	fetchDivisionPlayersQuery: vi.fn(),
	fetchDivisionStandingsQuery: vi.fn(),
	fetchTeamOverviewQuery: vi.fn(),
	fetchTeamPlayersQuery: vi.fn(),
	fetchTeamScheduleQuery: vi.fn(),
}));

vi.mock("../worker/src/runtime/dataBrowser/repository", () => ({
	fetchDataBrowserSeasons,
	fetchDataBrowserDivisions,
	fetchDataBrowserTeams,
	fetchDivisionPlayersQuery,
	fetchDivisionStandingsQuery,
	fetchTeamOverviewQuery,
	fetchTeamPlayersQuery,
	fetchTeamScheduleQuery,
}));

import {
	handleDataBrowserDivisionsRequest,
	handleDataBrowserSeasonsRequest,
	handleDataBrowserTeamsRequest,
} from "../worker/src/runtime/dataBrowser/contextHandler";
import { handleFetch } from "../worker/src/runtime/index";

const env = {
	OPENAI_API_KEY: "test-key",
	SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
	SUPABASE_DB_SSL_NO_VERIFY: true,
	APP_ENV: "local" as const,
	SUPABASE_URL: "https://example.supabase.co",
	SUPABASE_ANON_KEY: "anon-key",
	AUTH_ALLOWED_ORIGINS: ["http://localhost:5173"],
	AUTH_JWT_ISSUER: "https://example.supabase.co/auth/v1",
	AUTH_JWT_AUDIENCE: "authenticated",
	AUTH_BYPASS_ENABLED: false,
	AUTH_TURNSTILE_BYPASS: true,
	AUTH_IP_HASH_SALT: "test-salt",
	LLM_MODEL: "gpt-4.1-mini",
	LLM_REASONING_LEVEL: "medium" as const,
	SQL_QUERY_TIMEOUT_MS: 10_000,
	SQL_CAPTURE_EXPLAIN_PLAN: false,
	EXPOSE_ERROR_DETAILS: false,
	LANGFUSE_TRACING_ENVIRONMENT: "default",
	LANGFUSE_ENABLED: false,
};

const rawFetchEnv = {
	OPENAI_API_KEY: "test-key",
	SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
	SUPABASE_DB_SSL_NO_VERIFY: "true",
	APP_ENV: "local",
	SUPABASE_URL: "https://example.supabase.co",
	SUPABASE_ANON_KEY: "anon-key",
	AUTH_JWT_ISSUER: "https://example.supabase.co/auth/v1",
	AUTH_JWT_AUDIENCE: "authenticated",
	AUTH_BYPASS_ENABLED: "true",
	AUTH_TURNSTILE_BYPASS: "true",
	AUTH_IP_HASH_SALT: "test-salt",
	LLM_MODEL: "gpt-4.1-mini",
	LLM_REASONING_LEVEL: "medium",
	SQL_QUERY_TIMEOUT_MS: "10000",
	SQL_CAPTURE_EXPLAIN_PLAN: "false",
	EXPOSE_ERROR_DETAILS: "false",
};

const parseJson = async (response: Response) => {
	const text = await response.text();
	return JSON.parse(text) as Record<string, unknown>;
};

describe("data browser context handler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns seasons", async () => {
		fetchDataBrowserSeasons.mockResolvedValue([
			{
				seasonYear: 2025,
				seasonNumber: 3,
				label: "2025 S3",
			},
		]);

		const request = new Request(
			"http://localhost/api/data-browser/context/seasons",
			{
				method: "GET",
			},
		);
		const response = await handleDataBrowserSeasonsRequest(request, env);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(fetchDataBrowserSeasons).toHaveBeenCalledWith(env);
		expect(body.seasons).toBeInstanceOf(Array);
	});

	it("returns 400 for invalid divisions query", async () => {
		const request = new Request(
			"http://localhost/api/data-browser/context/divisions?seasonYear=bad",
			{ method: "GET" },
		);

		const response = await handleDataBrowserDivisionsRequest(request, env);
		expect(response.status).toBe(400);
		expect(fetchDataBrowserDivisions).not.toHaveBeenCalled();
	});

	it("returns divisions for a valid query", async () => {
		fetchDataBrowserDivisions.mockResolvedValue([
			{
				divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
				divisionName: "4.0",
				seasonYear: 2025,
				seasonNumber: 3,
				location: "NJ / PA",
			},
		]);

		const request = new Request(
			"http://localhost/api/data-browser/context/divisions?seasonYear=2025&seasonNumber=3",
			{ method: "GET" },
		);
		const response = await handleDataBrowserDivisionsRequest(request, env);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(fetchDataBrowserDivisions).toHaveBeenCalledWith(env, {
			seasonYear: 2025,
			seasonNumber: 3,
		});
		expect(body.divisions).toBeInstanceOf(Array);
	});

	it("returns 400 for invalid teams query", async () => {
		const request = new Request(
			"http://localhost/api/data-browser/context/teams?divisionId=bad&seasonYear=2025&seasonNumber=3",
			{ method: "GET" },
		);

		const response = await handleDataBrowserTeamsRequest(request, env);
		expect(response.status).toBe(400);
		expect(fetchDataBrowserTeams).not.toHaveBeenCalled();
	});

	it("returns teams for a valid query", async () => {
		fetchDataBrowserTeams.mockResolvedValue([
			{
				teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
				teamName: "Bounce Philly",
			},
		]);
		const divisionId = "e8d04726-4c07-447c-a609-9914d1378e8d";
		const request = new Request(
			`http://localhost/api/data-browser/context/teams?divisionId=${divisionId}&seasonYear=2025&seasonNumber=3`,
			{ method: "GET" },
		);

		const response = await handleDataBrowserTeamsRequest(request, env);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(fetchDataBrowserTeams).toHaveBeenCalledWith(env, {
			divisionId,
			seasonYear: 2025,
			seasonNumber: 3,
		});
		expect(body.teams).toBeInstanceOf(Array);
	});

	it("routes seasons requests through handleFetch", async () => {
		fetchDataBrowserSeasons.mockResolvedValue([
			{
				seasonYear: 2025,
				seasonNumber: 3,
				label: "2025 S3",
			},
		]);

		const request = new Request(
			"http://localhost/api/data-browser/context/seasons",
			{
				method: "GET",
			},
		);
		const response = await handleFetch(request, rawFetchEnv);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(body.seasons).toBeInstanceOf(Array);
	});
});
