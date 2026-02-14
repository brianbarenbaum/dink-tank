import { describe, expect, it } from "vitest";

import {
	buildDivisionChunks,
	computeBackoffDelayMs,
	createCheckpointKey,
	deterministicUuidFromSeed,
	denormalizeDotNetJson,
	findMissingDetailDependencies,
	planEndpointWork,
	selectDetailMatchups,
} from "../src/lib/crossclub-ingest";

describe("crossclub ingest helpers", () => {
	it("converts .NET reference payloads to regular JSON", () => {
		const input = {
			$id: "1",
			$values: [
				{
					$id: "2",
					name: "A",
					items: {
						$id: "3",
						$values: [{ $id: "4", label: "x" }],
					},
				},
			],
		};

		expect(denormalizeDotNetJson(input)).toEqual([
			{
				name: "A",
				items: [{ label: "x" }],
			},
		]);
	});

	it("builds stable checkpoint keys", () => {
		expect(
			createCheckpointKey({
				divisionId: "div-1",
				endpointName: "players",
				seasonYear: 2025,
				seasonNumber: 3,
			}),
		).toBe("crossclub:2025:s3:div-1:players");
	});

	it("chunks division IDs", () => {
		expect(buildDivisionChunks(["a", "b", "c", "d", "e"], 2)).toEqual([
			["a", "b"],
			["c", "d"],
			["e"],
		]);
	});

	it("plans endpoint workload for bootstrap and weekly", () => {
		const bootstrap = planEndpointWork("bootstrap", "all");
		const weekly = planEndpointWork("weekly", "all");
		const detailOnly = planEndpointWork("bootstrap", "details");
		const bootstrapPlayersOnly = planEndpointWork("bootstrap", "players");

		expect(bootstrap).toContain("teams");
		expect(bootstrap).toContain("players");
		expect(weekly).toContain("standings");
		expect(weekly).not.toContain("teams");
		expect(detailOnly).toEqual(["details"]);
		expect(bootstrapPlayersOnly).toEqual(["players"]);
	});

	it("builds deterministic UUIDs from seed", () => {
		const first = deterministicUuidFromSeed("abc");
		const second = deterministicUuidFromSeed("abc");
		const third = deterministicUuidFromSeed("def");

		expect(first).toBe(second);
		expect(first).not.toBe(third);
		expect(first).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
	});

	it("selects detail matchups for weekly vs bootstrap", () => {
		const all = [
			{
				matchupId: "a",
				scheduledTime: "2025-12-01T10:00:00Z",
			},
			{
				matchupId: "b",
				scheduledTime: "2025-08-01T10:00:00Z",
			},
		];
		const now = new Date("2025-12-10T00:00:00Z");
		expect(selectDetailMatchups(all, "bootstrap", now).map((x) => x.matchupId)).toEqual([
			"a",
			"b",
		]);
		expect(selectDetailMatchups(all, "weekly", now).map((x) => x.matchupId)).toEqual([
			"a",
		]);
	});

	it("computes retry delays with exponential backoff and jitter", () => {
		const delayMs = computeBackoffDelayMs({
			attempt: 2,
			baseDelayMs: 100,
			jitterRatio: 0.2,
			randomValue: 0.5,
		});
		expect(delayMs).toBe(220);
	});

	it("detects missing detail prerequisites", () => {
		const missing = findMissingDetailDependencies(["players", "matchups"]);
		expect(missing).toEqual(["teams", "playoff-matchups"]);
	});
});
