import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeReadOnlySqlRowsMock } = vi.hoisted(() => ({
	executeReadOnlySqlRowsMock: vi.fn(),
}));

vi.mock("../worker/src/runtime/sql/sqlExecutor", () => ({
	executeReadOnlySqlRows: executeReadOnlySqlRowsMock,
}));

import {
	__resetScopedMetadataCacheForTests,
	resolveScopedMetadata,
} from "../worker/src/runtime/scopeMetadata";

describe("resolveScopedMetadata", () => {
	beforeEach(() => {
		executeReadOnlySqlRowsMock.mockReset();
		__resetScopedMetadataCacheForTests();
	});

	it("fetches divisions and pods without teams for non-team prompts", async () => {
		executeReadOnlySqlRowsMock.mockResolvedValueOnce([
			{ division_name: "3.0", pod: "Northwest" },
			{ division_name: "3.0", pod: "Southeast" },
		]);

		const metadata = await resolveScopedMetadata(
			{} as never,
			"Compare Avg PPG of 3.0 Northwest and 3.0 Southeast",
		);

		expect(executeReadOnlySqlRowsMock).toHaveBeenCalledTimes(1);
		expect(metadata?.includeTeams).toBe(false);
		expect(metadata?.divisions).toEqual(["3.0"]);
		expect(metadata?.podsByDivision["3.0"]).toEqual(["Northwest", "Southeast"]);
	});

	it("accepts pod_name rows from vw_team_standings metadata query", async () => {
		executeReadOnlySqlRowsMock.mockResolvedValueOnce([
			{ division_name: "3.0", pod_name: "Northwest" },
			{ division_name: "3.0", pod_name: "Southeast" },
		]);

		const metadata = await resolveScopedMetadata(
			{} as never,
			"Compare Avg PPG of 3.0 Northwest and 3.0 Southeast",
		);

		expect(metadata?.podsByDivision["3.0"]).toEqual(["Northwest", "Southeast"]);
	});

	it("includes teams only when team intent is present", async () => {
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

		expect(executeReadOnlySqlRowsMock).toHaveBeenCalledTimes(2);
		expect(metadata?.includeTeams).toBe(true);
		expect(metadata?.teamsByDivision?.["3.0"]).toEqual([
			"Bounce Philly",
			"Pickle House",
		]);
	});

	it("reuses cached metadata for repeated equivalent non-team prompts", async () => {
		executeReadOnlySqlRowsMock.mockResolvedValueOnce([
			{ division_name: "3.0", pod_name: "Northwest" },
			{ division_name: "3.0", pod_name: "Southeast" },
		]);

		const first = await resolveScopedMetadata(
			{} as never,
			"Compare avg point differential for 3.0 pods",
		);
		const second = await resolveScopedMetadata(
			{} as never,
			"Compare avg point differential for 3.0 pods",
		);

		expect(first).toEqual(second);
		expect(executeReadOnlySqlRowsMock).toHaveBeenCalledTimes(1);
	});

	it("reuses cached metadata for repeated team-intent prompts", async () => {
		executeReadOnlySqlRowsMock
			.mockResolvedValueOnce([{ division_name: "3.0", pod_name: "Northwest" }])
			.mockResolvedValueOnce([
				{ division_name: "3.0", team_name: "Bounce Philly" },
			]);

		const first = await resolveScopedMetadata(
			{} as never,
			"Show team schedule for Bounce Philly in 3.0",
		);
		const second = await resolveScopedMetadata(
			{} as never,
			"Show team schedule for Bounce Philly in 3.0",
		);

		expect(first).toEqual(second);
		expect(executeReadOnlySqlRowsMock).toHaveBeenCalledTimes(2);
	});
});
