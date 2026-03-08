import { describe, expect, it } from "vitest";

import { getApprovedSqlRelations } from "../worker/src/runtime/sql/approvedRelations";

describe("approved sql relations", () => {
	it("returns schema-qualified relations from the ai catalog", () => {
		const relations = getApprovedSqlRelations();

		expect(relations.has("public.vw_team_standings")).toBe(true);
		expect(relations.has("public.vw_team_matches")).toBe(true);
		expect(relations.has("analytics.some_view")).toBe(false);
		expect(relations.size).toBe(8);
	});
});
