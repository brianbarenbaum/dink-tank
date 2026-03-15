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
	runSqlAgent,
} = vi.hoisted(() => ({
	fetchDataBrowserSeasons: vi.fn(),
	fetchDataBrowserDivisions: vi.fn(),
	fetchDataBrowserTeams: vi.fn(),
	fetchDivisionPlayersQuery: vi.fn(),
	fetchDivisionStandingsQuery: vi.fn(),
	fetchTeamOverviewQuery: vi.fn(),
	fetchTeamPlayersQuery: vi.fn(),
	fetchTeamScheduleQuery: vi.fn(),
	runSqlAgent: vi.fn(),
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

vi.mock("../worker/src/runtime/sqlAgent", () => ({
	runSqlAgent,
}));

import { handleDataBrowserQueryRequest } from "../worker/src/runtime/dataBrowser/handler";
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
	AUTH_INVITE_CODE_HASH_SECRET: "invite-secret",
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
	AUTH_INVITE_CODE_HASH_SECRET: "invite-secret",
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

const buildDivisionPlayersRequest = () => ({
	queryType: "division_players",
	scope: {
		seasonYear: 2025,
		seasonNumber: 3,
		divisionId: "11111111-1111-4111-8111-111111111111",
		divisionName: "3.5",
		teamId: null,
		teamName: null,
	},
	viewState: {
		page: 1,
		pageSize: 20,
		sortKey: "ranking",
		sortDirection: "asc",
	},
});

describe("data browser query handler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects invalid queryType values", async () => {
		const request = new Request("http://localhost/api/data-browser/query", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				...buildDivisionPlayersRequest(),
				queryType: "not_real",
			}),
		});

		const response = await handleDataBrowserQueryRequest(request, env);
		const body = await parseJson(response);

		expect(response.status).toBe(400);
		expect(body.error).toBe("invalid_request");
		expect(fetchDivisionPlayersQuery).not.toHaveBeenCalled();
	});

	it("rejects invalid scope combinations", async () => {
		const request = new Request("http://localhost/api/data-browser/query", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				...buildDivisionPlayersRequest(),
				scope: {
					...buildDivisionPlayersRequest().scope,
					teamId: "22222222-2222-4222-8222-222222222222",
					teamName: "Drop Shotters",
				},
			}),
		});

		const response = await handleDataBrowserQueryRequest(request, env);
		const body = await parseJson(response);

		expect(response.status).toBe(400);
		expect(body.error).toBe("invalid_request");
		expect(fetchDivisionPlayersQuery).not.toHaveBeenCalled();
	});

	it("routes valid requests through the typed repository handler", async () => {
		fetchDivisionStandingsQuery.mockResolvedValue({
			queryId: "query-1",
			queryType: "division_standings",
			layout: "table",
			breadcrumb: ["2025 S3", "3.5", "Standings"],
			title: "Division Standings",
			fetchedAt: new Date(0).toISOString(),
			page: 1,
			pageSize: 20,
			totalRows: 1,
			totalPages: 1,
			sortKey: "ranking",
			sortDirection: "asc",
			payload: {
				columns: [
					{ key: "ranking", label: "Rank" },
					{ key: "teamName", label: "Team" },
				],
				rows: [{ ranking: 1, teamName: "Drop Shotters" }],
			},
		});

		const request = new Request("http://localhost/api/data-browser/query", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				...buildDivisionPlayersRequest(),
				queryType: "division_standings",
			}),
		});

		const response = await handleFetch(request, rawFetchEnv);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(fetchDivisionStandingsQuery).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				queryType: "division_standings",
			}),
		);
		expect(body.title).toBe("Division Standings");
	});

	it("does not invoke the sql agent for valid direct queries", async () => {
		fetchDivisionPlayersQuery.mockResolvedValue({
			queryId: "query-1",
			queryType: "division_players",
			layout: "table",
			breadcrumb: ["2025 S3", "3.5", "Players"],
			title: "Division Players",
			fetchedAt: new Date(0).toISOString(),
			page: 1,
			pageSize: 20,
			totalRows: 0,
			totalPages: 0,
			sortKey: "ranking",
			sortDirection: "asc",
			payload: {
				columns: [],
				rows: [],
			},
		});

		const request = new Request("http://localhost/api/data-browser/query", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(buildDivisionPlayersRequest()),
		});

		const response = await handleFetch(request, rawFetchEnv);

		expect(response.status).toBe(200);
		expect(fetchDivisionPlayersQuery).toHaveBeenCalledTimes(1);
		expect(runSqlAgent).not.toHaveBeenCalled();
	});
});
