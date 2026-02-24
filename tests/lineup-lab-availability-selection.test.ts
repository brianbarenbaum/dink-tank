import { describe, expect, it, vi } from "vitest";

import { createLineupLabController } from "../src/features/lineup-lab/useLineupLabController";
import type { LineupLabClient } from "../src/features/lineup-lab/lineupLabClient";

const divisionId = "e8d04726-4c07-447c-a609-9914d1378e8d";
const teamId = "a7d5c302-9ee0-4bd6-9205-971efe6af562";
const matchupId = "99bb7ced-889b-4e42-91b8-f84878c5c43b";

const buildClient = (recommend = vi.fn()) => {
	const mockRecommend = recommend.mockResolvedValue({
		requestId: "req_lineup",
		generatedAt: new Date(0).toISOString(),
		objective: "MAX_EXPECTED_WINS",
		recommendations: [],
		scenarioSummary: { scenarioCount: 12 },
		playerDirectory: {},
	});
	const client: LineupLabClient = {
		recommend: mockRecommend,
		getDivisions: async () => ({
			divisions: [
				{
					divisionId,
					divisionName: "4.0",
					seasonYear: 2025,
					seasonNumber: 3,
					location: "NJ / PA",
				},
			],
		}),
		getTeams: async () => ({
			teams: [{ teamId, teamName: "Team A" }],
		}),
		getMatchups: async () => ({
			matchups: [
				{
					matchupId,
					weekNumber: 1,
					scheduledTime: new Date(0).toISOString(),
					teamId,
					oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
					teamName: "Team A",
					oppTeamName: "Team B",
					opponentRosterPlayers: [
						{
							playerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
							firstName: "Alex",
							lastName: "Opp",
							gender: "male",
							isSub: false,
						},
						{
							playerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
							firstName: "Casey",
							lastName: "Opp",
							gender: "female",
							isSub: false,
						},
					],
				},
			],
			availablePlayerIds: [
				"11111111-1111-4111-8111-111111111111",
				"22222222-2222-4222-8222-222222222222",
				"33333333-3333-4333-8333-333333333333",
				"44444444-4444-4444-8444-444444444444",
				"55555555-5555-4555-8555-555555555555",
				"66666666-6666-4666-8666-666666666666",
				"77777777-7777-4777-8777-777777777777",
				"88888888-8888-4888-8888-888888888888",
				"99999999-9999-4999-8999-999999999999",
			],
			suggestedAvailablePlayerIds: [
				"11111111-1111-4111-8111-111111111111",
				"22222222-2222-4222-8222-222222222222",
				"33333333-3333-4333-8333-333333333333",
				"44444444-4444-4444-8444-444444444444",
				"55555555-5555-4555-8555-555555555555",
				"66666666-6666-4666-8666-666666666666",
				"77777777-7777-4777-8777-777777777777",
				"88888888-8888-4888-8888-888888888888",
			],
			rosterPlayers: [
				{
					playerId: "11111111-1111-4111-8111-111111111111",
					firstName: "Player",
					lastName: "One",
					gender: "female",
					isSub: false,
					suggested: true,
				},
				{
					playerId: "99999999-9999-4999-8999-999999999999",
					firstName: "Ninth",
					lastName: "Player",
					gender: "male",
					isSub: true,
					suggested: false,
				},
			],
		}),
	};
	return { client, mockRecommend };
};

describe("lineup lab availability selection", () => {
	it("defaults to suggested players and allows explicit overrides", async () => {
		const { client, mockRecommend } = buildClient();
		const controller = createLineupLabController(client);

		await controller.selectLineupDivision(divisionId);
		await controller.selectLineupTeam(teamId);

		expect(controller.selectedAvailablePlayerIds.value).toContain(
			"11111111-1111-4111-8111-111111111111",
		);
		expect(controller.selectedAvailablePlayerIds.value).not.toContain(
			"99999999-9999-4999-8999-999999999999",
		);

		controller.selectLineupPlayerAvailability(
			"99999999-9999-4999-8999-999999999999",
			true,
		);
		controller.selectLineupPlayerAvailability(
			"11111111-1111-4111-8111-111111111111",
			false,
		);
		await controller.calculate();

		expect(mockRecommend).toHaveBeenCalledTimes(1);
		const payload = mockRecommend.mock.calls[0]?.[0];
		expect(payload.mode).toBe("blind");
		expect(payload.availablePlayerIds).toContain(
			"99999999-9999-4999-8999-999999999999",
		);
		expect(payload.availablePlayerIds).not.toContain(
			"11111111-1111-4111-8111-111111111111",
		);
	});

	it("sends opponent rounds in known-opponent mode", async () => {
		const { client, mockRecommend } = buildClient();
		const controller = createLineupLabController(client);

		await controller.selectLineupDivision(divisionId);
		await controller.selectLineupTeam(teamId);
		controller.setMode("known_opponent");
		for (let roundNumber = 1; roundNumber <= 8; roundNumber += 1) {
			for (let slotNumber = 1; slotNumber <= 4; slotNumber += 1) {
				controller.setOpponentSlotAssignment(
					roundNumber,
					slotNumber,
					"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
					"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
				);
			}
		}

		await controller.calculate();

		expect(mockRecommend).toHaveBeenCalledTimes(1);
		const payload = mockRecommend.mock.calls[0]?.[0];
		expect(payload.mode).toBe("known_opponent");
		expect(Array.isArray(payload.opponentRounds)).toBe(true);
		expect(payload.opponentRounds).toHaveLength(8);
	});
});
