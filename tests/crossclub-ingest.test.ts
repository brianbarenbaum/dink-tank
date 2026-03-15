import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as pipelineModule from "../data-ingestion/pipeline";

import {
	buildClubRowsFromPlayers,
	buildPlayerRosterRows,
	buildTeamRowsFromPlayers,
	buildTeamSeasonRows,
	buildDivisionChunks,
	computeBackoffDelayMs,
	createCheckpointKey,
	deterministicUuidFromSeed,
	denormalizeDotNetJson,
	extractDivisionsFromRegions,
	findMissingDetailDependencies,
	handleLineupAnalyticsRefresh,
	ingestCrossClub,
	uniqueByCompositeKey,
	planEndpointWork,
	normalizeLineupsFromDetail,
	parseJsonResponseSafely,
	sanitizeTeamForeignKey,
	selectDetailMatchups,
} from "../data-ingestion/pipeline";

const getNormalizeCrossClubScheduledTime = () =>
	(
		pipelineModule as {
			normalizeCrossClubScheduledTime?: (
				scheduledTime: string | null | undefined,
			) => string | null;
		}
	).normalizeCrossClubScheduledTime;

describe("crossclub ingest helpers", () => {
	it("declares sqlite ingestion helper scripts", () => {
		const packageJsonPath = join(process.cwd(), "package.json");
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
			scripts?: Record<string, string>;
		};
		expect(packageJson.scripts).toBeDefined();
		expect(packageJson.scripts?.["ingest:sqlite:init"]).toBeDefined();
		expect(packageJson.scripts?.["ingest:sqlite:mock"]).toBeDefined();
		expect(packageJson.scripts?.["ingest:sqlite:verify"]).toBeDefined();
	});

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

	it("preserves nested divisions as arrays after denormalization", () => {
		const input = {
			$values: [
				{
					regionId: "r1",
					divisions: {
						$values: [{ divisionId: "d1" }, { divisionId: "d2" }],
					},
				},
			],
		};
		const output = denormalizeDotNetJson(input) as Array<{
			regionId: string;
			divisions: Array<{ divisionId: string }>;
		}>;
		expect(output[0]?.divisions?.map((d) => d.divisionId)).toEqual([
			"d1",
			"d2",
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
		expect(
			selectDetailMatchups(all, "bootstrap", now).map((x) => x.matchupId),
		).toEqual(["a", "b"]);
		expect(
			selectDetailMatchups(all, "weekly", now).map((x) => x.matchupId),
		).toEqual(["a"]);
	});

	it("normalizes winter Cross Club scheduled times from Eastern wall clock to real UTC", () => {
		const normalizeCrossClubScheduledTime =
			getNormalizeCrossClubScheduledTime();

		expect(normalizeCrossClubScheduledTime).toBeTypeOf("function");
		expect(normalizeCrossClubScheduledTime?.("2026-02-26T19:30:00Z")).toBe(
			"2026-02-27T00:30:00.000Z",
		);
	});

	it("normalizes daylight-saving Cross Club scheduled times from Eastern wall clock to real UTC", () => {
		const normalizeCrossClubScheduledTime =
			getNormalizeCrossClubScheduledTime();

		expect(normalizeCrossClubScheduledTime).toBeTypeOf("function");
		expect(normalizeCrossClubScheduledTime?.("2026-03-12T19:30:00Z")).toBe(
			"2026-03-12T23:30:00.000Z",
		);
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

	it("downgrades analytics schema exposure failures to warnings", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const rpc = vi
			.fn()
			.mockRejectedValue(
				new Error(
					'Supabase REST POST /rest/v1/rpc/refresh_lineup_analytics_views failed: {"code":"PGRST106","hint":"Only the following schemas are exposed: public, graphql_public","message":"Invalid schema: analytics"}',
				),
			);

		await expect(
			handleLineupAnalyticsRefresh({
				supabase: { rpc },
				shouldRefreshLineupAnalytics: true,
				warnings: 0,
			}),
		).resolves.toEqual({
			lineupAnalyticsRefreshed: false,
			warnings: 1,
		});
		expect(rpc).toHaveBeenCalledWith(
			"refresh_lineup_analytics_views",
			{},
			"analytics",
		);
		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});

	it("handles empty successful responses without JSON parse errors", async () => {
		const response = new Response("", {
			status: 201,
			headers: { "content-type": "application/json" },
		});
		await expect(parseJsonResponseSafely(response)).resolves.toBeNull();
	});

	it("filters divisions by region and division name", () => {
		const regions = [
			{
				regionId: "r1",
				location: "NJ / PA",
				divisions: [
					{
						divisionId: "d-40",
						regionId: "r1",
						divisionName: "4.0",
						seasonNumber: 3,
						seasonYear: 2025,
					},
					{
						divisionId: "d-30",
						regionId: "r1",
						divisionName: "3.0",
						seasonNumber: 3,
						seasonYear: 2025,
					},
				],
			},
			{
				regionId: "r2",
				location: "CT / MA",
				divisions: [
					{
						divisionId: "d-ct",
						regionId: "r2",
						divisionName: "4.0",
						seasonNumber: 3,
						seasonYear: 2025,
					},
				],
			},
		];

		const filtered = extractDivisionsFromRegions(regions, {
			regionLocationFilter: "NJ / PA",
			divisionNameFilter: "4.0",
		});

		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.divisionId).toBe("d-40");
	});

	it("skips divisions whose players endpoint returns 404 and continues ingesting other divisions", async () => {
		const apiBaseUrl = "https://crossclub.test";
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const fetchMock = vi.fn(async (input: string | URL | Request) => {
			const url =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.toString()
						: input.url;

			if (`${apiBaseUrl}/regions?latitude=1&longitude=2` === url) {
				return new Response(
					JSON.stringify([
						{
							regionId: "region-1",
							location: "Test Region",
							divisions: [
								{
									divisionId: "division-missing",
									regionId: "region-1",
									divisionName: "4.0",
									seasonNumber: 1,
									seasonYear: 2026,
								},
								{
									divisionId: "division-ok",
									regionId: "region-1",
									divisionName: "4.5",
									seasonNumber: 1,
									seasonYear: 2026,
								},
							],
						},
					]),
				);
			}

			if (`${apiBaseUrl}/divisions/division-missing/players` === url) {
				return new Response(JSON.stringify({ title: "Not Found" }), {
					status: 404,
					headers: { "content-type": "application/json" },
				});
			}

			if (`${apiBaseUrl}/divisions/division-ok/players` === url) {
				return new Response(JSON.stringify([]), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}

			throw new Error(`Unexpected fetch URL: ${url}`);
		});

		vi.stubGlobal("fetch", fetchMock);

		await expect(
			ingestCrossClub({
				apiBaseUrl,
				mode: "bootstrap",
				phase: "players",
				dryRun: true,
				lat: "1",
				lng: "2",
				retryAttempts: 3,
				retryBaseDelayMs: 0,
				retryJitterRatio: 0,
				delayMs: 0,
			}),
		).resolves.toBeUndefined();

		expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
			`${apiBaseUrl}/regions?latitude=1&longitude=2`,
			`${apiBaseUrl}/divisions/division-missing/players`,
			`${apiBaseUrl}/divisions/division-ok/players`,
		]);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining(
				"skipping missing players endpoint division=division-missing status=404",
			),
		);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("warnings=1"));

		vi.unstubAllGlobals();
		warn.mockRestore();
		log.mockRestore();
	});

	it("dedupes rows by composite key preserving last row", () => {
		const rows = [
			{ player_id: "p1", wins: 1 },
			{ player_id: "p2", wins: 2 },
			{ player_id: "p1", wins: 5 },
		];

		const deduped = uniqueByCompositeKey(rows, ["player_id"]);
		expect(deduped).toHaveLength(2);
		expect(deduped.find((r) => r.player_id === "p1")?.wins).toBe(5);
	});

	it("builds season-scoped roster rows", () => {
		const rows = buildPlayerRosterRows(
			[
				{
					playerId: "p1",
					divisionId: "d1",
					teamId: "t1",
					isCaptain: true,
					isSub: false,
				},
			],
			{ seasonNumber: 3, seasonYear: 2025, snapshotDate: "2026-02-14" },
		);
		expect(rows[0]).toMatchObject({
			player_id: "p1",
			division_id: "d1",
			team_id: "t1",
			season_number: 3,
			season_year: 2025,
			snapshot_date: "2026-02-14",
		});
	});

	it("builds season-scoped team rows", () => {
		const rows = buildTeamSeasonRows(
			[
				{
					teamId: "t1",
					teamName: "Team A",
					clubId: "c1",
				},
			],
			{
				divisionId: "d1",
				seasonNumber: 3,
				seasonYear: 2025,
				snapshotDate: "2026-02-14",
			},
		);
		expect(rows[0]).toMatchObject({
			team_id: "t1",
			division_id: "d1",
			season_number: 3,
			season_year: 2025,
		});
	});

	it("builds minimal clubs and teams from players payload", () => {
		const players = [
			{
				playerId: "p1",
				divisionId: "d1",
				teamId: "t1",
				teamName: "Team 1",
				clubId: "c1",
				clubName: "Club 1",
			},
			{
				playerId: "p2",
				divisionId: "d1",
				teamId: "t1",
				teamName: "Team 1",
				clubId: "c1",
				clubName: "Club 1",
			},
		];
		const clubs = buildClubRowsFromPlayers(players);
		const teams = buildTeamRowsFromPlayers(players);
		expect(clubs).toHaveLength(1);
		expect(teams).toHaveLength(1);
		expect(teams[0]).toMatchObject({
			team_id: "t1",
			division_id: "d1",
			club_id: "c1",
			team_name: "Team 1",
		});
	});

	it("normalizes placeholder team ids to null", () => {
		expect(sanitizeTeamForeignKey("00000000-0000-0000-0000-000000000000")).toBe(
			null,
		);
		expect(sanitizeTeamForeignKey("")).toBe(null);
		expect(sanitizeTeamForeignKey("   ")).toBe(null);
		expect(sanitizeTeamForeignKey("t1")).toBe("t1");
	});

	it("skips placeholder team ids when building teams from players", () => {
		const players = [
			{
				playerId: "p0",
				divisionId: "d1",
				teamId: "00000000-0000-0000-0000-000000000000",
				clubId: "c1",
			},
			{
				playerId: "p1",
				divisionId: "d1",
				teamId: "t1",
				clubId: "c1",
			},
		];
		const teams = buildTeamRowsFromPlayers(players);
		expect(teams).toHaveLength(1);
		expect(teams[0]?.team_id).toBe("t1");
	});

	it("normalizes nested detail lineup payloads into lineups and slots", () => {
		const normalized = normalizeLineupsFromDetail({
			matchupId: "m1",
			homeTeamId: "home-team",
			awayTeamId: "away-team",
			snapshotDate: "2026-02-15",
			detailObject: {
				lineups: {
					lineups: {
						$values: [
							{
								gameNumber: 0,
								awayPlayerId1: "a1",
								awayPlayerId2: "a2",
								homePlayerId1: "h1",
								homePlayerId2: "h2",
							},
							{
								gameNumber: 1,
								awayPlayerId1: "a3",
								awayPlayerId2: "a4",
								homePlayerId1: "h3",
								homePlayerId2: "h4",
							},
						],
					},
				},
			},
		});

		expect(normalized.lineups).toHaveLength(2);
		expect(normalized.slots).toHaveLength(8);
	});

	it("skips away lineup when away team id is placeholder", () => {
		const normalized = normalizeLineupsFromDetail({
			matchupId: "m2",
			homeTeamId: "home-team",
			awayTeamId: "00000000-0000-0000-0000-000000000000",
			snapshotDate: "2026-02-15",
			detailObject: {
				lineups: {
					lineups: {
						$values: [
							{
								gameNumber: 0,
								awayPlayerId1: "a1",
								homePlayerId1: "h1",
								homePlayerId2: "h2",
							},
						],
					},
				},
			},
		});

		expect(normalized.lineups).toHaveLength(1);
		expect(normalized.slots.every((slot) => slot.role === "home")).toBe(true);
	});
});
