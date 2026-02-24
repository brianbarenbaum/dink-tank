import { describe, expect, it, vi } from "vitest";

import { createLineupLabClient } from "../src/features/lineup-lab/lineupLabClient";

describe("lineup lab client", () => {
	it("posts blind mode payload", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				requestId: "req_1",
				generatedAt: new Date(0).toISOString(),
				objective: "MAX_EXPECTED_WINS",
				recommendations: [],
				scenarioSummary: { scenarioCount: 1 },
			}),
		});
		const client = createLineupLabClient(fetchMock as unknown as typeof fetch, () => null);

		await client.recommend({
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
		});

		const [, requestInit] = fetchMock.mock.calls[0] ?? [];
		expect(requestInit?.method).toBe("POST");
		const body = JSON.parse(String(requestInit?.body)) as { mode: string };
		expect(body.mode).toBe("blind");
	});

	it("posts known-opponent payload with opponent rounds", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				requestId: "req_1",
				generatedAt: new Date(0).toISOString(),
				objective: "MAX_EXPECTED_WINS",
				recommendations: [],
				scenarioSummary: { scenarioCount: 1 },
			}),
		});
		const client = createLineupLabClient(fetchMock as unknown as typeof fetch, () => null);

		await client.recommend({
			divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
			seasonYear: 2025,
			seasonNumber: 3,
			teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
			oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
			matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
			mode: "known_opponent",
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
			opponentRounds: [
				{
					roundNumber: 1,
					games: [
						{
							roundNumber: 1,
							slotNumber: 1,
							matchType: "mixed",
							opponentPlayerAId:
								"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
							opponentPlayerBId:
								"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
						},
					],
				},
			],
			opponentRoster: [
				{
					playerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
					gender: "Male",
				},
				{
					playerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
					gender: "Female",
				},
			],
		});

		const [, requestInit] = fetchMock.mock.calls[0] ?? [];
		const body = JSON.parse(String(requestInit?.body)) as {
			mode: string;
			opponentRounds?: unknown[];
			opponentRoster?: unknown[];
		};
		expect(body.mode).toBe("known_opponent");
		expect(Array.isArray(body.opponentRounds)).toBe(true);
		expect(Array.isArray(body.opponentRoster)).toBe(true);
	});
});
