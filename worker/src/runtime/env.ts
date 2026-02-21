export interface WorkerEnv {
	OPENAI_API_KEY: string;
	SUPABASE_DB_URL: string;
	SUPABASE_DB_SSL_NO_VERIFY: boolean;
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
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

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
		},
	};
};
