import { describe, expect, it } from "vitest";

import { AI_CATALOG } from "../worker/src/runtime/catalog/catalog";

const APPROVED_CHAT_RELATIONS = [
	"public.vw_player_team",
	"public.vw_player_stats_per_season",
	"public.vw_player_stats_per_match",
	"public.vw_player_game_history",
	"public.vw_player_partner_performance_summary",
	"public.vw_match_game_lineups_scores",
	"public.vw_team_standings",
	"public.vw_team_matches",
] as const;

describe("approved ai relations inventory", () => {
	it("uses schema-qualified relation names for every catalog entry", () => {
		for (const entry of AI_CATALOG) {
			expect(entry.name).toMatch(/^[a-z0-9_]+\.[a-z0-9_]+$/i);
		}
	});

	it("matches the confirmed approved chat relation set exactly", () => {
		expect(AI_CATALOG.map((entry) => entry.name)).toEqual(
			APPROVED_CHAT_RELATIONS,
		);
	});
});
