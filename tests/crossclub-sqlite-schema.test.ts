import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import {
	closeSqliteDb,
	initSqliteSchema,
	openSqliteDb,
	queryTableNames,
} from "../data-ingestion/sqlite/db";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("crossclub sqlite schema", () => {
	it("creates required tables and enables foreign keys", () => {
		const dir = mkdtempSync(join(tmpdir(), "crossclub-sqlite-"));
		tempDirs.push(dir);
		const dbPath = join(dir, "ingest.db");

		const db = openSqliteDb(dbPath);
		initSqliteSchema(db);

		const tables = queryTableNames(db);
		expect(tables).toContain("regions");
		expect(tables).toContain("divisions");
		expect(tables).toContain("teams");
		expect(tables).toContain("players");
		expect(tables).toContain("matchups");
		expect(tables).toContain("lineups");
		expect(tables).toContain("lineup_slots");
		expect(tables).toContain("ingest_runs");

		const fk = db.pragma("foreign_keys", { simple: true }) as number;
		expect(fk).toBe(1);

		closeSqliteDb(db);
	});
});
