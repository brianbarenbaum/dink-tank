export interface WorkerEnv {
	OPENAI_API_KEY: string;
	SUPABASE_DB_URL: string;
	SUPABASE_DB_SSL_NO_VERIFY: boolean;
	APP_ENV: "local" | "staging" | "production";
	SUPABASE_URL: string;
	SUPABASE_ANON_KEY: string;
	AUTH_ALLOWED_ORIGINS: string[];
	AUTH_JWT_ISSUER: string;
	AUTH_JWT_AUDIENCE: string;
	AUTH_BYPASS_ENABLED: boolean;
	AUTH_TURNSTILE_BYPASS: boolean;
	AUTH_TURNSTILE_SECRET?: string;
	AUTH_IP_HASH_SALT: string;
	LLM_MODEL: string;
	LLM_REASONING_LEVEL: "low" | "medium" | "high";
	SQL_QUERY_TIMEOUT_MS: number;
	SQL_CAPTURE_EXPLAIN_PLAN: boolean;
	EXPOSE_ERROR_DETAILS: boolean;
	LANGFUSE_PUBLIC_KEY?: string;
	LANGFUSE_SECRET_KEY?: string;
	LANGFUSE_BASE_URL?: string;
	LANGFUSE_TRACING_ENVIRONMENT: string;
	LANGFUSE_ENABLED: boolean;
	LINEUP_ENABLE_DUPR_BLEND?: boolean;
	LINEUP_DUPR_MAJOR_WEIGHT?: number;
	LINEUP_ENABLE_TEAM_STRENGTH_ADJUSTMENT?: boolean;
	LINEUP_DUPR_SLOPE?: number;
	LINEUP_TEAM_STRENGTH_FACTOR?: number;
	LINEUP_TEAM_STRENGTH_CAP?: number;
}

interface ParseEnvSuccess {
	ok: true;
	value: WorkerEnv;
}

interface ParseEnvFailure {
	ok: false;
	error: string;
}

export type ParseEnvResult = ParseEnvSuccess | ParseEnvFailure;

const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_REASONING_LEVEL = "medium";
const DEFAULT_SQL_TIMEOUT_MS = 25_000;
const DEFAULT_LANGFUSE_TRACING_ENVIRONMENT = "default";
const DEFAULT_APP_ENV = "local";
const DEFAULT_AUTH_AUDIENCE = "authenticated";
const DEFAULT_LOCAL_ALLOWED_ORIGINS = ["http://localhost:5173"];
const DEFAULT_LINEUP_ENABLE_DUPR_BLEND = true;
const DEFAULT_LINEUP_DUPR_MAJOR_WEIGHT = 0.65;
const DEFAULT_LINEUP_ENABLE_TEAM_STRENGTH_ADJUSTMENT = true;
const DEFAULT_LINEUP_DUPR_SLOPE = 1.6;
const DEFAULT_LINEUP_TEAM_STRENGTH_FACTOR = 0.45;
const DEFAULT_LINEUP_TEAM_STRENGTH_CAP = 0.35;
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const parseAllowedOrigins = (input: string | undefined): string[] =>
	(input ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

/**
 * Parses raw Worker environment values into a validated runtime config object.
 */
export const parseWorkerEnv = (
	env: Record<string, string | undefined>,
): ParseEnvResult => {
	const OPENAI_API_KEY = env.OPENAI_API_KEY?.trim();
	const SUPABASE_DB_URL = env.SUPABASE_DB_URL?.trim();

	if (!OPENAI_API_KEY) {
		return { ok: false, error: "Missing OPENAI_API_KEY" };
	}

	if (!SUPABASE_DB_URL) {
		return { ok: false, error: "Missing SUPABASE_DB_URL" };
	}

	const SUPABASE_URL = env.SUPABASE_URL?.trim();
	if (!SUPABASE_URL) {
		return { ok: false, error: "Missing SUPABASE_URL" };
	}

	const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY?.trim();
	if (!SUPABASE_ANON_KEY) {
		return { ok: false, error: "Missing SUPABASE_ANON_KEY" };
	}

	const rawAppEnv =
		env.APP_ENV?.trim().toLowerCase() ??
		env.ENVIRONMENT?.trim().toLowerCase() ??
		DEFAULT_APP_ENV;
	if (
		rawAppEnv !== "local" &&
		rawAppEnv !== "staging" &&
		rawAppEnv !== "production"
	) {
		return {
			ok: false,
			error: "APP_ENV must be one of: local, staging, production",
		};
	}
	const APP_ENV = rawAppEnv as "local" | "staging" | "production";

	const AUTH_BYPASS_ENABLED = TRUE_VALUES.has(
		env.AUTH_BYPASS_ENABLED?.trim().toLowerCase() ?? "",
	);
	if (APP_ENV === "production" && AUTH_BYPASS_ENABLED) {
		return {
			ok: false,
			error: "AUTH_BYPASS_ENABLED is not allowed in production",
		};
	}

	const AUTH_TURNSTILE_BYPASS = TRUE_VALUES.has(
		env.AUTH_TURNSTILE_BYPASS?.trim().toLowerCase() ?? "",
	);
	if (APP_ENV === "production" && AUTH_TURNSTILE_BYPASS) {
		return {
			ok: false,
			error: "AUTH_TURNSTILE_BYPASS is not allowed in production",
		};
	}

	const AUTH_TURNSTILE_SECRET = env.AUTH_TURNSTILE_SECRET?.trim() || undefined;
	if (!AUTH_TURNSTILE_BYPASS && !AUTH_TURNSTILE_SECRET) {
		return {
			ok: false,
			error: "Missing AUTH_TURNSTILE_SECRET when turnstile bypass is disabled",
		};
	}

	const AUTH_IP_HASH_SALT = env.AUTH_IP_HASH_SALT?.trim();
	if (!AUTH_IP_HASH_SALT) {
		return { ok: false, error: "Missing AUTH_IP_HASH_SALT" };
	}

	const AUTH_ALLOWED_ORIGINS = parseAllowedOrigins(env.AUTH_ALLOWED_ORIGINS);
	if (AUTH_ALLOWED_ORIGINS.length === 0 && APP_ENV !== "local") {
		return {
			ok: false,
			error: "Missing AUTH_ALLOWED_ORIGINS for non-local environments",
		};
	}
	const effectiveAllowedOrigins =
		AUTH_ALLOWED_ORIGINS.length > 0
			? AUTH_ALLOWED_ORIGINS
			: [...DEFAULT_LOCAL_ALLOWED_ORIGINS];

	const AUTH_JWT_ISSUER =
		env.AUTH_JWT_ISSUER?.trim() ||
		`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1`;
	const AUTH_JWT_AUDIENCE =
		env.AUTH_JWT_AUDIENCE?.trim() || DEFAULT_AUTH_AUDIENCE;

	const timeoutRaw = env.SQL_QUERY_TIMEOUT_MS?.trim();
	const SQL_QUERY_TIMEOUT_MS = timeoutRaw
		? Number.parseInt(timeoutRaw, 10)
		: DEFAULT_SQL_TIMEOUT_MS;

	if (Number.isNaN(SQL_QUERY_TIMEOUT_MS) || SQL_QUERY_TIMEOUT_MS <= 0) {
		return {
			ok: false,
			error: "SQL_QUERY_TIMEOUT_MS must be a positive integer",
		};
	}

	const lineupDuprMajorWeightRaw = env.LINEUP_DUPR_MAJOR_WEIGHT?.trim();
	const LINEUP_DUPR_MAJOR_WEIGHT = lineupDuprMajorWeightRaw
		? Number.parseFloat(lineupDuprMajorWeightRaw)
		: DEFAULT_LINEUP_DUPR_MAJOR_WEIGHT;
	if (
		Number.isNaN(LINEUP_DUPR_MAJOR_WEIGHT) ||
		LINEUP_DUPR_MAJOR_WEIGHT < 0 ||
		LINEUP_DUPR_MAJOR_WEIGHT > 1
	) {
		return {
			ok: false,
			error: "LINEUP_DUPR_MAJOR_WEIGHT must be between 0 and 1",
		};
	}

	const lineupDuprSlopeRaw = env.LINEUP_DUPR_SLOPE?.trim();
	const LINEUP_DUPR_SLOPE = lineupDuprSlopeRaw
		? Number.parseFloat(lineupDuprSlopeRaw)
		: DEFAULT_LINEUP_DUPR_SLOPE;
	if (Number.isNaN(LINEUP_DUPR_SLOPE) || LINEUP_DUPR_SLOPE <= 0) {
		return {
			ok: false,
			error: "LINEUP_DUPR_SLOPE must be a positive number",
		};
	}

	const lineupTeamStrengthFactorRaw = env.LINEUP_TEAM_STRENGTH_FACTOR?.trim();
	const LINEUP_TEAM_STRENGTH_FACTOR = lineupTeamStrengthFactorRaw
		? Number.parseFloat(lineupTeamStrengthFactorRaw)
		: DEFAULT_LINEUP_TEAM_STRENGTH_FACTOR;
	if (
		Number.isNaN(LINEUP_TEAM_STRENGTH_FACTOR) ||
		LINEUP_TEAM_STRENGTH_FACTOR < 0
	) {
		return {
			ok: false,
			error: "LINEUP_TEAM_STRENGTH_FACTOR must be a non-negative number",
		};
	}

	const lineupTeamStrengthCapRaw = env.LINEUP_TEAM_STRENGTH_CAP?.trim();
	const LINEUP_TEAM_STRENGTH_CAP = lineupTeamStrengthCapRaw
		? Number.parseFloat(lineupTeamStrengthCapRaw)
		: DEFAULT_LINEUP_TEAM_STRENGTH_CAP;
	if (Number.isNaN(LINEUP_TEAM_STRENGTH_CAP) || LINEUP_TEAM_STRENGTH_CAP <= 0) {
		return {
			ok: false,
			error: "LINEUP_TEAM_STRENGTH_CAP must be a positive number",
		};
	}

	const reasoningLevelRaw =
		env.LLM_REASONING_LEVEL?.trim().toLowerCase() ?? DEFAULT_REASONING_LEVEL;
	const validReasoningLevels = new Set(["low", "medium", "high"]);
	if (!validReasoningLevels.has(reasoningLevelRaw)) {
		return {
			ok: false,
			error: "LLM_REASONING_LEVEL must be one of: low, medium, high",
		};
	}

	return {
		ok: true,
		value: {
			OPENAI_API_KEY,
			SUPABASE_DB_URL,
			SUPABASE_DB_SSL_NO_VERIFY: TRUE_VALUES.has(
				env.SUPABASE_DB_SSL_NO_VERIFY?.trim().toLowerCase() ?? "",
			),
			APP_ENV,
			SUPABASE_URL,
			SUPABASE_ANON_KEY,
			AUTH_ALLOWED_ORIGINS: effectiveAllowedOrigins,
			AUTH_JWT_ISSUER,
			AUTH_JWT_AUDIENCE,
			AUTH_BYPASS_ENABLED,
			AUTH_TURNSTILE_BYPASS,
			AUTH_TURNSTILE_SECRET,
			AUTH_IP_HASH_SALT,
			LLM_MODEL: env.LLM_MODEL?.trim() || DEFAULT_MODEL,
			LLM_REASONING_LEVEL: reasoningLevelRaw as "low" | "medium" | "high",
			SQL_QUERY_TIMEOUT_MS,
			SQL_CAPTURE_EXPLAIN_PLAN: TRUE_VALUES.has(
				env.SQL_CAPTURE_EXPLAIN_PLAN?.trim().toLowerCase() ?? "",
			),
			EXPOSE_ERROR_DETAILS: TRUE_VALUES.has(
				env.EXPOSE_ERROR_DETAILS?.trim().toLowerCase() ?? "",
			),
			LANGFUSE_PUBLIC_KEY: env.LANGFUSE_PUBLIC_KEY?.trim() || undefined,
			LANGFUSE_SECRET_KEY: env.LANGFUSE_SECRET_KEY?.trim() || undefined,
			LANGFUSE_BASE_URL: env.LANGFUSE_BASE_URL?.trim() || undefined,
			LANGFUSE_TRACING_ENVIRONMENT:
				env.LANGFUSE_TRACING_ENVIRONMENT?.trim() ||
				DEFAULT_LANGFUSE_TRACING_ENVIRONMENT,
			LANGFUSE_ENABLED: Boolean(
				env.LANGFUSE_PUBLIC_KEY?.trim() &&
					env.LANGFUSE_SECRET_KEY?.trim() &&
					env.LANGFUSE_BASE_URL?.trim(),
			),
			LINEUP_ENABLE_DUPR_BLEND:
				env.LINEUP_ENABLE_DUPR_BLEND == null
					? DEFAULT_LINEUP_ENABLE_DUPR_BLEND
					: TRUE_VALUES.has(env.LINEUP_ENABLE_DUPR_BLEND.trim().toLowerCase()),
			LINEUP_DUPR_MAJOR_WEIGHT,
			LINEUP_ENABLE_TEAM_STRENGTH_ADJUSTMENT:
				env.LINEUP_ENABLE_TEAM_STRENGTH_ADJUSTMENT == null
					? DEFAULT_LINEUP_ENABLE_TEAM_STRENGTH_ADJUSTMENT
					: TRUE_VALUES.has(
							env.LINEUP_ENABLE_TEAM_STRENGTH_ADJUSTMENT.trim().toLowerCase(),
						),
			LINEUP_DUPR_SLOPE,
			LINEUP_TEAM_STRENGTH_FACTOR,
			LINEUP_TEAM_STRENGTH_CAP,
		},
	};
};
