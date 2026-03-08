import { Pool } from "pg";

import type { WorkerEnv } from "../env";
import { getApprovedSqlRelations } from "./approvedRelations";
import { extractReferencedRelations } from "./extractReferencedRelations";
import { sanitizeSqlQuery } from "./sqlSafety";
import { SqlSafetyError } from "./sqlErrors";

let cachedPool: Pool | null = null;
let cachedPoolUrl: string | null = null;
const DEFAULT_SQL_POOL_MAX = 4;
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_IDLE_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_USES = 20;
const MAX_SQL_RETRY_BUDGET_MS = 15_000;

export interface SqlExecutionOptions {
	enforceApprovedRelations?: boolean;
}

const nowMs = (): number => Date.now();

const normalizeQueryForLog = (query: string): string =>
	query.replace(/\s+/g, " ").trim().slice(0, 600);

const canLogSensitiveSqlDetails = (env: WorkerEnv): boolean =>
	env.APP_ENV === "local";

const buildSqlLogPayload = (
	env: WorkerEnv,
	query: string,
	data: Record<string, unknown>,
): Record<string, unknown> =>
	canLogSensitiveSqlDetails(env)
		? { ...data, query: normalizeQueryForLog(query) }
		: data;

const logSqlQueryExecuted = (data: {
	env: WorkerEnv;
	query: string;
	durationMs: number;
	rowCount: number;
	timeoutMs: number;
}): void => {
	console.log(
		JSON.stringify(
			buildSqlLogPayload(data.env, data.query, {
				level: "info",
				component: "sql_executor",
				message: "sql_query_executed",
				durationMs: data.durationMs,
				rowCount: data.rowCount,
				timeoutMs: data.timeoutMs,
			}),
		),
	);
};

const logSqlQueryFailed = (data: {
	env: WorkerEnv;
	query: string;
	durationMs: number;
	timeoutMs: number;
	error: unknown;
}): void => {
	const errorPayload =
		data.error instanceof Error
			? { name: data.error.name, message: data.error.message }
			: { name: "UnknownError", message: String(data.error) };
	console.error(
		JSON.stringify(
			buildSqlLogPayload(data.env, data.query, {
				level: "error",
				component: "sql_executor",
				message: "sql_query_failed",
				durationMs: data.durationMs,
				timeoutMs: data.timeoutMs,
				error: errorPayload,
			}),
		),
	);
};

const logSqlPoolState = (pool: Pool, reason: string): void => {
	const stats = pool as unknown as {
		totalCount?: number;
		idleCount?: number;
		waitingCount?: number;
	};
	console.warn(
		JSON.stringify({
			level: "warn",
			component: "sql_executor",
			message: "sql_pool_state",
			reason,
			totalCount:
				typeof stats.totalCount === "number" ? stats.totalCount : null,
			idleCount: typeof stats.idleCount === "number" ? stats.idleCount : null,
			waitingCount:
				typeof stats.waitingCount === "number" ? stats.waitingCount : null,
		}),
	);
};

const logSqlQueryRetry = (data: {
	env: WorkerEnv;
	query: string;
	reason: string;
}): void => {
	console.warn(
		JSON.stringify(
			buildSqlLogPayload(data.env, data.query, {
				level: "warn",
				component: "sql_executor",
				message: "sql_query_retrying",
				reason: data.reason,
			}),
		),
	);
};

const logSqlQueryRetrySkipped = (data: {
	env: WorkerEnv;
	query: string;
	reason: string;
	elapsedMs: number;
}): void => {
	console.warn(
		JSON.stringify(
			buildSqlLogPayload(data.env, data.query, {
				level: "warn",
				component: "sql_executor",
				message: "sql_query_retry_skipped",
				reason: data.reason,
				elapsedMs: data.elapsedMs,
				retryBudgetMs: MAX_SQL_RETRY_BUDGET_MS,
			}),
		),
	);
};

const logSqlQueryPlanCaptured = (data: {
	env: WorkerEnv;
	query: string;
	phase: "success" | "failure";
	plan: unknown;
}): void => {
	console.log(
		JSON.stringify(
			buildSqlLogPayload(data.env, data.query, {
				level: "info",
				component: "sql_executor",
				message: "sql_query_plan_captured",
				phase: data.phase,
				plan: data.plan,
			}),
		),
	);
};

const logSqlQueryPlanFailed = (data: {
	env: WorkerEnv;
	query: string;
	phase: "success" | "failure";
	error: unknown;
}): void => {
	const errorPayload =
		data.error instanceof Error
			? { name: data.error.name, message: data.error.message }
			: { name: "UnknownError", message: String(data.error) };
	console.warn(
		JSON.stringify(
			buildSqlLogPayload(data.env, data.query, {
				level: "warn",
				component: "sql_executor",
				message: "sql_query_plan_capture_failed",
				phase: data.phase,
				error: errorPayload,
			}),
		),
	);
};

const buildExplainPlanQuery = (sanitizedQuery: string): string =>
	`EXPLAIN (FORMAT JSON) ${sanitizedQuery}`;

const maybeCaptureExplainPlan = async (input: {
	env: WorkerEnv;
	pool: Pool;
	query: string;
	phase: "success" | "failure";
}): Promise<void> => {
	if (
		!input.env.SQL_CAPTURE_EXPLAIN_PLAN ||
		!canLogSensitiveSqlDetails(input.env)
	) {
		return;
	}
	try {
		const explainSql = buildExplainPlanQuery(input.query);
		const result = await input.pool.query(explainSql);
		const plan =
			Array.isArray(result.rows) && result.rows.length > 0
				? (result.rows[0]["QUERY PLAN"] ??
					result.rows[0].query_plan ??
					result.rows[0])
				: [];
		logSqlQueryPlanCaptured({
			env: input.env,
			query: input.query,
			phase: input.phase,
			plan,
		});
	} catch (error) {
		logSqlQueryPlanFailed({
			env: input.env,
			query: input.query,
			phase: input.phase,
			error,
		});
	}
};

const isRetryableConnectionError = (error: unknown): boolean => {
	if (!(error instanceof Error)) {
		return false;
	}
	const message = error.message.toLowerCase();
	return (
		message.includes("timeout exceeded when trying to connect") ||
		message.includes("query read timeout") ||
		message.includes("connection terminated unexpectedly") ||
		message.includes("econnreset") ||
		message.includes("broken pipe")
	);
};

const resetCachedPool = async (): Promise<void> => {
	const previousPool = cachedPool;
	cachedPool = null;
	cachedPoolUrl = null;
	if (!previousPool || typeof previousPool.end !== "function") {
		return;
	}
	try {
		await previousPool.end();
	} catch {
		// best-effort cleanup
	}
};

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
		max: DEFAULT_SQL_POOL_MAX,
		connectionTimeoutMillis: Math.min(
			DEFAULT_CONNECT_TIMEOUT_MS,
			env.SQL_QUERY_TIMEOUT_MS,
		),
		idleTimeoutMillis: DEFAULT_IDLE_TIMEOUT_MS,
		maxUses: DEFAULT_MAX_USES,
		query_timeout: env.SQL_QUERY_TIMEOUT_MS,
		allowExitOnIdle: true,
	});
	cachedPoolUrl = connectionString;

	return cachedPool;
};

const assertApprovedRelations = (query: string): void => {
	const approvedRelations = getApprovedSqlRelations();
	let referencedRelations: ReadonlySet<string>;
	try {
		referencedRelations = extractReferencedRelations(query);
	} catch {
		throw new SqlSafetyError(
			"RELATION_NOT_ALLOWED",
			"Unable to verify that the query stays within the approved catalog.",
		);
	}

	for (const relation of referencedRelations) {
		if (!approvedRelations.has(relation.toLowerCase())) {
			throw new SqlSafetyError(
				"RELATION_NOT_ALLOWED",
				"Query references relations outside the approved catalog.",
			);
		}
	}
};

/**
 * Sanitizes and executes a read-only SQL query, returning rows as JSON text.
 */
export const executeReadOnlySql = async (
	env: WorkerEnv,
	query: string,
	options?: SqlExecutionOptions,
): Promise<string> => {
	const rows = await executeReadOnlySqlRows(env, query, options);
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
	options?: SqlExecutionOptions,
): Promise<Array<Record<string, unknown>>> => {
	const sanitized = sanitizeSqlQuery(query);
	if (options?.enforceApprovedRelations) {
		assertApprovedRelations(sanitized);
	}
	const requestStartedAt = nowMs();
	const runQuery = async (): Promise<Array<Record<string, unknown>>> => {
		const pool = getPool(env);
		const startedAt = nowMs();
		try {
			const result = await pool.query(sanitized);
			logSqlQueryExecuted({
				env,
				query: sanitized,
				durationMs: nowMs() - startedAt,
				rowCount: Array.isArray(result.rows) ? result.rows.length : 0,
				timeoutMs: env.SQL_QUERY_TIMEOUT_MS,
			});
			return result.rows as Array<Record<string, unknown>>;
		} catch (error) {
			logSqlQueryFailed({
				env,
				query: sanitized,
				durationMs: nowMs() - startedAt,
				timeoutMs: env.SQL_QUERY_TIMEOUT_MS,
				error,
			});
			logSqlPoolState(pool, "query_failed");
			await maybeCaptureExplainPlan({
				env,
				pool,
				query: sanitized,
				phase: "failure",
			});
			throw error;
		}
	};

	try {
		return await runQuery();
	} catch (error) {
		if (!isRetryableConnectionError(error)) {
			throw error;
		}
		const retryReason = error instanceof Error ? error.message : String(error);
		const elapsedMs = nowMs() - requestStartedAt;
		if (elapsedMs >= MAX_SQL_RETRY_BUDGET_MS) {
			logSqlQueryRetrySkipped({
				env,
				query: sanitized,
				reason: retryReason,
				elapsedMs,
			});
			throw error;
		}
		logSqlQueryRetry({
			env,
			query: sanitized,
			reason: retryReason,
		});
		await resetCachedPool();
		return runQuery();
	}
};
