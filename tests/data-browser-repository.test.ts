import { beforeEach, describe, expect, it, vi } from "vitest";

const { poolQueryMock, poolConfigCalls, MockPool } = vi.hoisted(() => {
	const queryMock = vi.fn();
	const configCalls: unknown[] = [];
	class PoolMock {
		constructor(config: unknown) {
			configCalls.push(config);
		}
		query = queryMock;
	}
	return {
		poolQueryMock: queryMock,
		poolConfigCalls: configCalls,
		MockPool: PoolMock,
	};
});

vi.mock("pg", () => ({
	Pool: MockPool,
}));

import {
	fetchDataBrowserTeams,
	fetchDivisionPlayersQuery,
	fetchDivisionStandingsQuery,
	fetchTeamOverviewQuery,
	fetchTeamPlayersQuery,
	fetchTeamScheduleQuery,
} from "../worker/src/runtime/dataBrowser/repository";

const env = {
	OPENAI_API_KEY: "test-key",
	SUPABASE_DB_URL:
		"postgres://postgres:postgres@localhost:5432/postgres?test=data-browser-repository",
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

describe("data browser repository", () => {
	beforeEach(() => {
		poolQueryMock.mockReset();
		poolConfigCalls.length = 0;
	});

	it("uses the region scope placeholder that matches the teams query params", async () => {
		poolQueryMock.mockResolvedValueOnce({
			rows: [
				{
					team_id: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
					team_name: "Bounce Philly",
				},
			],
		});

		const teams = await fetchDataBrowserTeams(env, {
			divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
			seasonYear: 2025,
			seasonNumber: 3,
		});

		expect(teams).toEqual([
			{
				teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
				teamName: "Bounce Philly",
			},
		]);
		expect(poolQueryMock).toHaveBeenCalledTimes(1);
		expect(poolConfigCalls[0]).toMatchObject({
			query_timeout: 2000,
		});

		const executedQuery = poolQueryMock.mock.calls[0]?.[0];
		const executedParams = poolQueryMock.mock.calls[0]?.[1];
		expect(executedQuery).toContain(
			"upper(replace(coalesce(r.location, ''), ' ', '')) = $4",
		);
		expect(executedParams).toEqual([
			"e8d04726-4c07-447c-a609-9914d1378e8d",
			2025,
			3,
			"NJ/PA",
		]);
	});

	it("queries division players through the season player stats view", async () => {
		poolQueryMock.mockResolvedValueOnce({
			rows: [
				{
					total_rows: 1,
					ranking: 1,
					player_full_name: "Jamie Fox",
					team_name: "Drop Shotters",
					wins: 8,
					losses: 2,
					win_rate: "80.0",
					dupr_rating: "4.21",
				},
			],
		});

		const result = await fetchDivisionPlayersQuery(env, {
			queryType: "division_players",
			scope: {
				seasonYear: 2025,
				seasonNumber: 3,
				divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
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

		expect(result.title).toBe("Division Players");
		expect(result.payload).toEqual({
			columns: [
				{ key: "ranking", label: "Rank" },
				{ key: "playerName", label: "Player" },
				{ key: "teamName", label: "Team" },
				{ key: "record", label: "Record" },
				{ key: "winRate", label: "Win %" },
				{ key: "dupr", label: "DUPR" },
			],
			rows: [
				{
					ranking: 1,
					playerName: "Jamie Fox",
					teamName: "Drop Shotters",
					record: "8-2",
					winRate: "80.0",
					dupr: "4.21",
				},
			],
		});

		const executedQuery = poolQueryMock.mock.calls[0]?.[0];
		expect(executedQuery).toContain("public.vw_player_stats_per_season");
		expect(executedQuery).toContain("where d.division_id = $1::uuid");
	});

	it("queries division standings through the team standings view", async () => {
		poolQueryMock.mockResolvedValueOnce({
			rows: [
				{
					total_rows: 1,
					ranking: 1,
					team_name: "Drop Shotters",
					record: "10-2-0",
					win_percentage: "83.3",
					pod_name: "North",
					team_point_diff: 42,
				},
			],
		});

		const result = await fetchDivisionStandingsQuery(env, {
			queryType: "division_standings",
			scope: {
				seasonYear: 2025,
				seasonNumber: 3,
				divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
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

		expect(result.title).toBe("Division Standings");
		expect(result.payload).toEqual({
			columns: [
				{ key: "ranking", label: "Rank" },
				{ key: "teamName", label: "Team" },
				{ key: "record", label: "Record" },
				{ key: "winPercentage", label: "Win %" },
				{ key: "podName", label: "Pod" },
				{ key: "pointDiff", label: "Point Diff" },
			],
			rows: [
				{
					ranking: 1,
					teamName: "Drop Shotters",
					record: "10-2-0",
					winPercentage: "83.3",
					podName: "North",
					pointDiff: 42,
				},
			],
		});

		const executedQuery = poolQueryMock.mock.calls[0]?.[0];
		expect(executedQuery).toContain("public.vw_team_standings");
		expect(executedQuery).toContain("where d.division_id = $1::uuid");
	});

	it("queries team players through the season player stats view with a scoped team-name filter", async () => {
		poolQueryMock.mockResolvedValueOnce({
			rows: [
				{
					total_rows: 1,
					ranking: 1,
					player_full_name: "Jamie Fox",
					team_name: "Drop Shotters",
					wins: 8,
					losses: 2,
					win_rate: "80.0",
					dupr_rating: "4.21",
				},
			],
		});

		const result = await fetchTeamPlayersQuery(env, {
			queryType: "team_players",
			scope: {
				seasonYear: 2025,
				seasonNumber: 3,
				divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
				divisionName: "3.5",
				teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
				teamName: "Drop Shotters",
			},
			viewState: {
				page: 1,
				pageSize: 20,
				sortKey: "ranking",
				sortDirection: "asc",
			},
		});

		expect(result.title).toBe("Team Players");
		expect(result.breadcrumb).toEqual([
			"2025 S3",
			"3.5",
			"Drop Shotters",
			"Players",
		]);
		expect(result.payload).toEqual({
			columns: [
				{ key: "ranking", label: "Rank" },
				{ key: "playerName", label: "Player" },
				{ key: "teamName", label: "Team" },
				{ key: "record", label: "Record" },
				{ key: "winRate", label: "Win %" },
				{ key: "dupr", label: "DUPR" },
			],
			rows: [
				{
					ranking: 1,
					playerName: "Jamie Fox",
					teamName: "Drop Shotters",
					record: "8-2",
					winRate: "80.0",
					dupr: "4.21",
				},
			],
		});

		const executedQuery = poolQueryMock.mock.calls[0]?.[0];
		expect(executedQuery).toContain("public.vw_player_stats_per_season");
		expect(executedQuery).toContain("v.team_name = $5");
		expect(executedQuery).not.toContain("selected_team as (");
		expect(executedQuery).not.toContain("where t.team_id = $5::uuid");
		expect(poolQueryMock.mock.calls[0]?.[1]).toEqual([
			"e8d04726-4c07-447c-a609-9914d1378e8d",
			2025,
			3,
			"NJ/PA",
			"Drop Shotters",
			20,
			0,
		]);
	});

	it("queries team overview through the standings view with a scoped team-name filter", async () => {
		poolQueryMock.mockResolvedValueOnce({
			rows: [
				{
					division_team_count: 16,
					team_name: "Drop Shotters",
					ranking: 3,
					pod_ranking: 2,
					wins: 8,
					losses: 2,
					draws: 0,
					record: "8-2-0",
					home_record: "4-1",
					away_record: "4-1",
					win_percentage: "80.0",
					men_win_rate: "75.0",
					women_win_rate: "82.0",
					mixed_win_rate: "85.0",
					game_record: "24-12",
					total_points_won: 1240,
					average_points_per_game: "48.2",
					team_point_diff: 125,
				},
			],
		});

		const result = await fetchTeamOverviewQuery(env, {
			queryType: "team_overview",
			scope: {
				seasonYear: 2025,
				seasonNumber: 3,
				divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
				divisionName: "3.5",
				teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
				teamName: "Drop Shotters",
			},
			viewState: {
				page: 1,
				pageSize: 20,
				sortKey: null,
				sortDirection: null,
			},
		});

		expect(result.title).toBe("Team Overview");
		expect(result.layout).toBe("summary");
		expect(result.breadcrumb).toEqual([
			"2025 S3",
			"3.5",
			"Drop Shotters",
			"Overview",
		]);
		expect(result.payload).toEqual({
			teamName: "Drop Shotters",
			matchRecord: {
				wins: 8,
				losses: 2,
				draws: 0,
				record: "8-2-0",
				homeRecord: "4-1",
				awayRecord: "4-1",
			},
			totalPoints: {
				totalPointsWon: 1240,
				averagePerMatch: 124,
			},
			leagueRank: {
				rank: 3,
				teamCount: 16,
				podRank: 2,
			},
			winBreakdown: {
				overallWinPercentage: 80,
				menWinPercentage: 75,
				womenWinPercentage: 82,
				mixedWinPercentage: 85,
			},
			otherStats: {
				gameRecord: "24-12",
				totalPointsWon: 1240,
				averagePointsPerGame: 48.2,
				teamPointDiff: 125,
			},
		});

		const executedQuery = poolQueryMock.mock.calls[0]?.[0];
		expect(executedQuery).toContain("public.vw_team_standings");
		expect(executedQuery).toContain("v.team_name = $5");
		expect(executedQuery).toContain("scoped_standings as (");
		expect(executedQuery).not.toContain("selected_team as (");
		expect(executedQuery).not.toContain("where t.team_id = $5::uuid");
		expect(poolQueryMock.mock.calls[0]?.[1]).toEqual([
			"e8d04726-4c07-447c-a609-9914d1378e8d",
			2025,
			3,
			"NJ/PA",
			"Drop Shotters",
		]);
	});

	it("queries team schedule through the team matches view with a scoped team-name filter", async () => {
		poolQueryMock.mockResolvedValueOnce({
			rows: [
				{
					total_rows: 2,
					week_number: 3,
					match_datetime: "Mar 01, 2026 06:00pm",
					opponent_team_name: "Topspin Club",
					match_result: null,
					team_points: null,
					opponent_points: null,
					playoffs: false,
					playoff_game: null,
					is_past_match: false,
				},
				{
					total_rows: 2,
					week_number: 4,
					match_datetime: "Mar 08, 2026 06:00pm",
					opponent_team_name: "Kitchen Kings",
					match_result: "Win",
					team_points: 21,
					opponent_points: 16,
					playoffs: true,
					playoff_game: 2,
					is_past_match: true,
				},
			],
		});

		const result = await fetchTeamScheduleQuery(env, {
			queryType: "team_schedule",
			scope: {
				seasonYear: 2025,
				seasonNumber: 3,
				divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
				divisionName: "3.5",
				teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
				teamName: "Drop Shotters",
			},
			viewState: {
				page: 1,
				pageSize: 20,
				sortKey: "weekNumber",
				sortDirection: "asc",
			},
		});

		expect(result.title).toBe("Team Schedule");
		expect(result.layout).toBe("table");
		expect(result.breadcrumb).toEqual([
			"2025 S3",
			"3.5",
			"Drop Shotters",
			"Schedule",
		]);
		expect(result.payload).toEqual({
			columns: [
				{ key: "weekNumber", label: "Week" },
				{ key: "matchDateTime", label: "Match Time" },
				{ key: "opponentTeamName", label: "Opponent" },
				{ key: "matchResult", label: "Result" },
				{ key: "score", label: "Score" },
				{ key: "stage", label: "Stage" },
			],
			rows: [
				{
					weekNumber: 3,
					matchDateTime: "Mar 01, 2026 06:00pm",
					opponentTeamName: "Topspin Club",
					matchResult: "Scheduled",
					score: null,
					stage: "Regular",
				},
				{
					weekNumber: 4,
					matchDateTime: "Mar 08, 2026 06:00pm",
					opponentTeamName: "Kitchen Kings",
					matchResult: "Win",
					score: "21-16",
					stage: "Playoff 2",
				},
			],
		});

		const executedQuery = poolQueryMock.mock.calls[0]?.[0];
		expect(executedQuery).toContain("public.vw_team_matches");
		expect(executedQuery).toContain("v.team_name = $5");
		expect(executedQuery).not.toContain("selected_team as (");
		expect(executedQuery).not.toContain("where t.team_id = $5::uuid");
		expect(poolQueryMock.mock.calls[0]?.[1]).toEqual([
			"e8d04726-4c07-447c-a609-9914d1378e8d",
			2025,
			3,
			"NJ/PA",
			"Drop Shotters",
			20,
			0,
		]);
	});
});
