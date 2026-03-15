import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { AuthRepositoryEnv } from "../../worker/src/runtime/auth/repository.ts";

const AUTH_ENV_FILE_RELATIVE_PATH = join(".config", "dink-tank", "env");
const DEFAULT_SQL_QUERY_TIMEOUT_MS = 25_000;
const DEFAULT_INVITE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export interface AuthScriptEnv extends AuthRepositoryEnv {
	AUTH_INVITE_CODE_HASH_SECRET: string;
}

const resolveScriptDatabaseConfig = (
	env: Record<string, string | undefined>,
): { url: string; defaultSslNoVerify: boolean } => {
	const directUrl = env.SUPABASE_DB_URL?.trim();
	if (directUrl) {
		return {
			url: directUrl,
			defaultSslNoVerify: false,
		};
	}

	const hyperdriveLocalUrl =
		env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE?.trim();
	if (hyperdriveLocalUrl) {
		return {
			url: hyperdriveLocalUrl,
			defaultSslNoVerify: true,
		};
	}

	throw new Error(
		"Missing SUPABASE_DB_URL or CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE",
	);
};

const parseBooleanFlag = (value: string | undefined): boolean =>
	TRUE_VALUES.has(value?.trim().toLowerCase() ?? "");

const requireEnv = (
	env: Record<string, string | undefined>,
	key: keyof AuthScriptEnv,
): string => {
	const value = env[key]?.trim();
	if (!value) {
		throw new Error(`Missing ${key}`);
	}
	return value;
};

const mergeEnvSources = (
	fileEnv: Record<string, string>,
	env: NodeJS.ProcessEnv,
): Record<string, string | undefined> => {
	const merged: Record<string, string | undefined> = { ...fileEnv };
	for (const [key, value] of Object.entries(env)) {
		if (typeof value === "string" && value.trim().length > 0) {
			merged[key] = value;
		}
	}
	return merged;
};

const stripOuterQuotes = (value: string): string => {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}
	return value;
};

export const resolveAuthEnvFilePath = (
	env: NodeJS.ProcessEnv = process.env,
): string => {
	const homeDirectory = env.HOME?.trim();
	if (!homeDirectory) {
		throw new Error("Missing HOME");
	}
	return join(homeDirectory, AUTH_ENV_FILE_RELATIVE_PATH);
};

export const parseEnvFileContents = (
	contents: string,
): Record<string, string> => {
	const entries: Record<string, string> = {};
	for (const rawLine of contents.split(/\r?\n/)) {
		const trimmed = rawLine.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}
		const line = trimmed.startsWith("export ")
			? trimmed.slice("export ".length).trim()
			: trimmed;
		const separatorIndex = line.indexOf("=");
		if (separatorIndex <= 0) {
			continue;
		}
		const key = line.slice(0, separatorIndex).trim();
		const value = stripOuterQuotes(line.slice(separatorIndex + 1).trim());
		if (key) {
			entries[key] = value;
		}
	}
	return entries;
};

const readEnvFileContents = async (envFilePath: string): Promise<string> => {
	try {
		return await readFile(envFilePath, "utf8");
	} catch (error) {
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			error.code === "ENOENT"
		) {
			return "";
		}
		throw error;
	}
};

const upsertEnvAssignment = (
	currentContents: string,
	key: string,
	value: string,
): string => {
	const line = `${key}=${value}`;
	const pattern = new RegExp(`^(?:export\\s+)?${key}=.*$`, "m");
	if (pattern.test(currentContents)) {
		const replaced = currentContents.replace(pattern, line);
		return replaced.endsWith("\n") ? replaced : `${replaced}\n`;
	}
	const separator =
		currentContents.length > 0 && !currentContents.endsWith("\n") ? "\n" : "";
	return `${currentContents}${separator}${line}\n`;
};

const writeInviteSecretToEnvFile = async (
	envFilePath: string,
	currentContents: string,
	secret: string,
): Promise<void> => {
	await mkdir(dirname(envFilePath), { recursive: true });
	const nextContents = upsertEnvAssignment(
		currentContents,
		"AUTH_INVITE_CODE_HASH_SECRET",
		secret,
	);
	await writeFile(envFilePath, nextContents, "utf8");
	await chmod(envFilePath, 0o600);
};

export const resolveWorkerDevVarsPath = async (
	env: NodeJS.ProcessEnv = process.env,
	repoRoot: string = process.cwd(),
): Promise<string> => {
	const repoDevVarsPath = join(repoRoot, "worker", ".dev.vars");
	try {
		return await realpath(repoDevVarsPath);
	} catch (error) {
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			error.code === "ENOENT"
		) {
			const homeDirectory = env.HOME?.trim();
			if (!homeDirectory) {
				throw new Error("Missing HOME");
			}
			return join(homeDirectory, ".config", "dink-tank", "worker.dev.vars");
		}
		throw error;
	}
};

const syncInviteSecretToWorkerDevVars = async (
	workerDevVarsPath: string,
	secret: string,
): Promise<void> => {
	const currentContents = await readEnvFileContents(workerDevVarsPath);
	await mkdir(dirname(workerDevVarsPath), { recursive: true });
	const nextContents = upsertEnvAssignment(
		currentContents,
		"AUTH_INVITE_CODE_HASH_SECRET",
		secret,
	);
	await writeFile(workerDevVarsPath, nextContents, "utf8");
	await chmod(workerDevVarsPath, 0o600);
};

export interface LoadAuthScriptEnvOptions {
	env?: NodeJS.ProcessEnv;
	envFilePath?: string;
	workerDevVarsPath?: string;
	repoRoot?: string;
	generateSecret?: () => string;
}

export const loadAuthScriptEnv = async (
	options: LoadAuthScriptEnvOptions = {},
): Promise<AuthScriptEnv> => {
	const env = options.env ?? process.env;
	const envFilePath = options.envFilePath ?? resolveAuthEnvFilePath(env);
	const workerDevVarsPath =
		options.workerDevVarsPath ??
		(await resolveWorkerDevVarsPath(env, options.repoRoot));
	const envFileContents = await readEnvFileContents(envFilePath);
	const fileEnv = parseEnvFileContents(envFileContents);
	const fileSecret = fileEnv.AUTH_INVITE_CODE_HASH_SECRET?.trim();
	const processSecret = env.AUTH_INVITE_CODE_HASH_SECRET?.trim();
	const inviteHashSecret =
		fileSecret ||
		processSecret ||
		(options.generateSecret ?? (() => randomBytes(32).toString("hex")))();

	if (!fileSecret) {
		await writeInviteSecretToEnvFile(
			envFilePath,
			envFileContents,
			inviteHashSecret,
		);
		fileEnv.AUTH_INVITE_CODE_HASH_SECRET = inviteHashSecret;
	}
	await syncInviteSecretToWorkerDevVars(workerDevVarsPath, inviteHashSecret);

	const mergedEnv = mergeEnvSources(fileEnv, env);
	mergedEnv.AUTH_INVITE_CODE_HASH_SECRET = inviteHashSecret;
	const databaseConfig = resolveScriptDatabaseConfig(mergedEnv);
	const hasExplicitSslNoVerify =
		typeof mergedEnv.SUPABASE_DB_SSL_NO_VERIFY === "string" &&
		mergedEnv.SUPABASE_DB_SSL_NO_VERIFY.trim().length > 0;

	const timeoutRaw = mergedEnv.SQL_QUERY_TIMEOUT_MS?.trim();
	const queryTimeout = timeoutRaw
		? Number.parseInt(timeoutRaw, 10)
		: DEFAULT_SQL_QUERY_TIMEOUT_MS;
	if (Number.isNaN(queryTimeout) || queryTimeout <= 0) {
		throw new Error("SQL_QUERY_TIMEOUT_MS must be a positive integer");
	}

	return {
		SUPABASE_DB_URL: databaseConfig.url,
		SUPABASE_DB_SSL_NO_VERIFY: hasExplicitSslNoVerify
			? parseBooleanFlag(mergedEnv.SUPABASE_DB_SSL_NO_VERIFY)
			: databaseConfig.defaultSslNoVerify,
		SQL_QUERY_TIMEOUT_MS: queryTimeout,
		AUTH_INVITE_CODE_HASH_SECRET: inviteHashSecret,
	};
};

export const parseAuthScriptEnv = loadAuthScriptEnv;

export interface LoadWorkerDevProcessEnvOptions {
	env?: NodeJS.ProcessEnv;
	workerDevVarsPath?: string;
	repoRoot?: string;
}

export const loadWorkerDevProcessEnv = async (
	options: LoadWorkerDevProcessEnvOptions = {},
): Promise<NodeJS.ProcessEnv> => {
	const env = options.env ?? process.env;
	const workerDevVarsPath =
		options.workerDevVarsPath ??
		(await resolveWorkerDevVarsPath(env, options.repoRoot));
	const workerDevVarsContents = await readEnvFileContents(workerDevVarsPath);
	const workerDevFileEnv = parseEnvFileContents(workerDevVarsContents);
	return mergeEnvSources(workerDevFileEnv, env);
};

export const requireFlagValue = (args: string[], flagName: string): string => {
	const index = args.indexOf(flagName);
	const value = index >= 0 ? args[index + 1]?.trim() : "";
	if (!value) {
		throw new Error(`Missing required flag ${flagName}`);
	}
	return value;
};

export const parseFutureIsoDate = (value: string, flagName: string): Date => {
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		throw new Error(`${flagName} must be a valid ISO-8601 timestamp`);
	}
	if (parsed.getTime() <= Date.now()) {
		throw new Error(`${flagName} must be in the future`);
	}
	return parsed;
};

export const resolveInviteExpiration = (
	args: string[],
	nowMs: number = Date.now(),
): Date => {
	const index = args.indexOf("--expires-at");
	const value = index >= 0 ? args[index + 1]?.trim() : "";
	if (!value) {
		return new Date(nowMs + DEFAULT_INVITE_LIFETIME_MS);
	}
	return parseFutureIsoDate(value, "--expires-at");
};
