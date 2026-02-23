import { describe, expect, it, vi } from "vitest";

import { createChatController } from "../src/features/chat/useChatController";

describe("chat controller", () => {
	it("adds user message and assistant reply from api", async () => {
		const send = vi.fn().mockResolvedValue({
			reply: "Try neutralizing from mid-court.",
			model: "gpt-5.1",
		});
		const recommendLineup = vi.fn().mockResolvedValue({
			requestId: "req_1",
			generatedAt: new Date(0).toISOString(),
			objective: "MAX_EXPECTED_WINS",
			recommendations: [],
			scenarioSummary: { scenarioCount: 0 },
			playerDirectory: {},
		});
			const controller = createChatController(
				send,
				recommendLineup,
				async () => ({ divisions: [] }),
				async () => ({ teams: [] }),
				async () => ({
					matchups: [],
					availablePlayerIds: [],
					suggestedAvailablePlayerIds: [],
					rosterPlayers: [],
				}),
			);

		await controller.submit("How to counter bangers?");

		expect(controller.messages.value.at(-2)?.role).toBe("user");
		expect(controller.messages.value.at(-1)?.role).toBe("assistant");
		expect(controller.modelLabel.value).toBe("gpt-5.1");
	});

	it("sends extended thinking option when enabled", async () => {
		const send = vi.fn().mockResolvedValue({ reply: "done", model: "gpt-5.1" });
		const recommendLineup = vi.fn().mockResolvedValue({
			requestId: "req_1",
			generatedAt: new Date(0).toISOString(),
			objective: "MAX_EXPECTED_WINS",
			recommendations: [],
			scenarioSummary: { scenarioCount: 0 },
			playerDirectory: {},
		});
			const controller = createChatController(
				send,
				recommendLineup,
				async () => ({ divisions: [] }),
				async () => ({ teams: [] }),
				async () => ({
					matchups: [],
					availablePlayerIds: [],
					suggestedAvailablePlayerIds: [],
					rosterPlayers: [],
				}),
			);
		controller.extendedThinking.value = true;

		await controller.submit("What are our playoff odds?");

		expect(send).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({ extendedThinking: true }),
		);
	});

	it("loads model label from backend config on init", async () => {
		const send = vi.fn().mockResolvedValue({ reply: "done", model: "gpt-5.1" });
		const recommendLineup = vi.fn().mockResolvedValue({
			requestId: "req_1",
			generatedAt: new Date(0).toISOString(),
			objective: "MAX_EXPECTED_WINS",
			recommendations: [],
			scenarioSummary: { scenarioCount: 0 },
			playerDirectory: {},
		});
		const getConfig = vi.fn().mockResolvedValue({ model: "gpt-5.1" });
		const controller = createChatController(
			send,
			recommendLineup,
			async () => ({
				divisions: [
					{
						divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
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
						teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
						teamName: "Team A",
					},
				],
			}),
				async () => ({
					matchups: [
					{
						matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
						weekNumber: 1,
						scheduledTime: new Date(0).toISOString(),
						teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
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
					rosterPlayers: [],
				}),
				getConfig,
			);

		await Promise.resolve();

		expect(controller.modelLabel.value).toBe("gpt-5.1");
	});

	it("adds lineup recommendation message when explorer shortcut runs", async () => {
		const send = vi.fn().mockResolvedValue({ reply: "done", model: "gpt-5.1" });
		const recommendLineup = vi.fn().mockResolvedValue({
			requestId: "req_lineup",
			generatedAt: new Date(0).toISOString(),
			objective: "MAX_EXPECTED_WINS",
			recommendations: [
				{
					rank: 1,
					pairSetId: "set_1",
					pairs: [],
					expectedWins: 2.4,
					floorWinsQ20: 1.8,
					matchupWinProbability: 0.63,
					volatility: 0.4,
					confidence: "MEDIUM",
					gameConfidence: "MEDIUM",
					matchupConfidence: "MEDIUM",
				},
			],
			scenarioSummary: { scenarioCount: 12 },
			playerDirectory: {},
		});
		const controller = createChatController(
			send,
			recommendLineup,
			async () => ({
				divisions: [
					{
						divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
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
						teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
						teamName: "Team A",
					},
				],
			}),
				async () => ({
					matchups: [
					{
						matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
						weekNumber: 1,
						scheduledTime: new Date(0).toISOString(),
						teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
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
					rosterPlayers: [],
				}),
			);

		await controller.runLineupLabRecommend();

		expect(recommendLineup).toHaveBeenCalledTimes(1);
		expect(
			controller.messages.value.find(
				(message) => message.kind === "lineup_recommendation",
			),
		).toBeTruthy();
	});

	it("adds assistant fallback message when lineup recommendation fails", async () => {
		const send = vi.fn().mockResolvedValue({ reply: "done", model: "gpt-5.1" });
		const recommendLineup = vi.fn().mockRejectedValue(new Error("boom"));
		const controller = createChatController(
			send,
			recommendLineup,
			async () => ({
				divisions: [
					{
						divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
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
						teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
						teamName: "Team A",
					},
				],
			}),
				async () => ({
					matchups: [
					{
						matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
						weekNumber: 1,
						scheduledTime: new Date(0).toISOString(),
						teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
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
					rosterPlayers: [],
				}),
			);

		await controller.runLineupLabRecommend();

			expect(
				controller.messages.value.find(
					(message) =>
						message.role === "assistant" &&
						message.content.includes("couldn't generate pairings"),
				),
			).toBeTruthy();
		});

	it("uses explicit selected availability when running lineup recommendations", async () => {
		const send = vi.fn().mockResolvedValue({ reply: "done", model: "gpt-5.1" });
		const recommendLineup = vi.fn().mockResolvedValue({
			requestId: "req_lineup",
			generatedAt: new Date(0).toISOString(),
			objective: "MAX_EXPECTED_WINS",
			recommendations: [],
			scenarioSummary: { scenarioCount: 12 },
			playerDirectory: {},
		});
		const controller = createChatController(
			send,
			recommendLineup,
			async () => ({
				divisions: [
					{
						divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
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
						teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
						teamName: "Team A",
					},
				],
			}),
			async () => ({
				matchups: [
					{
						matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
						weekNumber: 1,
						scheduledTime: new Date(0).toISOString(),
						teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
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
					"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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
						playerId: "99999999-9999-4999-8999-999999999999",
						firstName: "Ninth",
						lastName: "Player",
						gender: "male",
						isSub: false,
						suggested: false,
					},
				],
			}),
		);

		await controller.selectLineupPlayerAvailability(
			"99999999-9999-4999-8999-999999999999",
			true,
		);
		await controller.selectLineupPlayerAvailability(
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
