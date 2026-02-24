import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("lineup feature bundle migration", () => {
	it("includes selected available players in players_catalog", () => {
		const migrationPath = resolve(
			process.cwd(),
			"supabase/migrations/20260224023632_include_available_players_in_feature_bundle_catalog.sql",
		);
		const sql = readFileSync(migrationPath, "utf8");

		expect(sql).toMatch(
			/select\s+unnest\(coalesce\(p_available_player_ids,\s*array\[\]::uuid\[\]\)\)/i,
		);
	});

	it("falls back to relaxed temporal filtering when strict candidate pairs are empty", () => {
		const migrationPath = resolve(
			process.cwd(),
			"supabase/migrations/20260224025335_fallback_when_pre_match_temporal_cutoff_eliminates_candidate_pairs.sql",
		);
		const sql = readFileSync(migrationPath, "utf8");

		expect(sql).toMatch(/candidate_pairs_strict/i);
		expect(sql).toMatch(/strict_candidate_available/i);
		expect(sql).toMatch(/not\s+sca\.has_rows/i);
		expect(sql).toMatch(/temporal_cutoff_mode/i);
	});
});
