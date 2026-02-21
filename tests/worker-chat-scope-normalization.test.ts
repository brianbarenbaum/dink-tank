import { describe, expect, it, vi } from "vitest";

const { executeReadOnlySqlRowsMock } = vi.hoisted(() => ({
	executeReadOnlySqlRowsMock: vi.fn(),
}));

vi.mock("../worker/src/runtime/sql/sqlExecutor", () => ({
	executeReadOnlySqlRows: executeReadOnlySqlRowsMock,
}));

import { buildSqlSystemPrompt } from "../worker/src/runtime/prompt";
import {
	formatScopedMetadataBlock,
	resolveScopedMetadata,
} from "../worker/src/runtime/scopeMetadata";

describe("worker chat scope normalization", () => {
	it("injects scoped division/pod metadata for shorthand pod comparisons", async () => {
		executeReadOnlySqlRowsMock.mockResolvedValueOnce([
			{ division_name: "3.0", pod: "Northwest" },
			{ division_name: "3.0", pod: "Southeast" },
		]);

		const metadata = await resolveScopedMetadata(
			{} as never,
			"Compare the Avg PPG of 3.0 Northwest and 3.0 Southeast",
		);
		const block = formatScopedMetadataBlock(metadata);
		const prompt = buildSqlSystemPrompt({
			catalogContext: "public.vw_team_standings:\n- division_name\n- pod",
			selectionReason:
				"Top match public.vw_team_standings scored 8.40 from question overlap.",
			scopedMetadataBlock: block,
		});

		expect(prompt).toContain("Scoped term dictionary");
		expect(prompt).toContain("Recognized divisions: 3.0");
		expect(prompt).toContain("Recognized pods: 3.0: Northwest, Southeast");
		expect(prompt).not.toContain("Recognized teams");
	});

	it("includes teams in scoped metadata only for team-intent prompts", async () => {
		executeReadOnlySqlRowsMock
			.mockResolvedValueOnce([
				{ division_name: "3.0", pod: "Northwest" },
				{ division_name: "3.0", pod: "Southeast" },
			])
			.mockResolvedValueOnce([
				{ division_name: "3.0", team_name: "Bounce Philly" },
				{ division_name: "3.0", team_name: "Pickle House" },
			]);

		const metadata = await resolveScopedMetadata(
			{} as never,
			"Show Bounce Philly team schedule in 3.0",
		);
		const block = formatScopedMetadataBlock(metadata);

		expect(block).toContain(
			"Recognized teams: 3.0: Bounce Philly, Pickle House",
		);
	});
});
