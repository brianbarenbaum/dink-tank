export interface WorkerEnv {
	OPENAI_API_KEY: string;
	SUPABASE_DB_URL: string;
	SUPABASE_DB_SSL_NO_VERIFY: boolean;
	LLM_MODEL: string;
	SQL_QUERY_TIMEOUT_MS: number;
	EXPOSE_ERROR_DETAILS: boolean;
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
const DEFAULT_SQL_TIMEOUT_MS = 10_000;
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

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

	return {
		ok: true,
		value: {
			OPENAI_API_KEY,
			SUPABASE_DB_URL,
			SUPABASE_DB_SSL_NO_VERIFY: TRUE_VALUES.has(
				env.SUPABASE_DB_SSL_NO_VERIFY?.trim().toLowerCase() ?? "",
			),
			LLM_MODEL: env.LLM_MODEL?.trim() || DEFAULT_MODEL,
			SQL_QUERY_TIMEOUT_MS,
			EXPOSE_ERROR_DETAILS: TRUE_VALUES.has(
				env.EXPOSE_ERROR_DETAILS?.trim().toLowerCase() ?? "",
			),
		},
	};
};
