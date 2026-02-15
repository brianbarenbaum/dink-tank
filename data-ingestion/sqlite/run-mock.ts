import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	denormalizeDotNetJson,
	extractDivisionsFromRegions,
	sanitizeTeamForeignKey,
	type IngestPhase,
	type SyncMode,
} from "../pipeline.ts";
import { closeSqliteDb, initSqliteSchema, openSqliteDb } from "./db.ts";
import { upsertRows, type Row } from "./sink.ts";

export interface RunMockIngestionConfig {
	dbPath?: string;
	mode?: SyncMode;
	phase?: IngestPhase;
	regionLocationFilter?: string;
	divisionNameFilter?: string;
}

export interface RunMockIngestionSummary {
	rowsWritten: number;
	rowsByTable: Record<string, number>;
}

interface RegionFixture {
	regionId: string;
	location: string;
	divisions: Array<{
		divisionId: string;
		regionId: string;
		divisionName: string;
		seasonNumber: number;
		seasonYear: number;
	}>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const mockDataDir = join(__dirname, "..", "mock-data");

const readJson = <T>(fileName: string): T => {
	const raw = readFileSync(join(mockDataDir, fileName), "utf8");
	return JSON.parse(raw) as T;
};

const asArray = <T>(value: unknown): T[] => {
	const clean = denormalizeDotNetJson(value);
	return Array.isArray(clean) ? (clean as T[]) : [];
};

const increment = (
	rowsByTable: Record<string, number>,
	table: string,
	count: number,
): void => {
	rowsByTable[table] = (rowsByTable[table] ?? 0) + count;
};

const includeEndpoint = (phase: IngestPhase, endpoint: IngestPhase): boolean =>
	phase === "all" || phase === endpoint;

export const runMockIngestion = (
	config: RunMockIngestionConfig = {},
): RunMockIngestionSummary => {
	const dbPath = config.dbPath ?? join(__dirname, "crossclub.db");
	const mode = config.mode ?? "bootstrap";
	const phase = config.phase ?? "all";

	const db = openSqliteDb(dbPath);
	initSqliteSchema(db);

	const runId = `sqlite-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
	db.prepare(
		`INSERT INTO ingest_runs (run_id, run_type, status, metadata_json)
		 VALUES (?, ?, 'running', ?)`,
	).run(runId, mode, JSON.stringify({ phase }));

	const rowsByTable: Record<string, number> = {};
	let rowsWritten = 0;

	try {
		const regionsFixture = asArray<RegionFixture>(
			readJson<unknown>("regions.json"),
		);
		const selectedDivisions = extractDivisionsFromRegions(regionsFixture, {
			regionLocationFilter: config.regionLocationFilter,
			divisionNameFilter: config.divisionNameFilter,
		});
		const selectedDivisionIds = new Set(
			selectedDivisions.map((division) => division.divisionId),
		);
		const selectedRegionIds = new Set(
			selectedDivisions.map((division) => division.regionId),
		);

		const regionRows: Row[] = regionsFixture
			.filter((region) => selectedRegionIds.has(region.regionId))
			.map((region) => ({
				region_id: region.regionId,
				location: region.location,
			}));
		rowsWritten += upsertRows(db, "regions", regionRows, ["region_id"]);
		increment(rowsByTable, "regions", regionRows.length);

		const divisionRows: Row[] = selectedDivisions.map((division) => ({
			division_id: division.divisionId,
			region_id: division.regionId,
			division_name: division.divisionName,
			season_year: division.seasonYear,
			season_number: division.seasonNumber,
		}));
		rowsWritten += upsertRows(db, "divisions", divisionRows, ["division_id"]);
		increment(rowsByTable, "divisions", divisionRows.length);

		const teamsFixture = asArray<Array<Record<string, unknown>>>(
			readJson<unknown>("teams.json"),
		).flat();
		const selectedTeams = teamsFixture.filter((team) =>
			selectedDivisionIds.has(String(team.divisionId ?? "")),
		);

		if (includeEndpoint(phase, "teams") || includeEndpoint(phase, "all")) {
			const clubRows = Array.from(
				new Map(
					selectedTeams.map((team) => [
						String(team.clubId),
						{
							club_id: String(team.clubId),
							club_name: String(team.clubName ?? team.clubId),
						},
					]),
				).values(),
			);
			rowsWritten += upsertRows(db, "clubs", clubRows, ["club_id"]);
			increment(rowsByTable, "clubs", clubRows.length);

			const teamRows: Row[] = selectedTeams
				.map((team) => ({
					team_id: sanitizeTeamForeignKey(team.teamId),
					club_id: String(team.clubId),
					team_name: String(team.teamName ?? team.teamId),
				}))
				.filter((team) => team.team_id);
			rowsWritten += upsertRows(db, "teams", teamRows, ["team_id"]);
			increment(rowsByTable, "teams", teamRows.length);

			const teamSeasonRows: Row[] = selectedTeams
				.map((team) => ({
					team_id: sanitizeTeamForeignKey(team.teamId),
					division_id: String(team.divisionId),
					season_year: Number(team.seasonYear),
					season_number: Number(team.seasonNumber),
				}))
				.filter((team) => team.team_id);
			rowsWritten += upsertRows(db, "team_seasons", teamSeasonRows, [
				"team_id",
				"division_id",
				"season_year",
				"season_number",
			]);
			increment(rowsByTable, "team_seasons", teamSeasonRows.length);
		}

		const playersFixture = asArray<Array<Record<string, unknown>>>(
			readJson<unknown>("players.json"),
		).flat();
		const selectedPlayers = playersFixture.filter((player) =>
			selectedDivisionIds.has(String(player.divisionId ?? "")),
		);

		if (includeEndpoint(phase, "players") || includeEndpoint(phase, "all")) {
			const playerRows: Row[] = selectedPlayers.map((player) => ({
				player_id: String(player.playerId),
				full_name: String(player.fullName ?? player.playerId),
				team_id: sanitizeTeamForeignKey(player.teamId),
			}));
			rowsWritten += upsertRows(db, "players", playerRows, ["player_id"]);
			increment(rowsByTable, "players", playerRows.length);

			const rosterRows: Row[] = selectedPlayers
				.map((player) => ({
					player_id: String(player.playerId),
					team_id: sanitizeTeamForeignKey(player.teamId),
					division_id: String(player.divisionId),
					season_year: Number(player.seasonYear),
					season_number: Number(player.seasonNumber),
				}))
				.filter((row) => row.team_id);
			rowsWritten += upsertRows(db, "player_rosters", rosterRows, [
				"player_id",
				"team_id",
				"division_id",
				"season_year",
				"season_number",
			]);
			increment(rowsByTable, "player_rosters", rosterRows.length);
		}

		if (includeEndpoint(phase, "standings") || includeEndpoint(phase, "all")) {
			const standingsFixture = asArray<Array<Record<string, unknown>>>(
				readJson<unknown>("standings.json"),
			).flat();
			const selectedStandings = standingsFixture
				.filter((row) => selectedDivisionIds.has(String(row.divisionId ?? "")))
				.map((row) => ({
					division_id: String(row.divisionId),
					team_id: sanitizeTeamForeignKey(row.teamId),
					season_year: Number(row.seasonYear),
					season_number: Number(row.seasonNumber),
					wins: Number(row.wins ?? 0),
					losses: Number(row.losses ?? 0),
				}))
				.filter((row) => row.team_id);
			rowsWritten += upsertRows(db, "team_standings", selectedStandings, [
				"division_id",
				"team_id",
				"season_year",
				"season_number",
			]);
			increment(rowsByTable, "team_standings", selectedStandings.length);
		}

		if (includeEndpoint(phase, "matchups") || includeEndpoint(phase, "all")) {
			const matchupFixture = asArray<Array<Record<string, unknown>>>(
				readJson<unknown>("matchups.json"),
			).flat();
			const selectedMatchups = matchupFixture
				.filter((row) => selectedDivisionIds.has(String(row.divisionId ?? "")))
				.map((row) => ({
					matchup_id: String(row.matchupId),
					division_id: String(row.divisionId),
					home_team_id: sanitizeTeamForeignKey(row.homeTeamId),
					away_team_id: sanitizeTeamForeignKey(row.awayTeamId),
					scheduled_time: String(row.scheduledTime ?? ""),
					season_year: Number(row.seasonYear),
					season_number: Number(row.seasonNumber),
				}));
			rowsWritten += upsertRows(db, "matchups", selectedMatchups, [
				"matchup_id",
			]);
			increment(rowsByTable, "matchups", selectedMatchups.length);
		}

		if (
			includeEndpoint(phase, "playoff-matchups") ||
			includeEndpoint(phase, "all")
		) {
			const playoffFixture = asArray<Array<Record<string, unknown>>>(
				readJson<unknown>("playoff-matchups.json"),
			).flat();
			const selectedPlayoffs = playoffFixture
				.filter((row) => selectedDivisionIds.has(String(row.divisionId ?? "")))
				.map((row) => ({
					matchup_id: String(row.matchupId),
					division_id: String(row.divisionId),
					home_team_id: sanitizeTeamForeignKey(row.homeTeamId),
					away_team_id: sanitizeTeamForeignKey(row.awayTeamId),
					scheduled_time: String(row.scheduledTime ?? ""),
					season_year: Number(row.seasonYear),
					season_number: Number(row.seasonNumber),
				}));
			rowsWritten += upsertRows(db, "playoff_matchups", selectedPlayoffs, [
				"matchup_id",
			]);
			increment(rowsByTable, "playoff_matchups", selectedPlayoffs.length);
		}

		if (includeEndpoint(phase, "details") || includeEndpoint(phase, "all")) {
			const detailsFixture = readJson<Record<string, Record<string, unknown>>>(
				"matchup-details.json",
			);
			for (const detail of Object.values(detailsFixture)) {
				if (!selectedDivisionIds.has(String(detail.divisionId ?? ""))) {
					continue;
				}

				const matchupId = String(detail.matchupId ?? "");
				const matchExists = (
					db
						.prepare("SELECT 1 AS found FROM matchups WHERE matchup_id = ?")
						.get(matchupId) as { found?: number } | undefined
				)?.found;
				if (!matchExists) {
					continue;
				}

				const lineupRows: Row[] = asArray<Array<Record<string, unknown>>>(
					detail.lineups,
				)
					.flat()
					.map((lineup) => {
						const teamId = sanitizeTeamForeignKey(lineup.teamId);
						if (!teamId) {
							return null;
						}
						return {
							lineup_id: String(lineup.lineupId),
							matchup_id: matchupId,
							team_id: teamId,
							is_home: lineup.isHome ? 1 : 0,
						};
					})
					.filter((lineup) => lineup !== null);
				rowsWritten += upsertRows(db, "lineups", lineupRows, ["lineup_id"]);
				increment(rowsByTable, "lineups", lineupRows.length);

				const slotRows: Row[] = [];
				for (const lineup of asArray<Array<Record<string, unknown>>>(
					detail.lineups,
				).flat()) {
					for (const slot of asArray<Array<Record<string, unknown>>>(
						lineup.slots,
					).flat()) {
						slotRows.push({
							lineup_id: String(lineup.lineupId),
							slot_number: Number(slot.slotNumber),
							player_id: String(slot.playerId),
						});
					}
				}
				rowsWritten += upsertRows(db, "lineup_slots", slotRows, [
					"lineup_id",
					"slot_number",
				]);
				increment(rowsByTable, "lineup_slots", slotRows.length);

				const playerStatRows: Row[] = asArray<Array<Record<string, unknown>>>(
					detail.playerStats,
				)
					.flat()
					.map((row) => ({
						matchup_id: String(row.matchupId),
						player_id: String(row.playerId),
						team_id: sanitizeTeamForeignKey(row.teamId),
						wins: Number(row.wins ?? 0),
						losses: Number(row.losses ?? 0),
					}));
				rowsWritten += upsertRows(db, "matchup_player_stats", playerStatRows, [
					"matchup_id",
					"player_id",
				]);
				increment(rowsByTable, "matchup_player_stats", playerStatRows.length);
			}
		}

		const selectedDivisionIdList = Array.from(selectedDivisionIds).join(",");
		const rawPayload = {
			mode,
			phase,
			selectedDivisions: selectedDivisionIdList,
		};
		rowsWritten += upsertRows(
			db,
			"api_raw_ingest",
			[
				{
					id: 1,
					endpoint: "mock-summary",
					division_id: selectedDivisionIdList,
					season_year: 2026,
					season_number: 1,
					payload_json: JSON.stringify(rawPayload),
					ingested_at: new Date().toISOString(),
				},
			],
			["id"],
		);
		increment(rowsByTable, "api_raw_ingest", 1);

		db.prepare(
			`UPDATE ingest_runs
			 SET status = 'completed', ended_at = CURRENT_TIMESTAMP, rows_written = ?, metadata_json = ?
			 WHERE run_id = ?`,
		).run(rowsWritten, JSON.stringify({ phase, mode, rowsByTable }), runId);

		return {
			rowsWritten,
			rowsByTable,
		};
	} catch (error) {
		db.prepare(
			`UPDATE ingest_runs
			 SET status = 'failed', ended_at = CURRENT_TIMESTAMP, error_message = ?
			 WHERE run_id = ?`,
		).run(error instanceof Error ? error.message : "unknown error", runId);
		throw error;
	} finally {
		closeSqliteDb(db);
	}
};

const readModeArg = (): SyncMode => {
	const value = process.argv[2]?.trim();
	return value === "weekly" ? "weekly" : "bootstrap";
};

const readPhaseArg = (): IngestPhase => {
	const value = process.argv[3]?.trim() as IngestPhase | undefined;
	if (!value) {
		return "all";
	}
	return value;
};

const readFlag = (name: string): string | undefined => {
	const index = process.argv.indexOf(name);
	if (index === -1) {
		return undefined;
	}
	return process.argv[index + 1];
};

if (import.meta.url === `file://${process.argv[1]}`) {
	const summary = runMockIngestion({
		dbPath: process.env.CROSSCLUB_SQLITE_PATH,
		mode: readModeArg(),
		phase: readPhaseArg(),
		regionLocationFilter:
			readFlag("--region") ?? process.env.CROSSCLUB_REGION_FILTER,
		divisionNameFilter:
			readFlag("--division") ?? process.env.CROSSCLUB_DIVISION_FILTER,
	});
	console.log(
		`[crossclub-sqlite] rows=${summary.rowsWritten} tables=${JSON.stringify(summary.rowsByTable)}`,
	);
}
