import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchLineupLabDivisions, fetchLineupLabTeams, fetchLineupLabMatchups } =
	vi.hoisted(() => ({
		fetchLineupLabDivisions: vi.fn(),
		fetchLineupLabTeams: vi.fn(),
		fetchLineupLabMatchups: vi.fn(),
	}));

vi.mock("../worker/src/runtime/lineupLab/repository", () => ({
	fetchLineupLabDivisions,
	fetchLineupLabTeams,
	fetchLineupLabMatchups,
}));

import {
	handleLineupLabDivisionsRequest,
	handleLineupLabMatchupsRequest,
	handleLineupLabTeamsRequest,
} from "../worker/src/runtime/lineupLab/contextHandler";

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

const parseJson = async (response: Response) => {
	const text = await response.text();
	return JSON.parse(text) as Record<string, unknown>;
};

describe("lineup lab context handler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns divisions", async () => {
		fetchLineupLabDivisions.mockResolvedValue([
			{
				divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
				divisionName: "4.0",
				seasonYear: 2025,
				seasonNumber: 3,
				location: "NJ / PA",
			},
		]);

		const request = new Request(
			"http://localhost/api/lineup-lab/context/divisions",
			{
				method: "GET",
			},
		);
		const response = await handleLineupLabDivisionsRequest(request, env);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(fetchLineupLabDivisions).toHaveBeenCalledWith(env);
		expect(body.divisions).toBeInstanceOf(Array);
	});

	it("does not retry divisions on query read timeout", async () => {
		fetchLineupLabDivisions.mockRejectedValueOnce(
			new Error("Query read timeout"),
		);

		const request = new Request(
			"http://localhost/api/lineup-lab/context/divisions",
			{
				method: "GET",
			},
		);
		const response = await handleLineupLabDivisionsRequest(request, env);
		const body = await parseJson(response);

		expect(response.status).toBe(500);
		expect(fetchLineupLabDivisions).toHaveBeenCalledTimes(1);
		expect(body.error).toBe("lineup_lab_context_failed");
	});

	it("returns 400 for invalid team query", async () => {
		const request = new Request(
			"http://localhost/api/lineup-lab/context/teams?divisionId=not-a-uuid",
			{ method: "GET" },
		);

		const response = await handleLineupLabTeamsRequest(request, env);
		expect(response.status).toBe(400);
		expect(fetchLineupLabTeams).not.toHaveBeenCalled();
	});

	it("returns teams for valid team query", async () => {
		fetchLineupLabTeams.mockResolvedValue([
			{
				teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
				teamName: "Bounce Philly",
			},
		]);
		const divisionId = "e8d04726-4c07-447c-a609-9914d1378e8d";
		const request = new Request(
			`http://localhost/api/lineup-lab/context/teams?divisionId=${divisionId}`,
			{ method: "GET" },
		);

		const response = await handleLineupLabTeamsRequest(request, env);
		const body = await parseJson(response);
		expect(response.status).toBe(200);
		expect(fetchLineupLabTeams).toHaveBeenCalledWith(env, divisionId);
		expect(body.teams).toBeInstanceOf(Array);
	});

	it("returns 400 for invalid matchup query", async () => {
		const request = new Request(
			"http://localhost/api/lineup-lab/context/matchups?divisionId=e8d04726-4c07-447c-a609-9914d1378e8d&teamId=a7d5c302-9ee0-4bd6-9205-971efe6af562",
			{ method: "GET" },
		);

		const response = await handleLineupLabMatchupsRequest(request, env);
		expect(response.status).toBe(400);
		expect(fetchLineupLabMatchups).not.toHaveBeenCalled();
	});

	it("returns matchup context for valid query", async () => {
		fetchLineupLabMatchups.mockResolvedValue({
			matchups: [
				{
					matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
					weekNumber: 1,
					scheduledTime: new Date(0).toISOString(),
					teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
					oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
					teamName: "Bounce Philly",
					oppTeamName: "Slice Jersey",
					opponentRosterPlayers: [
						{
							playerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
							firstName: "Alex",
							lastName: "Opponent",
							gender: "male",
							isSub: false,
						},
					],
				},
			],
			availablePlayerIds: ["11111111-1111-4111-8111-111111111111"],
			suggestedAvailablePlayerIds: ["11111111-1111-4111-8111-111111111111"],
			rosterPlayers: [
				{
					playerId: "11111111-1111-4111-8111-111111111111",
					firstName: "Jane",
					lastName: "Doe",
					gender: "female",
					isSub: false,
					suggested: true,
				},
			],
		});
		const request = new Request(
			"http://localhost/api/lineup-lab/context/matchups?divisionId=e8d04726-4c07-447c-a609-9914d1378e8d&teamId=a7d5c302-9ee0-4bd6-9205-971efe6af562&seasonYear=2025&seasonNumber=3",
			{ method: "GET" },
		);

		const response = await handleLineupLabMatchupsRequest(request, env);
		const body = await parseJson(response);
		expect(response.status).toBe(200);
		expect(fetchLineupLabMatchups).toHaveBeenCalledWith(env, {
			divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
			teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
			seasonYear: 2025,
			seasonNumber: 3,
		});
		expect(body.matchups).toBeInstanceOf(Array);
		expect(
			(body.matchups as Array<Record<string, unknown>>)[0]
				?.opponentRosterPlayers,
		).toBeInstanceOf(Array);
		expect(body.availablePlayerIds).toBeInstanceOf(Array);
		expect(body.suggestedAvailablePlayerIds).toBeInstanceOf(Array);
		expect(body.rosterPlayers).toBeInstanceOf(Array);
	});
});
