import { describe, expect, it } from "vitest";

import { extractReferencedRelations } from "../worker/src/runtime/sql/extractReferencedRelations";

describe("extractReferencedRelations", () => {
	it("extracts base relations from joins and ctes", () => {
		const relations = extractReferencedRelations(`
			WITH base AS (
				SELECT *
				FROM public.vw_team_standings
			)
			SELECT *
			FROM base
			JOIN public.vw_team_matches ON true
			LIMIT 10
		`);

		expect(relations).toEqual(
			new Set(["public.vw_team_standings", "public.vw_team_matches"]),
		);
	});

	it("extracts quoted identifiers from nested subqueries", () => {
		const relations = extractReferencedRelations(`
			SELECT *
			FROM (
				SELECT *
				FROM "public"."vw_match_game_lineups_scores"
			) AS scored
			JOIN "public"."vw_player_team" AS roster ON true
			LIMIT 5
		`);

		expect(relations).toEqual(
			new Set(["public.vw_match_game_lineups_scores", "public.vw_player_team"]),
		);
	});
});
