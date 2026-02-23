import { beforeEach, describe, expect, it, vi } from "vitest";

const { poolQueryMock, MockPool } = vi.hoisted(() => {
	const queryMock = vi.fn();
	class PoolMock {
		query = queryMock;
	}
	return {
		poolQueryMock: queryMock,
		MockPool: PoolMock,
	};
});

vi.mock("pg", () => ({
	Pool: MockPool,
}));

import { fetchLineupLabFeatureBundle } from "../worker/src/runtime/lineupLab/repository";

describe("lineup lab repository", () => {
	beforeEach(() => {
		poolQueryMock.mockReset();
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
						},
					},
				],
			});

		const bundle = await fetchLineupLabFeatureBundle(
			{
				SUPABASE_DB_URL:
					"postgres://postgres:postgres@localhost:5432/postgres?test=lineup-lab-repository",
				SUPABASE_DB_SSL_NO_VERIFY: true,
				SQL_QUERY_TIMEOUT_MS: 10_000,
			} as const,
			{
				divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
				seasonYear: 2025,
				seasonNumber: 3,
				teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
				oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
				matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
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
			},
		);

		expect(poolQueryMock).toHaveBeenCalledTimes(2);
		expect(poolQueryMock.mock.calls[1]?.[0]).toContain("$9::timestamptz");
		expect(poolQueryMock.mock.calls[1]?.[1]?.[8]).toBe(scheduledTime);
		expect(bundle.opponent_scenarios).toHaveLength(1);
		expect(bundle.candidate_pairs).toHaveLength(1);
	});
});
