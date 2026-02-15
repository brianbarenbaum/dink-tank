import { join } from "node:path";

import { closeSqliteDb, initSqliteSchema, openSqliteDb } from "./db.ts";

const dbPath = process.env.CROSSCLUB_SQLITE_PATH ?? join("data-ingestion", "sqlite", "crossclub.db");

const db = openSqliteDb(dbPath);
initSqliteSchema(db);
closeSqliteDb(db);

console.log(`[crossclub-sqlite] initialized schema at ${dbPath}`);
