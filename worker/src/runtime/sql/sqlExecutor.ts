import { Pool } from "pg";

import type { WorkerEnv } from "../env";
import { sanitizeSqlQuery } from "./sqlSafety";

let cachedPool: Pool | null = null;
let cachedPoolUrl: string | null = null;

/**
 * Adds runtime SSL mode defaults to the configured connection string when absent.
 */
const resolveConnectionString = (env: WorkerEnv): string => {
	const raw = env.SUPABASE_DB_URL.trim();
	if (!raw) {
		return raw;
	}

	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		return raw;
	}

	if (parsed.searchParams.has("sslmode")) {
		return parsed.toString();
	}

	parsed.searchParams.set(
		"sslmode",
		env.SUPABASE_DB_SSL_NO_VERIFY ? "no-verify" : "require",
	);
	return parsed.toString();
};

/**
 * Returns a cached Postgres pool for the current connection string.
 */
const getPool = (env: WorkerEnv): Pool => {
	const connectionString = resolveConnectionString(env);
	if (cachedPool && cachedPoolUrl === connectionString) {
		return cachedPool;
	}

	cachedPool = new Pool({
		connectionString,
		ssl: env.SUPABASE_DB_SSL_NO_VERIFY
			? { rejectUnauthorized: false }
			: { rejectUnauthorized: true },
		max: 1,
		connectionTimeoutMillis: env.SQL_QUERY_TIMEOUT_MS,
		query_timeout: env.SQL_QUERY_TIMEOUT_MS,
		allowExitOnIdle: true,
	});
	cachedPoolUrl = connectionString;

	return cachedPool;
};

/**
 * Sanitizes and executes a read-only SQL query, returning rows as JSON text.
 */
export const executeReadOnlySql = async (
	env: WorkerEnv,
	query: string,
): Promise<string> => {
	const rows = await executeReadOnlySqlRows(env, query);
	if (rows.length === 0) {
		return "[]";
	}

	return JSON.stringify(rows, null, 2);
};

/**
 * Sanitizes and executes a read-only SQL query, returning raw rows.
 */
export const executeReadOnlySqlRows = async (
	env: WorkerEnv,
	query: string,
): Promise<Array<Record<string, unknown>>> => {
	const pool = getPool(env);
	const sanitized = sanitizeSqlQuery(query);
	const result = await pool.query(sanitized);
	return result.rows as Array<Record<string, unknown>>;
};
