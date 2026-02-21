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

	it("routes division ranking questions to player stats per season view", () => {
		const selected = runSelect(
			"Who is the player ranked #2 overall in the 3.0 division?",
		);

		expect(selected.selectedViews[0]).toBe("public.vw_player_stats_per_season");
		expect(selected.selectedSchema).toContain(
			"public.vw_player_stats_per_season",
		);
		expect(selected.selectedSchema).toContain("ranking");
	});

	it("does not treat avoidFor text as positive ranking intent", () => {
		const selected = runSelect("Show season-level player ranking leaderboards");

		expect(selected.selectedViews[0]).not.toBe("public.vw_player_game_history");
	});

	it("routes team schedule questions to team schedule view", () => {
		const selected = runSelect("Show Bounce Philly schedule for next 3 weeks");

		expect(selected.selectedViews[0]).toBe("public.vw_team_matches");
		expect(selected.selectedSchema).toContain("opponent_team_name");
		expect(selected.selectedSchema).toContain('"team_name":"Home Court"');
	});

	it("routes shorthand pod comparison prompts to team standings", () => {
		const selected = runSelect(
			"Compare the Avg PPG of 3.0 Northwest and 3.0 Southeast",
		);

		expect(selected.selectedViews[0]).toBe("public.vw_team_standings");
	});

	it("routes team game total intent to standings", () => {
		const selected = runSelect(
			"How many games has Flemington Blue 3.0 won this season?",
		);

		expect(selected.selectedViews[0]).toBe("public.vw_team_standings");
	});

	it("routes team match total intent to standings", () => {
		const selected = runSelect(
			"How many matches has Flemington Blue 3.0 won this season?",
		);

		expect(selected.selectedViews[0]).toBe("public.vw_team_standings");
	});

	it("keeps roster view for team member queries at runtime confidence settings", () => {
		const selected = selectCatalogContext(
			"Show me the players on Bounce Philly 4.0 Open",
			{
				mode: "hybrid",
				topK: 2,
				confidenceMin: 0.35,
			},
		);

		expect(selected.selectedViews[0]).toBe("public.vw_player_team");
		expect(selected.reason).not.toContain("fallback to public.vw_team_matches");
		expect(selected.catalogContext).toContain("player_full_name");
	});

	it("routes partner-intent questions to player game history view", () => {
		const selected = runSelect("Who was Brian Barenbaum's partner in week 3?");

		expect(selected.selectedViews[0]).toBe("public.vw_player_game_history");
		expect(selected.selectedSchema).toContain("partner_player_full_name");
		expect(selected.selectedSchema).toContain("primary_player_gender");
		expect(selected.selectedSchema).toContain("partner_player_gender");
		expect(selected.selectedSchema).toContain("opponent_player_1_gender");
		expect(selected.selectedSchema).toContain("opponent_player_2_gender");
		expect(selected.selectedSchema).toContain("primary_side_score");
		expect(selected.selectedSchema).not.toContain("matchup_id");
		expect(selected.selectedSchema).not.toContain("scheduled_time_utc");
	});

	it("routes partner performance analytics to partner summary view", () => {
		const selected = runSelect(
			"How has Brian Barenbaum played with Thomas Kang against mixed opponents?",
		);

		expect(selected.selectedViews[0]).toBe(
			"public.vw_player_partner_performance_summary",
		);
		expect(selected.selectedSchema).toContain("partner_pair_type");
		expect(selected.selectedSchema).toContain("opponent_context_type");
		expect(selected.selectedSchema).toContain("sample_confidence");
		expect(selected.selectedSchema).toContain("last_played_match_datetime");
	});

	it("builds view context with static sample data rows", () => {
		const context = buildCatalogSchemaContextForViews(
			["public.vw_team_matches", "public.vw_player_stats_per_match"],
			20,
		);

		expect(context).toContain("- aliases:");
		expect(context).toContain("- filter_hints:");
		expect(context).toContain("- logic_bridges:");
		expect(context).toContain("- always:");
		expect(context).toContain("- defaults:");
		expect(context).toContain("- sample_data:");
		expect(context).toContain('"team_name":"Home Court"');
		expect(context).toContain('"match_result":null');
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
