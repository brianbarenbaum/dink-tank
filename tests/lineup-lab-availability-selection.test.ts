import { describe, expect, it, vi } from "vitest";

import { createChatController } from "../src/features/chat/useChatController";
import type { LineupRecommendationPayload } from "../src/features/chat/types";

const divisionId = "e8d04726-4c07-447c-a609-9914d1378e8d";
const teamId = "a7d5c302-9ee0-4bd6-9205-971efe6af562";
const matchupId = "99bb7ced-889b-4e42-91b8-f84878c5c43b";

const makeController = (recommendLineup: ReturnType<typeof vi.fn>) =>
	createChatController(
		vi.fn().mockResolvedValue({ reply: "done", model: "gpt-5.1" }),
		recommendLineup as (input: {
			divisionId: string;
			seasonYear: number;
			seasonNumber: number;
			teamId: string;
			oppTeamId: string;
			matchupId: string;
			availablePlayerIds: string[];
		}) => Promise<LineupRecommendationPayload>,
		async () => ({
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
		async () => ({
			teams: [
				{
					teamId,
					teamName: "Team A",
				},
			],
		}),
		async () => ({
			matchups: [
				{
					matchupId,
					weekNumber: 1,
					scheduledTime: new Date(0).toISOString(),
					teamId,
					oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
					teamName: "Team A",
					oppTeamName: "Team B",
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
	);

describe("lineup lab availability selection", () => {
	it("defaults to suggested players and allows explicit overrides", async () => {
		const recommendLineup = vi.fn().mockResolvedValue({
			requestId: "req_lineup",
			generatedAt: new Date(0).toISOString(),
			objective: "MAX_EXPECTED_WINS",
			recommendations: [],
			scenarioSummary: { scenarioCount: 12 },
			playerDirectory: {},
		});
		const controller = makeController(recommendLineup);

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
		await controller.runLineupLabRecommend();

		expect(recommendLineup).toHaveBeenCalledTimes(1);
		const payload = recommendLineup.mock.calls[0]?.[0];
		expect(payload.availablePlayerIds).toContain(
			"99999999-9999-4999-8999-999999999999",
		);
		expect(payload.availablePlayerIds).not.toContain(
			"11111111-1111-4111-8111-111111111111",
		);
	});
});
