import { Pool } from "pg";

import type { WorkerEnv } from "../env";
import type {
	ActiveInviteCodeSnapshot,
	PendingEnrollmentSnapshot,
	VerifyStateSnapshot,
} from "./types";

export type AuthRepositoryEnv = Pick<
	WorkerEnv,
	"SUPABASE_DB_URL" | "SUPABASE_DB_SSL_NO_VERIFY" | "SQL_QUERY_TIMEOUT_MS"
>;

let cachedPool: Pool | null = null;
let cachedPoolUrl: string | null = null;
const TRANSIENT_RETRY_ATTEMPTS = 2;

const resolveConnectionString = (env: AuthRepositoryEnv): string => {
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

	if (!parsed.searchParams.has("sslmode")) {
		parsed.searchParams.set(
			"sslmode",
			env.SUPABASE_DB_SSL_NO_VERIFY ? "no-verify" : "require",
		);
	}

	return parsed.toString();
};

const getPool = (env: AuthRepositoryEnv): Pool => {
	const connectionString = resolveConnectionString(env);
	if (cachedPool && cachedPoolUrl === connectionString) {
		return cachedPool;
	}

	cachedPool = new Pool({
		connectionString,
		ssl: env.SUPABASE_DB_SSL_NO_VERIFY
			? { rejectUnauthorized: false }
			: { rejectUnauthorized: true },
		max: 4,
		connectionTimeoutMillis: env.SQL_QUERY_TIMEOUT_MS,
		idleTimeoutMillis: 5_000,
		maxUses: 30,
		query_timeout: env.SQL_QUERY_TIMEOUT_MS,
		allowExitOnIdle: true,
	});
	cachedPoolUrl = connectionString;
	return cachedPool;
};

const isTransientDbError = (error: unknown): boolean => {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message.toLowerCase();
	return (
		message.includes("query read timeout") ||
		message.includes("connection terminated unexpectedly") ||
		message.includes("terminating connection") ||
		message.includes("timeout expired") ||
		message.includes("connection reset") ||
		message.includes("econnreset") ||
		message.includes("etimedout")
	);
};

const sleep = async (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

const resetCachedPool = async (): Promise<void> => {
	if (!cachedPool) {
		return;
	}

	const existingPool = cachedPool;
	cachedPool = null;
	cachedPoolUrl = null;

	try {
		await existingPool.end();
	} catch {
		// best-effort pool reset for transient connection issues
	}
};

const runWithReadPoolRetry = async <T>(
	env: AuthRepositoryEnv,
	operation: (pool: Pool) => Promise<T>,
): Promise<T> => {
	let lastError: unknown;
	for (let attempt = 1; attempt <= TRANSIENT_RETRY_ATTEMPTS; attempt += 1) {
		const pool = getPool(env);
		try {
			return await operation(pool);
		} catch (error) {
			lastError = error;
			if (!isTransientDbError(error) || attempt === TRANSIENT_RETRY_ATTEMPTS) {
				throw error;
			}
			await resetCachedPool();
			await sleep(100 * attempt);
		}
	}

	throw lastError;
};

interface RecentOtpRequestCountsRow {
	email_count: number | string;
	ip_count: number | string;
	oldest_email_at: string | null;
	oldest_ip_at: string | null;
}

export interface RecentOtpRequestCounts {
	emailCount: number;
	ipCount: number;
	oldestEmailAt: Date | null;
	oldestIpAt: Date | null;
}

export const fetchRecentOtpRequestCounts = async (
	env: AuthRepositoryEnv,
	emailHash: string,
	ipHash: string,
): Promise<RecentOtpRequestCounts> => {
	const result = await runWithReadPoolRetry(env, (pool) =>
		pool.query<RecentOtpRequestCountsRow>(
			`select
		   count(*) filter (where email_hash = $1) as email_count,
		   count(*) filter (where ip_hash = $2) as ip_count,
		   min(occurred_at) filter (where email_hash = $1) as oldest_email_at,
		   min(occurred_at) filter (where ip_hash = $2) as oldest_ip_at
		 from auth_private.auth_otp_request_events
		 where occurred_at >= now() - interval '15 minutes'`,
			[emailHash, ipHash],
		),
	);
	const row = result.rows[0];
	return {
		emailCount: Number(row?.email_count ?? 0),
		ipCount: Number(row?.ip_count ?? 0),
		oldestEmailAt: row?.oldest_email_at ? new Date(row.oldest_email_at) : null,
		oldestIpAt: row?.oldest_ip_at ? new Date(row.oldest_ip_at) : null,
	};
};

export const insertOtpRequestEvent = async (
	env: AuthRepositoryEnv,
	input: {
		requestId: string;
		emailNormalized: string;
		emailHash: string;
		ipHash: string;
		outcome: "success" | "failure" | "rate_limited" | "turnstile_rejected";
		reason?: string;
	},
): Promise<void> => {
	await getPool(env).query(
		`insert into auth_private.auth_otp_request_events
		 (request_id, email_normalized, email_hash, ip_hash, outcome, reason)
		 values ($1, $2, $3, $4, $5, $6)`,
		[
			input.requestId,
			input.emailNormalized,
			input.emailHash,
			input.ipHash,
			input.outcome,
			input.reason ?? null,
		],
	);
};

export const insertOtpVerifyEvent = async (
	env: AuthRepositoryEnv,
	input: {
		requestId: string;
		emailNormalized: string;
		emailHash: string;
		ipHash: string;
		success: boolean;
		reason?: string;
	},
): Promise<void> => {
	await getPool(env).query(
		`insert into auth_private.auth_otp_verify_events
		 (request_id, email_normalized, email_hash, ip_hash, success, reason)
		 values ($1, $2, $3, $4, $5, $6)`,
		[
			input.requestId,
			input.emailNormalized,
			input.emailHash,
			input.ipHash,
			input.success,
			input.reason ?? null,
		],
	);
};

export const insertAuthAuditEvent = async (
	env: AuthRepositoryEnv,
	input: {
		requestId: string;
		eventType: "otp_request" | "otp_verify" | "signout" | "refresh_failure";
		status: "success" | "failure";
		emailNormalized?: string;
		emailHash?: string;
		details?: Record<string, unknown>;
	},
): Promise<void> => {
	await getPool(env).query(
		`insert into auth_private.auth_audit_events
		 (request_id, event_type, status, email_normalized, email_hash, details)
		 values ($1, $2, $3, $4, $5, $6::jsonb)`,
		[
			input.requestId,
			input.eventType,
			input.status,
			input.emailNormalized ?? null,
			input.emailHash ?? null,
			JSON.stringify(input.details ?? {}),
		],
	);
};

interface VerifyStateRow {
	failed_attempts: number;
	cooldown_until: string | null;
	locked_until: string | null;
	last_failed_at: string | null;
}

export const getVerifyState = async (
	env: AuthRepositoryEnv,
	emailHash: string,
): Promise<VerifyStateSnapshot | null> => {
	const result = await runWithReadPoolRetry(env, (pool) =>
		pool.query<VerifyStateRow>(
			`select failed_attempts, cooldown_until, locked_until, last_failed_at
		 from auth_private.auth_otp_verify_state
		 where email_hash = $1`,
			[emailHash],
		),
	);
	const row = result.rows[0];
	if (!row) {
		return null;
	}
	return {
		failedAttempts: row.failed_attempts,
		cooldownUntil: row.cooldown_until ? new Date(row.cooldown_until) : null,
		lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
		lastFailedAt: row.last_failed_at ? new Date(row.last_failed_at) : null,
	};
};

export const upsertVerifyState = async (
	env: AuthRepositoryEnv,
	input: {
		emailHash: string;
		failedAttempts: number;
		cooldownUntil: Date | null;
		lockedUntil: Date | null;
		lastFailedAt: Date | null;
	},
): Promise<void> => {
	await getPool(env).query(
		`insert into auth_private.auth_otp_verify_state
		 (email_hash, failed_attempts, cooldown_until, locked_until, last_failed_at, updated_at)
		 values ($1, $2, $3, $4, $5, now())
		 on conflict (email_hash)
		 do update
		 set failed_attempts = excluded.failed_attempts,
		     cooldown_until = excluded.cooldown_until,
		     locked_until = excluded.locked_until,
		     last_failed_at = excluded.last_failed_at,
		     updated_at = now()`,
		[
			input.emailHash,
			input.failedAttempts,
			input.cooldownUntil?.toISOString() ?? null,
			input.lockedUntil?.toISOString() ?? null,
			input.lastFailedAt?.toISOString() ?? null,
		],
	);
};

export const clearVerifyState = async (
	env: AuthRepositoryEnv,
	emailHash: string,
): Promise<void> => {
	await getPool(env).query(
		`delete from auth_private.auth_otp_verify_state where email_hash = $1`,
		[emailHash],
	);
};

interface ActiveInviteCodeRow {
	id: number | string;
	expires_at: string;
}

export const isApprovedEmail = async (
	env: AuthRepositoryEnv,
	emailNormalized: string,
): Promise<boolean> => {
	const result = await runWithReadPoolRetry(env, (pool) =>
		pool.query(
			`select 1
		 from auth_private.auth_approved_emails
		 where email_normalized = $1
		 limit 1`,
			[emailNormalized],
		),
	);
	return (result.rowCount ?? 0) > 0;
};

export const insertApprovedEmail = async (
	env: AuthRepositoryEnv,
	input: {
		emailNormalized: string;
		inviteCodeId: number;
	},
): Promise<void> => {
	await getPool(env).query(
		`insert into auth_private.auth_approved_emails
		 (email_normalized, invite_code_id)
		 values ($1, $2)
		 on conflict (email_normalized)
		 do nothing`,
		[input.emailNormalized, input.inviteCodeId],
	);
};

export const findActiveInviteCodeByHash = async (
	env: AuthRepositoryEnv,
	codeHash: string,
): Promise<ActiveInviteCodeSnapshot | null> => {
	const result = await runWithReadPoolRetry(env, (pool) =>
		pool.query<ActiveInviteCodeRow>(
			`select id, expires_at
		 from auth_private.auth_invite_codes
		 where code_hash = $1
		   and active = true
		   and expires_at > now()
		 limit 1`,
			[codeHash],
		),
	);
	const row = result.rows[0];
	if (!row) {
		return null;
	}
	return {
		id: Number(row.id),
		expiresAt: new Date(row.expires_at),
	};
};

export const createInviteCode = async (
	env: AuthRepositoryEnv,
	input: {
		codeHash: string;
		expiresAt: Date;
	},
): Promise<ActiveInviteCodeSnapshot> => {
	const pool = getPool(env);
	const client = await pool.connect();
	try {
		await client.query("begin");
		await client.query(
			`update auth_private.auth_invite_codes
			 set active = false,
			     deactivated_at = now()
			 where active = true`,
		);
		const result = await client.query<ActiveInviteCodeRow>(
			`insert into auth_private.auth_invite_codes
			 (code_hash, expires_at)
			 values ($1, $2)
			 returning id, expires_at`,
			[input.codeHash, input.expiresAt.toISOString()],
		);
		await client.query("commit");
		const row = result.rows[0];
		return {
			id: Number(row.id),
			expiresAt: new Date(row.expires_at),
		};
	} catch (error) {
		await client.query("rollback");
		throw error;
	} finally {
		client.release();
	}
};

export const deactivateActiveInviteCode = async (
	env: AuthRepositoryEnv,
): Promise<{ id: number } | null> => {
	const result = await getPool(env).query<{ id: number | string }>(
		`update auth_private.auth_invite_codes
		 set active = false,
		     deactivated_at = now()
		 where id = (
		   select id
		   from auth_private.auth_invite_codes
		   where active = true
		   order by created_at desc
		   limit 1
		 )
		 returning id`,
	);
	const row = result.rows[0];
	return row ? { id: Number(row.id) } : null;
};

interface PendingEnrollmentRow {
	invite_code_id: number | string;
	expires_at: string;
}

export const getPendingEnrollment = async (
	env: AuthRepositoryEnv,
	emailNormalized: string,
): Promise<PendingEnrollmentSnapshot | null> => {
	const result = await runWithReadPoolRetry(env, (pool) =>
		pool.query<PendingEnrollmentRow>(
			`select invite_code_id, expires_at
		 from auth_private.auth_pending_enrollments
		 where email_normalized = $1
		   and expires_at > now()
		 limit 1`,
			[emailNormalized],
		),
	);
	const row = result.rows[0];
	if (!row) {
		return null;
	}
	return {
		inviteCodeId: Number(row.invite_code_id),
		expiresAt: new Date(row.expires_at),
	};
};

export const upsertPendingEnrollment = async (
	env: AuthRepositoryEnv,
	input: {
		emailNormalized: string;
		inviteCodeId: number;
		expiresAt: Date;
	},
): Promise<void> => {
	await getPool(env).query(
		`insert into auth_private.auth_pending_enrollments
		 (email_normalized, invite_code_id, created_at, expires_at)
		 values ($1, $2, now(), $3)
		 on conflict (email_normalized)
		 do update
		 set invite_code_id = excluded.invite_code_id,
		     created_at = now(),
		     expires_at = excluded.expires_at`,
		[input.emailNormalized, input.inviteCodeId, input.expiresAt.toISOString()],
	);
};

export const deletePendingEnrollment = async (
	env: AuthRepositoryEnv,
	emailNormalized: string,
): Promise<void> => {
	await getPool(env).query(
		`delete from auth_private.auth_pending_enrollments
		 where email_normalized = $1`,
		[emailNormalized],
	);
};

export const cleanupExpiredAuthRecords = async (
	env: AuthRepositoryEnv,
): Promise<void> => {
	const pool = getPool(env);
	await pool.query(
		`delete from auth_private.auth_otp_request_events
		 where occurred_at < now() - interval '30 days'`,
	);
	await pool.query(
		`delete from auth_private.auth_otp_verify_events
		 where occurred_at < now() - interval '30 days'`,
	);
	await pool.query(
		`delete from auth_private.auth_audit_events
		 where occurred_at < now() - interval '30 days'`,
	);
	await pool.query(
		`delete from auth_private.auth_otp_verify_state
		 where updated_at < now() - interval '30 days'`,
	);
	await pool.query(
		`delete from auth_private.auth_pending_enrollments
		 where expires_at < now()`,
	);
};
