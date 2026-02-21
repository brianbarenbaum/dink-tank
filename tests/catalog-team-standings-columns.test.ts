import { describe, expect, it } from "vitest";

import { AI_CATALOG } from "../worker/src/runtime/catalog/catalog";

const EXPECTED_ADDED_COLUMNS = [
	"away_losses",
	"away_record",
	"away_win_rate",
	"away_wins",
	"clutch_games",
	"clutch_record",
	"clutch_win_rate",
	"clutch_wins",
	"home_losses",
	"home_record",
	"home_win_rate",
	"home_wins",
	"men_losses",
	"men_win_rate",
	"men_wins",
	"mens_record",
	"mixed_losses",
	"mixed_record",
	"mixed_win_rate",
	"mixed_wins",
	"team_point_diff",
	"total_games",
	"total_points_won",
	"total_single_games",
	"women_losses",
	"women_win_rate",
	"women_wins",
	"womens_record",
] as const;

const EXPECTED_EXCLUDED_COLUMNS = [
	"created_at",
	"division_id",
	"pod",
	"snapshot_date",
	"team_id",
	"updated_at",
] as const;

describe("catalog vw_team_standings columns", () => {
	it("includes newly exposed team standings statistics", () => {
		const entry = AI_CATALOG.find(
			(item) => item.name === "public.vw_team_standings",
		);
		expect(entry).toBeDefined();

		for (const column of EXPECTED_ADDED_COLUMNS) {
			expect(entry?.columns).toContain(column);
		}
	});

	it("does not expose excluded internal identifiers and timestamps", () => {
		const entry = AI_CATALOG.find(
			(item) => item.name === "public.vw_team_standings",
		);
		expect(entry).toBeDefined();

		for (const column of EXPECTED_EXCLUDED_COLUMNS) {
			expect(entry?.columns).not.toContain(column);
		}
	});
});
