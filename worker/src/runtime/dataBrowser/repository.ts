import { Pool } from "pg";

import type { WorkerEnv } from "../env";
import type {
	DataBrowserDivisionOption,
	DataBrowserQueryLayout,
	DataBrowserQueryRequest,
	DataBrowserQueryResponse,
	DataBrowserSortDirection,
	DataBrowserDivisionScope,
	DataBrowserSeasonOption,
	DataBrowserTeamOption,
	DataBrowserTeamScope,
} from "./types";

let cachedContextPool: Pool | null = null;
let cachedContextPoolUrl: string | null = null;
const DATA_BROWSER_CONTEXT_QUERY_TIMEOUT_MS = 2_000;
const TRANSIENT_RETRY_ATTEMPTS = 3;
const NJ_PA_REGION_KEY = "NJ/PA";

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

const getContextPool = (env: WorkerEnv): Pool => {
	const connectionString = resolveConnectionString(env);
	if (cachedContextPool && cachedContextPoolUrl === connectionString) {
		return cachedContextPool;
	}

	const pool = new Pool({
		connectionString,
		ssl: env.SUPABASE_DB_SSL_NO_VERIFY
			? { rejectUnauthorized: false }
			: { rejectUnauthorized: true },
		max: 4,
		connectionTimeoutMillis: Math.min(
			10_000,
			DATA_BROWSER_CONTEXT_QUERY_TIMEOUT_MS,
		),
		idleTimeoutMillis: 5_000,
		maxUses: 20,
		query_timeout: DATA_BROWSER_CONTEXT_QUERY_TIMEOUT_MS,
		allowExitOnIdle: true,
	});

	cachedContextPool = pool;
	cachedContextPoolUrl = connectionString;

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

const resetCachedContextPool = async (): Promise<void> => {
	if (!cachedContextPool) {
		return;
	}

	const existingPool = cachedContextPool;
	cachedContextPool = null;
	cachedContextPoolUrl = null;

	try {
		await existingPool.end();
	} catch {
		// best-effort pool reset for transient connection issues
	}
};

const runWithContextPoolRetry = async <T>(
	env: WorkerEnv,
	operation: (pool: Pool) => Promise<T>,
): Promise<T> => {
	let lastError: unknown;
	for (let attempt = 1; attempt <= TRANSIENT_RETRY_ATTEMPTS; attempt += 1) {
		const pool = getContextPool(env);
		try {
			return await operation(pool);
		} catch (error) {
			lastError = error;
			if (!isTransientDbError(error) || attempt === TRANSIENT_RETRY_ATTEMPTS) {
				throw error;
			}
			await resetCachedContextPool();
			await sleep(100 * attempt);
		}
	}

	throw lastError;
};

const buildDataScopeFilter = (placeholderIndex: number): string =>
	`upper(replace(coalesce(r.location, ''), ' ', '')) = $${placeholderIndex}`;

const getOffset = (page: number, pageSize: number): number =>
	Math.max(0, (page - 1) * pageSize);

const parseCount = (value: number | string | null | undefined): number => {
	if (typeof value === "number") {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number.parseInt(value, 10);
		return Number.isNaN(parsed) ? 0 : parsed;
	}
	return 0;
};

const buildOrderBy = (
	sortKey: string | null,
	sortDirection: DataBrowserSortDirection | null,
	allowedSorts: Record<string, string>,
	fallbackSortKey: string,
): string => {
	const column = allowedSorts[sortKey ?? ""] ?? allowedSorts[fallbackSortKey];
	const direction = sortDirection === "desc" ? "desc" : "asc";
	return `${column} ${direction} nulls last`;
};

const buildTableResponse = (
	request: DataBrowserQueryRequest,
	title: string,
	leafLabel: string,
	payload: DataBrowserQueryResponse["payload"],
	totalRows: number,
	options?: {
		breadcrumb?: string[];
	},
): DataBrowserQueryResponse => ({
	queryId: crypto.randomUUID(),
	queryType: request.queryType,
	layout: "table",
	breadcrumb: options?.breadcrumb ?? [
		`${request.scope.seasonYear} S${request.scope.seasonNumber}`,
		request.scope.divisionName,
		leafLabel,
	],
	title,
	fetchedAt: new Date().toISOString(),
	page: request.viewState.page,
	pageSize: request.viewState.pageSize,
	totalRows,
	totalPages:
		totalRows > 0 ? Math.ceil(totalRows / request.viewState.pageSize) : 0,
	sortKey: request.viewState.sortKey,
	sortDirection: request.viewState.sortDirection,
	payload,
});

type PlayerStatsQueryRow = {
	total_rows: number | string;
	ranking: number | null;
	player_full_name: string;
	team_name: string | null;
	wins: number | null;
	losses: number | null;
	win_rate: string | number | null;
	dupr_rating: string | number | null;
};

const PLAYER_TABLE_COLUMNS = [
	{ key: "ranking", label: "Rank" },
	{ key: "playerName", label: "Player" },
	{ key: "teamName", label: "Team" },
	{ key: "record", label: "Record" },
	{ key: "winRate", label: "Win %" },
	{ key: "dupr", label: "DUPR" },
] satisfies DataBrowserQueryResponse["payload"] extends infer Payload
	? Payload extends { columns: infer Columns }
		? Columns
		: never
	: never;

const PLAYER_TABLE_SORTS = {
	ranking: "v.ranking",
	playerName: "v.player_full_name",
	teamName: "v.team_name",
	wins: "v.wins",
	losses: "v.losses",
	winRate: "v.win_rate",
	dupr: "v.dupr_rating",
} satisfies Record<string, string>;

const buildPlayerTableRows = (
	rows: PlayerStatsQueryRow[],
): Record<string, string | number | boolean | null>[] =>
	rows.map((row) => ({
		ranking: row.ranking,
		playerName: row.player_full_name,
		teamName: row.team_name,
		record: `${row.wins ?? 0}-${row.losses ?? 0}`,
		winRate:
			row.win_rate === null || row.win_rate === undefined
				? null
				: String(row.win_rate),
		dupr:
			row.dupr_rating === null || row.dupr_rating === undefined
				? null
				: String(row.dupr_rating),
	}));

const fetchPlayersTableQuery = async (
	env: WorkerEnv,
	request: DataBrowserQueryRequest,
	options: {
		title: string;
		leafLabel: string;
		teamId?: string | null;
	},
): Promise<DataBrowserQueryResponse> => {
	const orderBy = buildOrderBy(
		request.viewState.sortKey,
		request.viewState.sortDirection,
		PLAYER_TABLE_SORTS,
		"ranking",
	);
	const pageSize = request.viewState.pageSize;
	const offset = getOffset(request.viewState.page, pageSize);
	const teamId = options.teamId ?? null;
	const teamCteClause = teamId
		? `,
			 selected_team as (
			   select coalesce(ts.team_name, t.team_name) as team_name
			   from public.teams t
			   left join public.team_seasons ts
			     on ts.team_id = t.team_id
			    and ts.division_id = t.division_id
			    and ts.season_year = $2
			    and ts.season_number = $3
			   where t.team_id = $5::uuid
			     and t.division_id = $1::uuid
			   limit 1
			 )`
		: "";
	const teamJoinClause = teamId
		? "\n\t\t\t join selected_team st on st.team_name = v.team_name"
		: "";
	const limitPlaceholder = teamId ? "$6" : "$5";
	const offsetPlaceholder = teamId ? "$7" : "$6";
	const params = teamId
		? [
				request.scope.divisionId,
				request.scope.seasonYear,
				request.scope.seasonNumber,
				NJ_PA_REGION_KEY,
				teamId,
				pageSize,
				offset,
			]
		: [
				request.scope.divisionId,
				request.scope.seasonYear,
				request.scope.seasonNumber,
				NJ_PA_REGION_KEY,
				pageSize,
				offset,
			];
	const result = await runWithContextPoolRetry(env, (pool) =>
		pool.query<PlayerStatsQueryRow>(
			`with scoped_division as (
			   select d.division_name, d.season_year, d.season_number
			   from public.divisions d
			   join public.regions r on r.region_id = d.region_id
			   where d.division_id = $1::uuid
			     and d.season_year = $2
			     and d.season_number = $3
			     and ${buildDataScopeFilter(4)}
			 )${teamCteClause}
			 select
			   count(*) over() as total_rows,
			   v.ranking,
			   v.player_full_name,
			   v.team_name,
			   v.wins,
			   v.losses,
			   v.win_rate,
			   v.dupr_rating
			 from public.vw_player_stats_per_season v
			 join scoped_division sd
			   on sd.division_name = v.division_name
			  and sd.season_year = v.season_year
			  and sd.season_number = v.season_number${teamJoinClause}
			 order by ${orderBy}
			 limit ${limitPlaceholder}
			 offset ${offsetPlaceholder}`,
			params,
		),
	);
	const totalRows = parseCount(result.rows[0]?.total_rows);
	const breadcrumb = teamId
		? [
				`${request.scope.seasonYear} S${request.scope.seasonNumber}`,
				request.scope.divisionName,
				request.scope.teamName ?? "",
				options.leafLabel,
			]
		: undefined;

	return buildTableResponse(
		request,
		options.title,
		options.leafLabel,
		{
			columns: PLAYER_TABLE_COLUMNS,
			rows: buildPlayerTableRows(result.rows),
		},
		totalRows,
		breadcrumb ? { breadcrumb } : undefined,
	);
};

export const fetchDataBrowserSeasons = async (
	env: WorkerEnv,
): Promise<DataBrowserSeasonOption[]> => {
	const result = await runWithContextPoolRetry(env, (pool) =>
		pool.query<{
			season_year: number;
			season_number: number;
		}>(
			`select distinct d.season_year, d.season_number
			 from public.divisions d
			 join public.regions r on r.region_id = d.region_id
			 where ${buildDataScopeFilter(1)}
			 order by d.season_year desc, d.season_number desc`,
			[NJ_PA_REGION_KEY],
		),
	);

	return result.rows.map((row) => ({
		seasonYear: row.season_year,
		seasonNumber: row.season_number,
		label: `${row.season_year} S${row.season_number}`,
	}));
};

export const fetchDataBrowserDivisions = async (
	env: WorkerEnv,
	scope: DataBrowserDivisionScope,
): Promise<DataBrowserDivisionOption[]> => {
	const result = await runWithContextPoolRetry(env, (pool) =>
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
			 where ${buildDataScopeFilter(1)}
			   and d.season_year = $2
			   and d.season_number = $3
			 order by d.division_name asc`,
			[NJ_PA_REGION_KEY, scope.seasonYear, scope.seasonNumber],
		),
	);

	return result.rows.map((row) => ({
		divisionId: row.division_id,
		divisionName: row.division_name,
		seasonYear: row.season_year,
		seasonNumber: row.season_number,
		location: row.location ?? "Unknown",
	}));
};

export const fetchDataBrowserTeams = async (
	env: WorkerEnv,
	scope: DataBrowserTeamScope,
): Promise<DataBrowserTeamOption[]> => {
	const result = await runWithContextPoolRetry(env, (pool) =>
		pool.query<{ team_id: string; team_name: string }>(
			`with scoped_division as (
			   select d.division_id
			   from public.divisions d
			   join public.regions r on r.region_id = d.region_id
			   where d.division_id = $1::uuid
			     and d.season_year = $2
			     and d.season_number = $3
			     and ${buildDataScopeFilter(4)}
			 ),
			 team_sources as (
			   select t.team_id, t.team_name
			   from public.teams t
			   join scoped_division sd on sd.division_id = t.division_id
			   union
			   select m.home_team_id as team_id, m.home_name as team_name
			   from public.matchups m
			   join scoped_division sd on sd.division_id = m.division_id
			   where m.home_team_id is not null
			   union
			   select m.away_team_id as team_id, m.away_name as team_name
			   from public.matchups m
			   join scoped_division sd on sd.division_id = m.division_id
			   where m.away_team_id is not null
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
			[
				scope.divisionId,
				scope.seasonYear,
				scope.seasonNumber,
				NJ_PA_REGION_KEY,
			],
		),
	);

	return result.rows.map((row) => ({
		teamId: row.team_id,
		teamName: row.team_name,
	}));
};

const getQueryLayout = (
	queryType: DataBrowserQueryRequest["queryType"],
): DataBrowserQueryLayout => {
	if (queryType === "team_overview") {
		return "summary";
	}
	if (queryType === "team_schedule") {
		return "schedule";
	}
	return "table";
};

const getQueryTitle = (
	queryType: DataBrowserQueryRequest["queryType"],
): string => {
	switch (queryType) {
		case "division_players":
			return "Division Players";
		case "division_standings":
			return "Division Standings";
		case "team_overview":
			return "Team Overview";
		case "team_players":
			return "Team Players";
		case "team_schedule":
			return "Team Schedule";
	}
};

const getQueryLeafLabel = (
	queryType: DataBrowserQueryRequest["queryType"],
): string => {
	switch (queryType) {
		case "division_players":
		case "team_players":
			return "Players";
		case "division_standings":
			return "Standings";
		case "team_overview":
			return "Overview";
		case "team_schedule":
			return "Schedule";
	}
};

const buildDefaultQueryResponse = (
	request: DataBrowserQueryRequest,
): DataBrowserQueryResponse => ({
	queryId: crypto.randomUUID(),
	queryType: request.queryType,
	layout: getQueryLayout(request.queryType),
	breadcrumb: [
		`${request.scope.seasonYear} S${request.scope.seasonNumber}`,
		request.scope.divisionName,
		...(request.scope.teamName ? [request.scope.teamName] : []),
		getQueryLeafLabel(request.queryType),
	],
	title: getQueryTitle(request.queryType),
	fetchedAt: new Date().toISOString(),
	page: request.viewState.page,
	pageSize: request.viewState.pageSize,
	totalRows: 0,
	totalPages: 0,
	sortKey: request.viewState.sortKey,
	sortDirection: request.viewState.sortDirection,
	payload:
		getQueryLayout(request.queryType) === "table"
			? {
					columns: [],
					rows: [],
				}
			: {},
});

export const fetchDivisionPlayersQuery = async (
	env: WorkerEnv,
	request: DataBrowserQueryRequest,
): Promise<DataBrowserQueryResponse> =>
	fetchPlayersTableQuery(env, request, {
		title: "Division Players",
		leafLabel: "Players",
	});

export const fetchDivisionStandingsQuery = async (
	env: WorkerEnv,
	request: DataBrowserQueryRequest,
): Promise<DataBrowserQueryResponse> => {
	const orderBy = buildOrderBy(
		request.viewState.sortKey,
		request.viewState.sortDirection,
		{
			ranking: "v.ranking",
			teamName: "v.team_name",
			record: "v.record",
			winPercentage: "v.win_percentage",
			podName: "v.pod_name",
			pointDiff: "v.team_point_diff",
		},
		"ranking",
	);
	const pageSize = request.viewState.pageSize;
	const offset = getOffset(request.viewState.page, pageSize);
	const result = await runWithContextPoolRetry(env, (pool) =>
		pool.query<{
			total_rows: number | string;
			ranking: number | null;
			team_name: string;
			record: string | null;
			win_percentage: string | number | null;
			pod_name: string | null;
			team_point_diff: number | null;
		}>(
			`with scoped_division as (
			   select d.division_name, d.season_year, d.season_number
			   from public.divisions d
			   join public.regions r on r.region_id = d.region_id
			   where d.division_id = $1::uuid
			     and d.season_year = $2
			     and d.season_number = $3
			     and ${buildDataScopeFilter(4)}
			 )
			 select
			   count(*) over() as total_rows,
			   v.ranking,
			   v.team_name,
			   v.record,
			   v.win_percentage,
			   v.pod_name,
			   v.team_point_diff
			 from public.vw_team_standings v
			 join scoped_division sd
			   on sd.division_name = v.division_name
			  and sd.season_year = v.season_year
			  and sd.season_number = v.season_number
			 order by ${orderBy}
			 limit $5
			 offset $6`,
			[
				request.scope.divisionId,
				request.scope.seasonYear,
				request.scope.seasonNumber,
				NJ_PA_REGION_KEY,
				pageSize,
				offset,
			],
		),
	);
	const totalRows = parseCount(result.rows[0]?.total_rows);

	return buildTableResponse(
		request,
		"Division Standings",
		"Standings",
		{
			columns: [
				{ key: "ranking", label: "Rank" },
				{ key: "teamName", label: "Team" },
				{ key: "record", label: "Record" },
				{ key: "winPercentage", label: "Win %" },
				{ key: "podName", label: "Pod" },
				{ key: "pointDiff", label: "Point Diff" },
			],
			rows: result.rows.map((row) => ({
				ranking: row.ranking,
				teamName: row.team_name,
				record: row.record,
				winPercentage:
					row.win_percentage === null || row.win_percentage === undefined
						? null
						: String(row.win_percentage),
				podName: row.pod_name,
				pointDiff: row.team_point_diff,
			})),
		},
		totalRows,
	);
};

export const fetchTeamOverviewQuery = async (
	_env: WorkerEnv,
	request: DataBrowserQueryRequest,
): Promise<DataBrowserQueryResponse> => buildDefaultQueryResponse(request);

export const fetchTeamPlayersQuery = async (
	env: WorkerEnv,
	request: DataBrowserQueryRequest,
): Promise<DataBrowserQueryResponse> =>
	fetchPlayersTableQuery(env, request, {
		title: "Team Players",
		leafLabel: "Players",
		teamId: request.scope.teamId,
	});

export const fetchTeamScheduleQuery = async (
	_env: WorkerEnv,
	request: DataBrowserQueryRequest,
): Promise<DataBrowserQueryResponse> => buildDefaultQueryResponse(request);
