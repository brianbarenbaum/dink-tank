import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ScheduleMetadataHeader from "../src/features/lineup-lab/components/ScheduleMetadataHeader.vue";
import ScheduleConfigurationBoard from "../src/features/lineup-lab/components/ScheduleConfigurationBoard.vue";
import type { LineupRecommendationPayload } from "../src/features/lineup-lab/types";

const payload: LineupRecommendationPayload = {
	requestId: "req_diag",
	generatedAt: new Date(0).toISOString(),
	objective: "MAX_EXPECTED_WINS",
	recommendations: [
		{
			rank: 1,
			pairSetId: "set_diag",
			pairs: [],
			expectedWins: 15.2,
			floorWinsQ20: 12.1,
			matchupWinProbability: 0.63,
			volatility: 1.2,
			confidence: "HIGH",
			gameConfidence: "HIGH",
			matchupConfidence: "MEDIUM",
			duprApplied: true,
			duprCoverageCount: 4,
			duprWeightApplied: 0.65,
			teamStrengthApplied: true,
			rounds: [
				{
					roundNumber: 1,
					games: [
						{
							roundNumber: 1,
							slotNumber: 1,
							matchType: "mixed",
							playerAId: "a",
							playerBId: "b",
							winProbability: 0.67,
							duprApplied: true,
							duprCoverageCount: 4,
							duprWeightApplied: 0.65,
							teamStrengthApplied: true,
						},
					],
				},
			],
		},
	],
	scenarioSummary: { scenarioCount: 1 },
	playerDirectory: { a: "Alex A", b: "Bailey B" },
};

describe("lineup lab diagnostics rendering", () => {
	it("renders recommendation-level info popovers in metadata", async () => {
		const wrapper = mount(ScheduleMetadataHeader, {
			props: {
				recommendationResult: payload,
			},
		});

		expect(
			wrapper.find("[data-testid='metric-info-button-expected-wins']").exists(),
		).toBe(true);
		expect(
			wrapper
				.find("[data-testid='metric-info-button-conservative-wins']")
				.exists(),
		).toBe(true);
		expect(
			wrapper.find("[data-testid='metric-info-button-win-pct']").exists(),
		).toBe(true);
		expect(
			wrapper.find("[data-testid='metric-info-button-game-conf']").exists(),
		).toBe(true);
		expect(
			wrapper.find("[data-testid='metric-info-button-matchup-conf']").exists(),
		).toBe(true);

		await wrapper
			.get("[data-testid='metric-info-button-expected-wins']")
			.trigger("click");
		const expectedPopover = wrapper.get(
			"[data-testid='metric-info-popover-expected-wins']",
		);
		expect(expectedPopover.text()).toContain("Expected Wins");
		expect(expectedPopover.text()).toContain("DUPR");
		expect(expectedPopover.text()).toContain("Team strength");

		await wrapper
			.get("[data-testid='metric-info-button-game-conf']")
			.trigger("click");
		const gameConfidencePopover = wrapper.get(
			"[data-testid='metric-info-popover-game-conf']",
		);
		expect(gameConfidencePopover.text()).toContain("Game Confidence");
		expect(gameConfidencePopover.text().toLowerCase()).toContain("high");
	});

	it("renders per-game win metric popovers in schedule output", async () => {
		const wrapper = mount(ScheduleConfigurationBoard, {
			props: {
				mode: "blind",
				recommendationResult: payload,
				opponentRosterPlayers: [],
				opponentAssignments: {},
			},
		});

		const slot = wrapper.get("[data-testid='round-slot-1-1-optimizer-output']");
		expect(slot.text()).toContain("Win");
		await wrapper
			.get("[data-testid='game-win-info-button-1-1']")
			.trigger("click");
		const popover = wrapper.get("[data-testid='game-win-info-popover-1-1']");
		expect(popover.text()).toContain("Win % is");
		expect(popover.text()).toContain("DUPR");
		expect(popover.text()).toContain("Team strength");
	});
});
