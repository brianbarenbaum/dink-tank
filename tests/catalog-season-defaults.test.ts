import { describe, expect, it } from "vitest";

import { AI_CATALOG } from "../worker/src/runtime/catalog/catalog";

const SEASON_SCOPED_CATALOG_VIEWS = [
	"public.vw_player_team",
	"public.vw_player_stats_per_season",
	"public.vw_player_stats_per_match",
	"public.vw_player_game_history",
	"public.vw_player_partner_performance_summary",
	"public.vw_match_game_lineups_scores",
	"public.vw_team_standings",
	"public.vw_team_matches",
] as const;

describe("catalog season defaults", () => {
	it("adds is_current_season column for all season-scoped catalog views", () => {
		for (const viewName of SEASON_SCOPED_CATALOG_VIEWS) {
			const entry = AI_CATALOG.find((item) => item.name === viewName);
			expect(entry, `Missing catalog entry for ${viewName}`).toBeDefined();
			expect(entry?.columns).toContain("is_current_season");
		}
	});

	it("defaults season-scoped catalog views to is_current_season=true", () => {
		for (const viewName of SEASON_SCOPED_CATALOG_VIEWS) {
			const entry = AI_CATALOG.find((item) => item.name === viewName);
			expect(entry, `Missing catalog entry for ${viewName}`).toBeDefined();
			expect(entry?.filterHints.defaults?.is_current_season).toBe("true");
		}
	});
});
