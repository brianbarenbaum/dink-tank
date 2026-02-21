import { describe, expect, it } from "vitest";

import {
	formatScopedMetadataBlock,
	parseScopeTerms,
} from "../worker/src/runtime/scopeMetadata";

describe("scope metadata parser", () => {
	it("extracts division and pod terms from shorthand query", () => {
		const parsed = parseScopeTerms(
			"Compare the Avg PPG of 3.0 Northwest and 3.0 Southeast",
		);

		expect(parsed.inferredDivisionTerms).toContain("3.0");
		expect(parsed.inferredPodTerms).toContain("northwest");
		expect(parsed.inferredPodTerms).toContain("southeast");
		expect(parsed.teamIntent).toBe(false);
	});

	it("detects team intent for team schedule phrasing", () => {
		const parsed = parseScopeTerms("Show Bounce Philly schedule for 3.0");
		expect(parsed.teamIntent).toBe(true);
	});

	it("does not mark team intent for pod comparison phrasing", () => {
		const parsed = parseScopeTerms(
			"Compare Avg PPG of 3.0 Northwest pod and 3.0 Southeast pod",
		);
		expect(parsed.teamIntent).toBe(false);
	});
});

describe("scoped metadata formatter", () => {
	it("returns empty block when metadata is null", () => {
		expect(formatScopedMetadataBlock(null)).toBe("");
	});

	it("renders compact scoped dictionary with teams when included", () => {
		const block = formatScopedMetadataBlock({
			seasonLabel: "current season",
			divisions: ["3.0"],
			podsByDivision: {
				"3.0": ["Northwest", "Southeast"],
			},
			teamsByDivision: {
				"3.0": ["Bounce Philly", "Pickle House"],
			},
			includeTeams: true,
		});

		expect(block).toContain("Recognized divisions");
		expect(block).toContain("Recognized pods");
		expect(block).toContain("Recognized teams");
		expect(block).toContain("Bounce Philly");
	});
});
