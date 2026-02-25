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
	fetchLineupLabDivisions,
	fetchLineupLabFeatureBundle,
} from "../worker/src/runtime/lineupLab/repository";

describe("lineup lab repository", () => {
	beforeEach(() => {
		poolQueryMock.mockReset();
		poolConfigCalls.length = 0;
	});

	it("fetches and returns lineup feature bundle payload", async () => {
		const scheduledTime = "2026-02-23T19:30:00.000Z";
		poolQueryMock
			.mockResolvedValueOnce({
				rows: [
					{
						matchup_id: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
						division_id: "e8d04726-4c07-447c-a609-9914d1378e8d",
						week_number: 4,
						scheduled_time: scheduledTime,
						home_team_id: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
						away_team_id: "6bb73493-1a15-4527-9765-6aadfaca773b",
					},
				],
			})
			.mockResolvedValueOnce({
				rows: [
					{
						payload: {
							candidate_pairs: [
								{
									pair_player_low_id: "11111111-1111-4111-8111-111111111111",
									pair_player_high_id: "22222222-2222-4222-8222-222222222222",
									pair_key:
										"11111111-1111-4111-8111-111111111111__22222222-2222-4222-8222-222222222222",
								},
							],
							opponent_scenarios: [
								{
									scenario_id: "scenario-1",
									scenario_probability: 0.5,
									scenario_pairs: [],
								},
							],
							pair_matchups: [],
							team_strength: {
								our_team_id: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
								opp_team_id: "6bb73493-1a15-4527-9765-6aadfaca773b",
								our_team_strength: 0.66,
								opp_team_strength: 0.42,
								strength_delta: 0.24,
								snapshot_date: "2026-02-15",
							},
							players_catalog: [
								{
									player_id: "11111111-1111-4111-8111-111111111111",
									first_name: "Alex",
									last_name: "One",
									gender: "male",
									dupr_rating: 4.02,
								},
							],
						},
					},
				],
			});

		const bundle = await fetchLineupLabFeatureBundle(
			{
				OPENAI_API_KEY: "test-key",
				SUPABASE_DB_URL:
					"postgres://postgres:postgres@localhost:5432/postgres?test=lineup-lab-repository",
				SUPABASE_DB_SSL_NO_VERIFY: true,
				LLM_MODEL: "gpt-4.1-mini",
				LLM_REASONING_LEVEL: "medium",
				SQL_QUERY_TIMEOUT_MS: 10_000,
				SQL_CAPTURE_EXPLAIN_PLAN: false,
				EXPOSE_ERROR_DETAILS: false,
				LANGFUSE_TRACING_ENVIRONMENT: "default",
				LANGFUSE_ENABLED: false,
			} as const,
			{
				divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
				seasonYear: 2025,
				seasonNumber: 3,
				teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
				oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
				matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
				mode: "blind",
				availablePlayerIds: [
					"11111111-1111-4111-8111-111111111111",
					"22222222-2222-4222-8222-222222222222",
					"33333333-3333-4333-8333-333333333333",
					"44444444-4444-4444-8444-444444444444",
					"55555555-5555-4555-8555-555555555555",
					"66666666-6666-4666-8666-666666666666",
					"77777777-7777-4777-8777-777777777777",
					"88888888-8888-4888-8888-888888888888",
				],
				objective: "MAX_EXPECTED_WINS",
				maxRecommendations: 3,
				downsideQuantile: 0.2,
				scenarioLimit: 12,
				opponentRounds: [
					{
						roundNumber: 1,
						games: [
							{
								roundNumber: 1,
								slotNumber: 1,
								matchType: "mixed",
								opponentPlayerAId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
								opponentPlayerBId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
							},
						],
					},
				],
			},
		);

		expect(poolQueryMock).toHaveBeenCalledTimes(2);
		expect(poolQueryMock.mock.calls[1]?.[0]).toContain("$10::uuid[]");
		expect(poolQueryMock.mock.calls[1]?.[1]?.[8]).toBe(scheduledTime);
		expect(poolQueryMock.mock.calls[1]?.[1]?.[9]).toEqual([
			"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		]);
		expect(bundle.opponent_scenarios).toHaveLength(1);
		expect(bundle.candidate_pairs).toHaveLength(1);
		expect(bundle.players_catalog?.[0]?.dupr_rating).toBe(4.02);
		expect(bundle.team_strength?.strength_delta).toBe(0.24);
	});

	it("applies a 2s query timeout for context division queries", async () => {
		poolQueryMock.mockResolvedValueOnce({
			rows: [
				{
					division_id: "e8d04726-4c07-447c-a609-9914d1378e8d",
					division_name: "4.0",
					season_year: 2025,
					season_number: 3,
					location: "NJ / PA",
				},
			],
		});

		await fetchLineupLabDivisions({
			OPENAI_API_KEY: "test-key",
			SUPABASE_DB_URL:
				"postgres://postgres:postgres@localhost:5432/postgres?test=lineup-lab-context-timeout",
			SUPABASE_DB_SSL_NO_VERIFY: true,
			LLM_MODEL: "gpt-4.1-mini",
			LLM_REASONING_LEVEL: "medium",
			SQL_QUERY_TIMEOUT_MS: 25_000,
			SQL_CAPTURE_EXPLAIN_PLAN: false,
			EXPOSE_ERROR_DETAILS: false,
			LANGFUSE_TRACING_ENVIRONMENT: "default",
			LANGFUSE_ENABLED: false,
		} as const);

		expect(poolQueryMock).toHaveBeenCalledTimes(1);
		expect(poolConfigCalls).toHaveLength(1);
		expect(poolConfigCalls[0]).toMatchObject({
			query_timeout: 2000,
		});
	});
});
