import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { closeSqliteDb, openSqliteDb } from "../data-ingestion/sqlite/db";
import { runMockIngestion } from "../data-ingestion/sqlite/run-mock";

const tempDirs: string[] = [];

const countRows = (dbPath: string, table: string): number => {
	const db = openSqliteDb(dbPath);
	const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as {
		count: number;
	};
	closeSqliteDb(db);
	return row.count;
};

afterEach(() => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("crossclub sqlite mock ingestion", () => {
	it("bootstraps all mock fixtures into sqlite", () => {
		const dir = mkdtempSync(join(tmpdir(), "crossclub-ingest-"));
		tempDirs.push(dir);
		const dbPath = join(dir, "ingest.db");

		const summary = runMockIngestion({
			dbPath,
			mode: "bootstrap",
			phase: "all",
		});
		expect(summary.rowsWritten).toBeGreaterThan(0);
		expect(countRows(dbPath, "regions")).toBeGreaterThan(0);
		expect(countRows(dbPath, "divisions")).toBeGreaterThan(0);
		expect(countRows(dbPath, "teams")).toBeGreaterThan(0);
		expect(countRows(dbPath, "players")).toBeGreaterThan(0);
		expect(countRows(dbPath, "matchups")).toBeGreaterThan(0);
		expect(countRows(dbPath, "lineups")).toBeGreaterThan(0);
		expect(countRows(dbPath, "lineup_slots")).toBeGreaterThan(0);
		expect(countRows(dbPath, "matchup_player_stats")).toBeGreaterThan(0);
	});

	it("applies region/division filters", () => {
		const dir = mkdtempSync(join(tmpdir(), "crossclub-filter-"));
		tempDirs.push(dir);
		const dbPath = join(dir, "ingest.db");

		runMockIngestion({
			dbPath,
			mode: "bootstrap",
			phase: "all",
			regionLocationFilter: "NJ / PA",
			divisionNameFilter: "4.0",
		});

		const db = openSqliteDb(dbPath);
		const divisionCount = (
			db.prepare("SELECT COUNT(*) AS count FROM divisions").get() as { count: number }
		).count;
		const teamCCount = (
			db.prepare("SELECT COUNT(*) AS count FROM teams WHERE team_id = 'team-c'").get() as {
				count: number;
			}
		).count;
		closeSqliteDb(db);

		expect(divisionCount).toBe(1);
		expect(teamCCount).toBe(0);
	});

	it("is idempotent across repeated runs", () => {
		const dir = mkdtempSync(join(tmpdir(), "crossclub-idempotent-"));
		tempDirs.push(dir);
		const dbPath = join(dir, "ingest.db");

		runMockIngestion({ dbPath, mode: "bootstrap", phase: "all" });
		const playersAfterFirst = countRows(dbPath, "players");
		runMockIngestion({ dbPath, mode: "bootstrap", phase: "all" });
		const playersAfterSecond = countRows(dbPath, "players");
		expect(playersAfterSecond).toBe(playersAfterFirst);
	});

	it("supports weekly detail refresh phase", () => {
		const dir = mkdtempSync(join(tmpdir(), "crossclub-weekly-"));
		tempDirs.push(dir);
		const dbPath = join(dir, "ingest.db");

		runMockIngestion({ dbPath, mode: "bootstrap", phase: "all" });
		const before = countRows(dbPath, "matchup_player_stats");
		runMockIngestion({ dbPath, mode: "weekly", phase: "details" });
		const after = countRows(dbPath, "matchup_player_stats");
		expect(before).toBeGreaterThan(0);
		expect(after).toBe(before);
	});

	it("normalizes placeholder away team id to null in playoff matchups", () => {
		const dir = mkdtempSync(join(tmpdir(), "crossclub-playoff-null-team-"));
		tempDirs.push(dir);
		const dbPath = join(dir, "ingest.db");

		runMockIngestion({ dbPath, mode: "bootstrap", phase: "all" });
		const db = openSqliteDb(dbPath);
		const row = db
			.prepare(
				"SELECT away_team_id FROM playoff_matchups WHERE matchup_id = 'playoff-2001'",
			)
			.get() as { away_team_id: string | null } | undefined;
		closeSqliteDb(db);
		expect(row).toBeDefined();
		expect(row?.away_team_id).toBeNull();
	});
});
