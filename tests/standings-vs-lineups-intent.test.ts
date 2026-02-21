import { describe, expect, it } from "vitest";

import {
	selectCatalogContext,
	type CatalogSelectorInput,
} from "../worker/src/runtime/catalog/catalog";

const runSelect = (question: string): CatalogSelectorInput =>
	selectCatalogContext(question, {
		mode: "hybrid",
		topK: 2,
		confidenceMin: 0.3,
	});

describe("standings vs lineups intent boundaries", () => {
	it("routes default team game totals to standings", () => {
		const selected = runSelect(
			"How many games has Flemington Blue 3.0 won this season?",
		);

		expect(selected.selectedViews[0]).toBe("public.vw_team_standings");
	});

	it("routes default team match totals to standings", () => {
		const selected = runSelect(
			"How many matches has Flemington Blue 3.0 won this season?",
		);

		expect(selected.selectedViews[0]).toBe("public.vw_team_standings");
	});

	it("allows lineup view for explicit playoff-inclusive recomputation", () => {
		const selected = runSelect(
			"Including playoffs, recompute from lineup game rows how many games has Flemington Blue won?",
		);

		expect(selected.selectedViews[0]).toBe(
			"public.vw_match_game_lineups_scores",
		);
	});

	it("routes explicit lineup detail requests to lineup scores view", () => {
		const selected = runSelect(
			"Show game-by-game lineup scores for Flemington Blue 3.0",
		);

		expect(selected.selectedViews[0]).toBe(
			"public.vw_match_game_lineups_scores",
		);
	});
});
