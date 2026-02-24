import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import LineupRecommendationCard from "../src/features/chat/components/LineupRecommendationCard.vue";
import type { LineupRecommendationPayload } from "../src/features/lineup-lab/types";

const payload: LineupRecommendationPayload = {
	requestId: "req_1",
	generatedAt: new Date(0).toISOString(),
	objective: "MAX_EXPECTED_WINS",
	recommendations: [
		{
			rank: 1,
			pairSetId: "set_1",
			pairs: [],
			expectedWins: 18.2,
			floorWinsQ20: 14.6,
			matchupWinProbability: 0.71,
			volatility: 1.9,
			confidence: "HIGH",
			gameConfidence: "HIGH",
			matchupConfidence: "MEDIUM",
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
							winProbability: 0.62,
						},
					],
				},
			],
			pairUsage: [],
		},
	],
	scenarioSummary: { scenarioCount: 12 },
	playerDirectory: {
		a: "Jane Doe",
		b: "Sam Smith",
	},
};

describe("LineupRecommendationCard", () => {
	it("renders schedule metrics and round probability labels", () => {
		const wrapper = mount(LineupRecommendationCard, {
			props: { payload },
		});

		expect(wrapper.text()).toContain("Show Advanced Options");
		expect(wrapper.text()).toContain("Expected Wins");
		expect(wrapper.text()).toContain("Conservative Wins");
		expect(wrapper.text()).toContain("Matchup Win %");
		expect(wrapper.text()).toContain("Game Confidence");
		expect(wrapper.text()).toContain("Matchup Confidence");
		expect(wrapper.text()).toContain("71%");
		expect(wrapper.text()).toContain("Round 1");
		expect(wrapper.text()).toContain("Win Probability");
		expect(wrapper.text()).toContain("mixed");
		expect(wrapper.text()).toContain("62%");
		expect(wrapper.text()).not.toContain("Optimal Lineup Set #1");
		expect(wrapper.text()).not.toContain("MAX_EXPECTED_WINS");
	});

	it("emits inspect when advanced options is clicked", async () => {
		const wrapper = mount(LineupRecommendationCard, {
			props: { payload },
		});

		await wrapper
			.get("[data-testid='lineup-advanced-options-button']")
			.trigger("click");
		expect(wrapper.emitted("inspect")).toHaveLength(1);
	});

	it("toggles help tooltips on question mark click", async () => {
		const wrapper = mount(LineupRecommendationCard, {
			props: { payload },
		});

		expect(wrapper.find("[data-testid='expected-wins-tooltip']").exists()).toBe(
			false,
		);
		await wrapper
			.get("[data-testid='expected-wins-help-button']")
			.trigger("click");
		expect(wrapper.find("[data-testid='expected-wins-tooltip']").exists()).toBe(
			true,
		);
		expect(wrapper.text()).toContain("Average wins we expect");
		await wrapper
			.get("[data-testid='conservative-wins-help-button']")
			.trigger("click");
		expect(wrapper.find("[data-testid='expected-wins-tooltip']").exists()).toBe(
			false,
		);
		expect(
			wrapper.find("[data-testid='conservative-wins-tooltip']").exists(),
		).toBe(true);
	});
});
