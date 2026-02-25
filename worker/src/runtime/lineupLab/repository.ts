import { Pool } from "pg";

import type { WorkerEnv } from "../env";
import type {
	LineupLabDivisionOption,
	LineupLabFeatureBundle,
	LineupLabMatchupContextResponse,
	LineupLabMatchupOption,
	LineupLabRecommendRequest,
	LineupLabTeamOption,
} from "./types";

let cachedPool: Pool | null = null;
let cachedPoolUrl: string | null = null;
let cachedContextPool: Pool | null = null;
let cachedContextPoolUrl: string | null = null;
const TRANSIENT_RETRY_ATTEMPTS = 3;
const MIN_SUGGESTED_PLAYERS = 8;
const LINEUP_LAB_CONTEXT_QUERY_TIMEOUT_MS = 2_000;

interface RosterPlayerRow {
	player_id: string;
	first_name: string | null;
	last_name: string | null;
	gender: string | null;
	is_sub: boolean;
}

const sortRosterPlayers = <
	T extends {
		playerId: string;
		firstName: string | null;
		lastName: string | null;
		isSub: boolean;
	},
>(
	players: T[],
): T[] =>
	[...players].sort((left, right) => {
		if (left.isSub !== right.isSub) {
			return Number(left.isSub) - Number(right.isSub);
		}
		const lastNameCompare = (left.lastName ?? "").localeCompare(
			right.lastName ?? "",
		);
		if (lastNameCompare !== 0) {
			return lastNameCompare;
		}
		const firstNameCompare = (left.firstName ?? "").localeCompare(
			right.firstName ?? "",
		);
		if (firstNameCompare !== 0) {
			return firstNameCompare;
		}
		return left.playerId.localeCompare(right.playerId);
	});

export class LineupLabInputError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "LineupLabInputError";
	}
}

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

const getPool = (
	env: WorkerEnv,
	options?: { contextQueryTimeoutMs?: number },
): Pool => {
	const isContextPool = typeof options?.contextQueryTimeoutMs === "number";
	const effectiveQueryTimeoutMs = isContextPool
		? (options?.contextQueryTimeoutMs ?? LINEUP_LAB_CONTEXT_QUERY_TIMEOUT_MS)
		: env.SQL_QUERY_TIMEOUT_MS;
	const connectionString = resolveConnectionString(env);
	if (isContextPool) {
		if (cachedContextPool && cachedContextPoolUrl === connectionString) {
			return cachedContextPool;
		}
	} else if (cachedPool && cachedPoolUrl === connectionString) {
		return cachedPool;
	}

	const pool = new Pool({
		connectionString,
		ssl: env.SUPABASE_DB_SSL_NO_VERIFY
			? { rejectUnauthorized: false }
			: { rejectUnauthorized: true },
		max: 4,
		connectionTimeoutMillis: Math.min(10_000, effectiveQueryTimeoutMs),
		idleTimeoutMillis: 5_000,
		maxUses: 20,
		query_timeout: effectiveQueryTimeoutMs,
		allowExitOnIdle: true,
	});

	if (isContextPool) {
		cachedContextPool = pool;
		cachedContextPoolUrl = connectionString;
	} else {
		cachedPool = pool;
		cachedPoolUrl = connectionString;
	}

	return pool;
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

const resetCachedPool = async (options?: {
	contextQueryTimeoutMs?: number;
}): Promise<void> => {
	const isContextPool = typeof options?.contextQueryTimeoutMs === "number";
	if (isContextPool && !cachedContextPool) {
		return;
	}
	if (!isContextPool && !cachedPool) {
		return;
	}
	const existingPool = isContextPool ? cachedContextPool : cachedPool;
	if (isContextPool) {
		cachedContextPool = null;
		cachedContextPoolUrl = null;
	} else {
		cachedPool = null;
		cachedPoolUrl = null;
	}
	try {
		await existingPool?.end();
	} catch {
		// best-effort pool reset for transient connection issues
	}
};

const runWithPoolRetry = async <T>(
	env: WorkerEnv,
	operation: (pool: Pool) => Promise<T>,
	options?: { contextQueryTimeoutMs?: number },
): Promise<T> => {
	let lastError: unknown;
	for (let attempt = 1; attempt <= TRANSIENT_RETRY_ATTEMPTS; attempt += 1) {
		const pool = getPool(env, options);
		try {
			return await operation(pool);
		} catch (error) {
			lastError = error;
			if (!isTransientDbError(error) || attempt === TRANSIENT_RETRY_ATTEMPTS) {
				throw error;
			}
			await resetCachedPool(options);
			await sleep(100 * attempt);
		}
	}
	throw lastError;
};

const isUndefinedFeatureBundleFunctionError = (error: unknown): boolean => {
	const message =
		error instanceof Error
			? error.message.toLowerCase()
			: String(error).toLowerCase();
	const code =
		typeof error === "object" && error !== null && "code" in error
			? String((error as { code?: unknown }).code ?? "")
			: "";
	return (
		code === "42883" &&
		message.includes("fn_lineup_lab_feature_bundle") &&
		message.includes("does not exist")
	);
};

export const fetchLineupLabDivisions = async (
	env: WorkerEnv,
): Promise<LineupLabDivisionOption[]> => {
	const result = await runWithPoolRetry(
		env,
		(pool) =>
			pool.query<{
				division_id: string;
				division_name: string;
				season_year: number;
				season_number: number;
				location: string | null;
			}>(
				`select d.division_id, d.division_name, d.season_year, d.season_number, r.location
			 from public.divisions d
			 join public.regions r on r.region_id = d.region_id
			 where upper(replace(coalesce(r.location, ''), ' ', '')) = 'NJ/PA'
			 order by d.season_year desc, d.season_number desc, d.division_name asc`,
			),
		{ contextQueryTimeoutMs: LINEUP_LAB_CONTEXT_QUERY_TIMEOUT_MS },
	);

	return result.rows.map((row) => ({
		divisionId: row.division_id,
		divisionName: row.division_name,
		seasonYear: row.season_year,
		seasonNumber: row.season_number,
		location: row.location ?? "Unknown",
	}));
};

export const fetchLineupLabTeams = async (
	env: WorkerEnv,
	divisionId: string,
): Promise<LineupLabTeamOption[]> => {
	const result = await runWithPoolRetry(
		env,
		(pool) =>
			pool.query<{ team_id: string; team_name: string }>(
				`with team_sources as (
			   select t.team_id, t.team_name
			   from public.teams t
			   where t.division_id = $1::uuid
			   union
			   select m.home_team_id as team_id, m.home_name as team_name
			   from public.matchups m
			   where m.division_id = $1::uuid
			     and m.home_team_id is not null
			   union
			   select m.away_team_id as team_id, m.away_name as team_name
			   from public.matchups m
			   where m.division_id = $1::uuid
			     and m.away_team_id is not null
			 ),
			 normalized as (
			   select
			     team_id,
			     max(nullif(trim(team_name), '')) as team_name
			   from team_sources
			   group by team_id
			 )
			 select
			   n.team_id,
			   coalesce(n.team_name, t.team_name, 'Unknown Team') as team_name
			 from normalized n
			 left join public.teams t on t.team_id = n.team_id
			 order by coalesce(n.team_name, t.team_name, 'Unknown Team') asc`,
				[divisionId],
			),
		{ contextQueryTimeoutMs: LINEUP_LAB_CONTEXT_QUERY_TIMEOUT_MS },
	);

	return result.rows.map((row) => ({
		teamId: row.team_id,
		teamName: row.team_name,
	}));
};

export const fetchLineupLabMatchups = async (
	env: WorkerEnv,
	params: {
		divisionId: string;
		teamId: string;
		seasonYear: number;
		seasonNumber: number;
	},
): Promise<LineupLabMatchupContextResponse> => {
	const [matchups, rosterPlayers, opponentRosterPlayers] =
		await runWithPoolRetry(
			env,
			async (pool) => {
				const matchupRows = await pool.query<{
					matchup_id: string;
					week_number: number | null;
					scheduled_time: string | null;
					home_team_id: string | null;
					away_team_id: string | null;
					home_name: string | null;
					away_name: string | null;
				}>(
					`select matchup_id, week_number, scheduled_time, home_team_id, away_team_id, home_name, away_name
			 from public.matchups
			 where division_id = $1::uuid
			   and (home_team_id = $2::uuid or away_team_id = $2::uuid)
			 order by week_number asc nulls last, scheduled_time asc nulls last`,
					[params.divisionId, params.teamId],
				);

				const playerRows = await pool.query<RosterPlayerRow>(
					`select distinct on (pr.player_id)
			    pr.player_id,
			    p.first_name,
			    p.last_name,
			    p.gender,
			    coalesce(pr.is_sub, false) as is_sub
			 from public.player_rosters pr
			 left join public.players p on p.player_id = pr.player_id
			 where pr.division_id = $1::uuid
			   and pr.team_id = $2::uuid
			   and pr.season_year = $3
			   and pr.season_number = $4
			 order by pr.player_id asc, pr.snapshot_date desc, pr.updated_at desc`,
					[
						params.divisionId,
						params.teamId,
						params.seasonYear,
						params.seasonNumber,
					],
				);

				const opponentPlayerRows = await pool.query<{
					matchup_id: string;
					player_id: string;
					first_name: string | null;
					last_name: string | null;
					gender: string | null;
					is_sub: boolean;
				}>(
					`select distinct on (m.matchup_id, pr.player_id)
				    m.matchup_id,
				    pr.player_id,
				    p.first_name,
				    p.last_name,
				    p.gender,
				    coalesce(pr.is_sub, false) as is_sub
				 from public.matchups m
				 join public.player_rosters pr
				   on pr.division_id = m.division_id
				  and pr.season_year = $3
				  and pr.season_number = $4
				  and pr.team_id = case
				    when m.home_team_id = $2::uuid then m.away_team_id
				    else m.home_team_id
				  end
				 left join public.players p on p.player_id = pr.player_id
			 where m.division_id = $1::uuid
			   and (m.home_team_id = $2::uuid or m.away_team_id = $2::uuid)
				 order by m.matchup_id asc, pr.player_id asc, pr.snapshot_date desc, pr.updated_at desc`,
					[
						params.divisionId,
						params.teamId,
						params.seasonYear,
						params.seasonNumber,
					],
				);

				return [matchupRows, playerRows, opponentPlayerRows] as const;
			},
			{ contextQueryTimeoutMs: LINEUP_LAB_CONTEXT_QUERY_TIMEOUT_MS },
		);

	const opponentRosterByMatchupId = new Map<
		string,
		Array<{
			playerId: string;
			firstName: string | null;
			lastName: string | null;
			gender: string | null;
			isSub: boolean;
		}>
	>();
	for (const row of opponentRosterPlayers.rows) {
		const current = opponentRosterByMatchupId.get(row.matchup_id) ?? [];
		current.push({
			playerId: row.player_id,
			firstName: row.first_name,
			lastName: row.last_name,
			gender: row.gender,
			isSub: row.is_sub,
		});
		opponentRosterByMatchupId.set(row.matchup_id, current);
	}
	for (const [matchupId, players] of opponentRosterByMatchupId.entries()) {
		opponentRosterByMatchupId.set(matchupId, sortRosterPlayers(players));
	}

	const mappedMatchups: LineupLabMatchupOption[] = matchups.rows
		.filter((row) => row.home_team_id || row.away_team_id)
		.map((row) => {
			const teamIsHome = row.home_team_id === params.teamId;
			return {
				matchupId: row.matchup_id,
				weekNumber: row.week_number,
				scheduledTime: row.scheduled_time,
				teamId: params.teamId,
				oppTeamId: teamIsHome
					? (row.away_team_id ?? "")
					: (row.home_team_id ?? ""),
				teamName: teamIsHome
					? (row.home_name ?? "Team")
					: (row.away_name ?? "Team"),
				oppTeamName: teamIsHome
					? (row.away_name ?? "Opponent")
					: (row.home_name ?? "Opponent"),
				opponentRosterPlayers:
					opponentRosterByMatchupId.get(row.matchup_id) ?? [],
			};
		})
		.filter((row) => row.oppTeamId.length > 0);

	const sortedRosterPlayers = sortRosterPlayers(
		rosterPlayers.rows.map((row) => ({
			playerId: row.player_id,
			firstName: row.first_name,
			lastName: row.last_name,
			gender: row.gender,
			isSub: row.is_sub,
		})),
	);

	const selectedPlayerIds = new Set<string>();
	const suggestedAvailablePlayerIds: string[] = [];
	for (const player of sortedRosterPlayers) {
		if (player.isSub) {
			continue;
		}
		suggestedAvailablePlayerIds.push(player.playerId);
		selectedPlayerIds.add(player.playerId);
	}
	if (suggestedAvailablePlayerIds.length < MIN_SUGGESTED_PLAYERS) {
		for (const player of sortedRosterPlayers) {
			if (selectedPlayerIds.has(player.playerId)) {
				continue;
			}
			suggestedAvailablePlayerIds.push(player.playerId);
			selectedPlayerIds.add(player.playerId);
			if (suggestedAvailablePlayerIds.length >= MIN_SUGGESTED_PLAYERS) {
				break;
			}
		}
	}
	if (suggestedAvailablePlayerIds.length % 2 !== 0) {
		const fillPlayer = sortedRosterPlayers.find(
			(player) => !selectedPlayerIds.has(player.playerId),
		);
		if (fillPlayer) {
			suggestedAvailablePlayerIds.push(fillPlayer.playerId);
			selectedPlayerIds.add(fillPlayer.playerId);
		} else {
			suggestedAvailablePlayerIds.pop();
		}
	}

	const rosterWithSuggested = sortedRosterPlayers.map((player) => ({
		...player,
		suggested: selectedPlayerIds.has(player.playerId),
	}));

	return {
		matchups: mappedMatchups,
		availablePlayerIds: suggestedAvailablePlayerIds,
		suggestedAvailablePlayerIds,
		rosterPlayers: rosterWithSuggested,
	};
};

const asFeatureBundle = (payload: unknown): LineupLabFeatureBundle => {
	if (!payload || typeof payload !== "object") {
		return {
			candidate_pairs: [],
			opponent_scenarios: [],
			pair_matchups: [],
		};
	}

	const candidatePairs = Array.isArray(
		(payload as { candidate_pairs?: unknown }).candidate_pairs,
	)
		? ((
				payload as {
					candidate_pairs: LineupLabFeatureBundle["candidate_pairs"];
				}
			).candidate_pairs ?? [])
		: [];
	const opponentScenarios = Array.isArray(
		(payload as { opponent_scenarios?: unknown }).opponent_scenarios,
	)
		? ((
				payload as {
					opponent_scenarios: LineupLabFeatureBundle["opponent_scenarios"];
				}
			).opponent_scenarios ?? [])
		: [];
	const pairMatchups = Array.isArray(
		(payload as { pair_matchups?: unknown }).pair_matchups,
	)
		? ((payload as { pair_matchups: LineupLabFeatureBundle["pair_matchups"] })
				.pair_matchups ?? [])
		: [];

	return {
		generated_at:
			typeof (payload as { generated_at?: unknown }).generated_at === "string"
				? (payload as { generated_at: string }).generated_at
				: undefined,
		max_last_seen_at:
			typeof (payload as { max_last_seen_at?: unknown }).max_last_seen_at ===
				"string" ||
			(payload as { max_last_seen_at?: unknown }).max_last_seen_at === null
				? ((payload as { max_last_seen_at: string | null }).max_last_seen_at ??
					null)
				: null,
		data_staleness_hours:
			typeof (payload as { data_staleness_hours?: unknown })
				.data_staleness_hours === "number"
				? (payload as { data_staleness_hours: number }).data_staleness_hours
				: null,
		counts:
			typeof (payload as { counts?: unknown }).counts === "object"
				? ((payload as { counts?: Record<string, number> }).counts ?? {})
				: {},
		candidate_pairs: candidatePairs,
		opponent_scenarios: opponentScenarios,
		pair_matchups: pairMatchups,
		players_catalog: Array.isArray(
			(payload as { players_catalog?: unknown }).players_catalog,
		)
			? ((
					payload as {
						players_catalog: LineupLabFeatureBundle["players_catalog"];
					}
				).players_catalog ?? [])
			: [],
		team_strength:
			(payload as { team_strength?: unknown }).team_strength &&
			typeof (payload as { team_strength?: unknown }).team_strength === "object"
				? ((
						payload as {
							team_strength: LineupLabFeatureBundle["team_strength"];
						}
					).team_strength ?? null)
				: null,
	};
};

export const fetchLineupLabFeatureBundle = async (
	env: WorkerEnv,
	request: LineupLabRecommendRequest,
): Promise<LineupLabFeatureBundle> => {
	const knownOpponentPlayerIds = [
		...new Set(
			(request.opponentRounds ?? []).flatMap((round) =>
				round.games.flatMap((game) => [
					game.opponentPlayerAId,
					game.opponentPlayerBId,
				]),
			),
		),
	];

	const matchupResult = await runWithPoolRetry(env, (pool) =>
		pool.query<{
			matchup_id: string;
			division_id: string;
			week_number: number | null;
			scheduled_time: string | null;
			home_team_id: string | null;
			away_team_id: string | null;
		}>(
			`select
			    matchup_id,
			    division_id,
			    week_number,
			    scheduled_time,
			    home_team_id,
			    away_team_id
			 from public.matchups
			 where matchup_id = $1::uuid
			 limit 1`,
			[request.matchupId],
		),
	);

	const matchup = matchupResult.rows[0];
	if (!matchup) {
		throw new LineupLabInputError("matchupId was not found.");
	}
	if (matchup.division_id !== request.divisionId) {
		throw new LineupLabInputError(
			"matchupId does not belong to the selected division.",
		);
	}
	const validOrientation =
		(matchup.home_team_id === request.teamId &&
			matchup.away_team_id === request.oppTeamId) ||
		(matchup.away_team_id === request.teamId &&
			matchup.home_team_id === request.oppTeamId);
	if (!validOrientation) {
		throw new LineupLabInputError(
			"matchupId does not match the selected team/opponent pairing.",
		);
	}

	const result = await runWithPoolRetry(
		env,
		async (pool): Promise<{ rows: Array<{ payload: unknown }> }> => {
			const parameters = [
				request.divisionId,
				request.seasonYear,
				request.seasonNumber,
				request.teamId,
				request.oppTeamId,
				request.availablePlayerIds,
				request.scenarioLimit,
				request.matchupId,
				matchup.scheduled_time,
				knownOpponentPlayerIds,
			];

			try {
				return await pool.query<{ payload: unknown }>(
					`select analytics.fn_lineup_lab_feature_bundle(
						$1::uuid,
						$2::integer,
						$3::integer,
						$4::uuid,
						$5::uuid,
						$6::uuid[],
						$7::integer,
						$8::uuid,
						$9::timestamptz,
						$10::uuid[]
					) as payload`,
					parameters,
				);
			} catch (error) {
				if (!isUndefinedFeatureBundleFunctionError(error)) {
					throw error;
				}
				try {
					// Backward compatibility: allow pre-Phase-3 9-arg function until migration is applied.
					return await pool.query<{ payload: unknown }>(
						`select analytics.fn_lineup_lab_feature_bundle(
						$1::uuid,
						$2::integer,
						$3::integer,
						$4::uuid,
						$5::uuid,
						$6::uuid[],
						$7::integer,
						$8::uuid,
						$9::timestamptz
					) as payload`,
						parameters.slice(0, 9),
					);
				} catch (fallbackError) {
					if (!isUndefinedFeatureBundleFunctionError(fallbackError)) {
						throw fallbackError;
					}

					// Backward compatibility: allow old 7-arg function until migration is applied.
					return pool.query<{ payload: unknown }>(
						`select analytics.fn_lineup_lab_feature_bundle(
						$1::uuid,
						$2::integer,
						$3::integer,
						$4::uuid,
						$5::uuid,
						$6::uuid[],
						$7::integer
					) as payload`,
						parameters.slice(0, 7),
					);
				}
			}
		},
	);

	return asFeatureBundle(result.rows[0]?.payload ?? null);
};
