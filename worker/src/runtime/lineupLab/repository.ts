import { Pool } from "pg";

import type { WorkerEnv } from "../env";
import type { LineupLabFeatureBundle, LineupLabRecommendRequest } from "./types";

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
		maxUses: 20,
		query_timeout: env.SQL_QUERY_TIMEOUT_MS,
		allowExitOnIdle: true,
	});
	cachedPoolUrl = connectionString;
	return cachedPool;
};

const asFeatureBundle = (payload: unknown): LineupLabFeatureBundle => {
	if (!payload || typeof payload !== "object") {
		return {
			candidate_pairs: [],
			opponent_scenarios: [],
			pair_matchups: [],
		};
	}

	const candidatePairs = Array.isArray((payload as { candidate_pairs?: unknown }).candidate_pairs)
		? ((payload as { candidate_pairs: LineupLabFeatureBundle["candidate_pairs"] }).candidate_pairs ?? [])
		: [];
	const opponentScenarios = Array.isArray(
		(payload as { opponent_scenarios?: unknown }).opponent_scenarios,
	)
		? ((payload as { opponent_scenarios: LineupLabFeatureBundle["opponent_scenarios"] })
				.opponent_scenarios ?? [])
		: [];
	const pairMatchups = Array.isArray((payload as { pair_matchups?: unknown }).pair_matchups)
		? ((payload as { pair_matchups: LineupLabFeatureBundle["pair_matchups"] }).pair_matchups ?? [])
		: [];

	return {
		counts:
			typeof (payload as { counts?: unknown }).counts === "object"
				? ((payload as { counts?: Record<string, number> }).counts ?? {})
				: {},
		candidate_pairs: candidatePairs,
		opponent_scenarios: opponentScenarios,
		pair_matchups: pairMatchups,
	};
};

export const fetchLineupLabFeatureBundle = async (
	env: WorkerEnv,
	request: LineupLabRecommendRequest,
): Promise<LineupLabFeatureBundle> => {
	const pool = getPool(env);
	const result = await pool.query<{ payload: unknown }>(
		`select analytics.fn_lineup_lab_feature_bundle($1, $2, $3, $4, $5, $6::uuid[], $7) as payload`,
		[
			request.divisionId,
			request.seasonYear,
			request.seasonNumber,
			request.teamId,
			request.oppTeamId,
			request.availablePlayerIds,
			request.scenarioLimit,
		],
	);

	return asFeatureBundle(result.rows[0]?.payload ?? null);
};
