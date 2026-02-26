import { Pool } from "pg";

import type { WorkerEnv } from "../env";
import type { VerifyStateSnapshot } from "./types";

let cachedPool: Pool | null = null;
let cachedPoolUrl: string | null = null;

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

	if (!parsed.searchParams.has("sslmode")) {
		parsed.searchParams.set(
			"sslmode",
			env.SUPABASE_DB_SSL_NO_VERIFY ? "no-verify" : "require",
		);
	}

	return parsed.toString();
};

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
		max: 4,
		connectionTimeoutMillis: Math.min(10_000, env.SQL_QUERY_TIMEOUT_MS),
		idleTimeoutMillis: 5_000,
		maxUses: 30,
		query_timeout: env.SQL_QUERY_TIMEOUT_MS,
		allowExitOnIdle: true,
	});
	cachedPoolUrl = connectionString;
	return cachedPool;
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
	env: WorkerEnv,
	emailHash: string,
	ipHash: string,
): Promise<RecentOtpRequestCounts> => {
	const result = await getPool(env).query<RecentOtpRequestCountsRow>(
		`select
		   count(*) filter (where email_hash = $1) as email_count,
		   count(*) filter (where ip_hash = $2) as ip_count,
		   min(occurred_at) filter (where email_hash = $1) as oldest_email_at,
		   min(occurred_at) filter (where ip_hash = $2) as oldest_ip_at
		 from auth_private.auth_otp_request_events
		 where occurred_at >= now() - interval '15 minutes'`,
		[emailHash, ipHash],
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
	env: WorkerEnv,
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
	env: WorkerEnv,
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
	env: WorkerEnv,
	input: {
		requestId: string;
		eventType:
			| "otp_request"
			| "otp_verify"
			| "signout"
			| "refresh_failure";
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
	env: WorkerEnv,
	emailHash: string,
): Promise<VerifyStateSnapshot | null> => {
	const result = await getPool(env).query<VerifyStateRow>(
		`select failed_attempts, cooldown_until, locked_until, last_failed_at
		 from auth_private.auth_otp_verify_state
		 where email_hash = $1`,
		[emailHash],
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
	env: WorkerEnv,
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
	env: WorkerEnv,
	emailHash: string,
): Promise<void> => {
	await getPool(env).query(
		`delete from auth_private.auth_otp_verify_state where email_hash = $1`,
		[emailHash],
	);
};

export const cleanupExpiredAuthRecords = async (env: WorkerEnv): Promise<void> => {
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
};
