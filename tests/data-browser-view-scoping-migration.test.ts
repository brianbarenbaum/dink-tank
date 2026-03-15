import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
	process.cwd(),
	"supabase/migrations/20260315160000_fix_data_browser_view_scoping.sql",
);

describe("data browser view scoping migration", () => {
	it("dedupes seasonal roster joins and exposes division ids on browser views", () => {
		const sql = readFileSync(migrationPath, "utf8");

		expect(sql).toMatch(
			/create or replace view public\.vw_player_stats_per_season/i,
		);
		expect(sql).toMatch(/rosters_latest/i);
		expect(sql).toMatch(
			/distinct on\s*\(\s*pr0\.player_id,\s*pr0\.division_id,\s*pr0\.season_number,\s*pr0\.season_year\s*\)/i,
		);
		expect(sql).toMatch(/create or replace view public\.vw_team_standings/i);
		expect(sql).toMatch(/create or replace view public\.vw_team_matches/i);
		expect(sql).toMatch(/division_id/i);
	});
});
