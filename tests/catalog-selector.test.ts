import { describe, expect, it } from "vitest";

import {
	buildCatalogSchemaContextForViews,
	classifyWonLostIntent,
	selectCatalogContext,
	type CatalogSelectorInput,
} from "../worker/src/runtime/catalog/catalog";

const runSelect = (question: string): CatalogSelectorInput =>
	selectCatalogContext(question, {
		mode: "hybrid",
		topK: 2,
		confidenceMin: 0.3,
	});

describe("catalog selector", () => {
	it("routes player quality questions to season player stats view", () => {
		const selected = runSelect("Is Ilene Hollin a good player?");

		expect(selected.selectedViews[0]).toBe("public.vw_player_stats_per_season");
		expect(selected.selectedSchema).toContain(
			"public.vw_player_stats_per_season",
		);
		expect(selected.selectedSchema).toContain("- sample_data:");
		expect(selected.selectedSchema).toContain(
			'"player_full_name":"Maria Valencia"',
		);
		expect(selected.confidence).toBeGreaterThan(0);
	});

	it("routes team schedule questions to team schedule view", () => {
		const selected = runSelect("Show Bounce Philly schedule for next 3 weeks");

		expect(selected.selectedViews[0]).toBe("public.vw_team_matches");
		expect(selected.selectedSchema).toContain("opponent_team_name");
		expect(selected.selectedSchema).toContain('"team_name":"Home Court"');
	});

	it("routes partner-intent questions to player game history view", () => {
		const selected = runSelect("Who was Brian Barenbaum's partner in week 3?");

		expect(selected.selectedViews[0]).toBe("public.vw_player_game_history");
		expect(selected.selectedSchema).toContain("partner_player_full_name");
		expect(selected.selectedSchema).toContain("primary_side_score");
		expect(selected.selectedSchema).not.toContain("matchup_id");
		expect(selected.selectedSchema).not.toContain("scheduled_time_utc");
	});

	it("builds view context with static sample data rows", () => {
		const context = buildCatalogSchemaContextForViews(
			["public.vw_team_matches"],
			20,
		);

		expect(context).toContain("- sample_data:");
		expect(context).toContain('"team_name":"Bounce Malvern"');
		expect(context).toContain('"match_result":"Win"');
	});

	it("falls back to safe default view when confidence is below threshold", () => {
		const selected = selectCatalogContext("zzzz qqqq unknown intent", {
			mode: "hybrid",
			topK: 2,
			confidenceMin: 0.95,
		});

		expect(selected.selectedViews).toEqual(["public.vw_team_matches"]);
		expect(selected.reason).toContain("below confidence threshold");
		expect(selected.catalogContext).toContain("public.vw_team_matches");
		expect(selected.catalogContext).toContain("- sample_data:");
	});

	it("returns low confidence for broad unclear prompts", () => {
		const selected = runSelect("How are they doing lately?");

		expect(selected.confidence).toBeLessThan(0.5);
		expect(selected.reason.length).toBeGreaterThan(0);
	});

	it("classifies team-level won/lost intent to team match summary", () => {
		const decision = classifyWonLostIntent(
			"Can you give me every match for Bounce Philly 4.0 and whether they won or lost?",
		);
		expect(decision?.preferredView).toBe("public.vw_team_matches");
		expect(decision?.clarification).toBeUndefined();
	});

	it("classifies player-level won/lost intent to player stats per match", () => {
		const decision = classifyWonLostIntent(
			"How many did Brian Barenbaum win or lose per match?",
		);
		expect(decision?.preferredView).toBe("public.vw_player_stats_per_match");
		expect(decision?.clarification).toBeUndefined();
	});

	it("asks clarification for ambiguous won/lost intent", () => {
		const decision = classifyWonLostIntent("Who won or lost last week?");
		expect(decision?.clarification).toContain(
			"team match results or player match stats",
		);
	});

	it("honors explicit team follow-up resolution phrase", () => {
		const decision = classifyWonLostIntent("Team match results");
		expect(decision?.preferredView).toBe("public.vw_team_matches");
		expect(decision?.clarification).toBeUndefined();
	});

	it("honors explicit player follow-up resolution phrase", () => {
		const decision = classifyWonLostIntent("Player match stats");
		expect(decision?.preferredView).toBe("public.vw_player_stats_per_match");
		expect(decision?.clarification).toBeUndefined();
	});
});
