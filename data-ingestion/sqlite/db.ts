import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

export type SqliteDb = Database.Database;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const openSqliteDb = (dbPath: string): SqliteDb => {
	const db = new Database(dbPath);
	db.pragma("foreign_keys = ON");
	db.pragma("journal_mode = WAL");
	return db;
};

export const initSqliteSchema = (db: SqliteDb): void => {
	const schemaPath = join(__dirname, "schema.sql");
	const sql = readFileSync(schemaPath, "utf8");
	db.exec(sql);
};

export const queryTableNames = (db: SqliteDb): string[] => {
	const rows = db
		.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
		)
		.all() as Array<{ name: string }>;
	return rows.map((row) => row.name);
};

export const closeSqliteDb = (db: SqliteDb): void => {
	db.close();
};
