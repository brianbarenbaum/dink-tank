import { createHash } from "node:crypto";

export type SyncMode = "bootstrap" | "weekly";
export type IngestPhase =
	| "all"
	| "players"
	| "standings"
	| "teams"
	| "matchups"
	| "playoff-matchups"
	| "details";

export type EndpointName =
	| "players"
	| "standings"
	| "teams"
	| "matchups"
	| "playoff-matchups"
	| "details";

export interface CheckpointKeyInput {
	divisionId: string;
	endpointName: EndpointName;
	seasonYear: number;
	seasonNumber: number;
}

export interface RegionDivision {
	regionId: string;
	regionLocation?: string;
	divisionId: string;
	divisionName: string;
	seasonNumber: number;
	seasonYear: number;
}

export interface DetailMatchupCandidate {
	matchupId: string;
	scheduledTime?: string | null;
	homeTeamId?: string | null;
	awayTeamId?: string | null;
}

export interface IngestConfig {
	supabaseUrl?: string;
	supabaseServiceRoleKey?: string;
	apiBaseUrl?: string;
	lat?: string;
	lng?: string;
	chunkSize?: number;
	delayMs?: number;
	weeklyWindowDays?: number;
	mode?: SyncMode;
	phase?: IngestPhase;
	dryRun?: boolean;
	strictDependencyGuard?: boolean;
	retryAttempts?: number;
	retryBaseDelayMs?: number;
	retryJitterRatio?: number;
	regionLocationFilter?: string;
	divisionNameFilter?: string;
}

interface RegionApiRecord {
	regionId: string;
	location: string;
	latitude?: number;
	longitude?: number;
	active?: boolean;
	divisions?: RegionDivisionCollection | RegionDivisionApiRecord[];
}

interface RegionDivisionCollection {
	$values?: RegionDivisionApiRecord[];
}

interface RegionDivisionApiRecord {
	divisionId: string;
	regionId: string;
	divisionName: string;
	seasonNumber: number;
	seasonYear: number;
}

interface SupabaseUpsertOptions {
	onConflict?: string;
}

interface SupabaseInsertOptions {
	returning?: "minimal" | "representation";
}

type PostgrestSchema = "public" | "analytics";

const DEFAULT_API_BASE =
	"https://cplsecureapiproxy.azurewebsites.net/api/CPLSecureApiProxy/v0/api";

const WEEKLY_ENDPOINTS: EndpointName[] = [
	"matchups",
	"playoff-matchups",
	"standings",
];
const BOOTSTRAP_ENDPOINTS: EndpointName[] = [
	"players",
	"standings",
	"teams",
	"matchups",
	"playoff-matchups",
];

const PHASE_TO_ENDPOINT: Record<Exclude<IngestPhase, "all">, EndpointName[]> = {
	players: ["players"],
	standings: ["standings"],
	teams: ["teams"],
	matchups: ["matchups"],
	"playoff-matchups": ["playoff-matchups"],
	details: ["details"],
};

const DETAIL_PREREQUISITES: EndpointName[] = [
	"players",
	"teams",
	"matchups",
	"playoff-matchups",
];

const delay = async (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});

export const parseJsonResponseSafely = async (
	response: Response,
): Promise<unknown | null> => {
	if (response.status === 204) {
		return null;
	}

	const contentLength = response.headers.get("content-length");
	if (contentLength === "0") {
		return null;
	}

	const raw = await response.text();
	if (!raw.trim()) {
		return null;
	}

	return JSON.parse(raw);
};

const toObject = (value: unknown): Record<string, unknown> => {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
};

const valueAsString = (value: unknown): string | null =>
	typeof value === "string" ? value : null;

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

export const sanitizeTeamForeignKey = (value: unknown): string | null => {
	const raw = valueAsString(value)?.trim();
	if (!raw) {
		return null;
	}
	return raw.toLowerCase() === ZERO_UUID ? null : raw;
};

const valueAsNumber = (value: unknown): number | null => {
	if (typeof value === "number") {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

export const denormalizeDotNetJson = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value.map((item) => denormalizeDotNetJson(item));
	}

	if (value && typeof value === "object") {
		const objectValue = value as Record<string, unknown>;
		if (Array.isArray(objectValue.$values)) {
			return objectValue.$values.map((item) => denormalizeDotNetJson(item));
		}

		const output: Record<string, unknown> = {};
		for (const [key, nested] of Object.entries(objectValue)) {
			if (key === "$id") {
				continue;
			}
			output[key] = denormalizeDotNetJson(nested);
		}
		return output;
	}

	return value;
};

const toArray = <T>(payload: unknown): T[] => {
	const clean = denormalizeDotNetJson(payload);
	return Array.isArray(clean) ? (clean as T[]) : [];
};

const toArrayFlexible = <T>(payload: unknown): T[] => {
	if (Array.isArray(payload)) {
		return payload as T[];
	}
	if (payload && typeof payload === "object") {
		const values = (payload as { $values?: unknown }).$values;
		if (Array.isArray(values)) {
			return values as T[];
		}
	}
	return [];
};

interface LineupNormalizationInput {
	detailObject: Record<string, unknown>;
	matchupId: string;
	homeTeamId?: string | null;
	awayTeamId?: string | null;
	snapshotDate: string;
}

interface LineupNormalizationOutput {
	lineups: Record<string, unknown>[];
	slots: Record<string, unknown>[];
}

const extractRawLineupsFromDetail = (
	detailObject: Record<string, unknown>,
): Record<string, unknown>[] => {
	const rootLineups = detailObject.lineups;
	if (Array.isArray(rootLineups)) {
		return rootLineups as Record<string, unknown>[];
	}
	const lineupsObject = toObject(rootLineups);
	if (Array.isArray(lineupsObject.lineups)) {
		return lineupsObject.lineups as Record<string, unknown>[];
	}
	const nested = toObject(lineupsObject.lineups);
	return toArrayFlexible<Record<string, unknown>>(nested);
};

export const normalizeLineupsFromDetail = (
	input: LineupNormalizationInput,
): LineupNormalizationOutput => {
	const rawLineups = extractRawLineupsFromDetail(input.detailObject);
	if (!rawLineups.length) {
		return { lineups: [], slots: [] };
	}

	const hasTeamLineupShape = rawLineups.some(
		(lineup) => sanitizeTeamForeignKey(lineup.teamId) !== null,
	);

	if (hasTeamLineupShape) {
		const lineups = rawLineups
			.map((lineup) => {
				const teamId = sanitizeTeamForeignKey(lineup.teamId);
				if (!teamId) {
					return null;
				}
				const lineupId =
					valueAsString(lineup.lineupId) ??
					deterministicUuidFromSeed(
						`${input.matchupId}:${teamId}:${input.snapshotDate}`,
					);
				return {
					lineup_id: lineupId,
					matchup_id: input.matchupId,
					team_id: teamId,
					submitted_at:
						valueAsString(lineup.submittedAt) ??
						valueAsString(lineup.updatedAt) ??
						null,
					locked: Boolean(lineup.locked ?? lineup.isLocked ?? false),
					raw_json: lineup,
					snapshot_date: input.snapshotDate,
				};
			})
			.filter((lineup) => lineup !== null);

		const slots: Record<string, unknown>[] = [];
		for (const lineup of rawLineups) {
			const teamId = sanitizeTeamForeignKey(lineup.teamId);
			if (!teamId) {
				continue;
			}
			const lineupId =
				valueAsString(lineup.lineupId) ??
				deterministicUuidFromSeed(
					`${input.matchupId}:${teamId}:${input.snapshotDate}`,
				);
			const lineupSlots = Array.isArray(lineup.lineupSlots)
				? (lineup.lineupSlots as Record<string, unknown>[])
				: [];
			for (let index = 0; index < lineupSlots.length; index += 1) {
				const slot = lineupSlots[index] ?? {};
				slots.push({
					lineup_id: lineupId,
					slot_no: valueAsNumber(slot.slotNo) ?? index + 1,
					player_id: valueAsString(slot.playerId),
					partner_player_id:
						valueAsString(slot.partnerPlayerId) ??
						valueAsString(slot.partnerId),
					court_no:
						valueAsNumber(slot.courtNo) ?? valueAsNumber(slot.courtNumber),
					role: valueAsString(slot.role),
					raw_json: slot,
				});
			}
		}

		return {
			lineups: uniqueByCompositeKey(lineups, [
				"matchup_id",
				"team_id",
				"snapshot_date",
			]),
			slots: uniqueByCompositeKey(slots, ["lineup_id", "slot_no"]),
		};
	}

	const homeTeamId = sanitizeTeamForeignKey(
		input.homeTeamId ?? input.detailObject.homeTeamId,
	);
	const awayTeamId = sanitizeTeamForeignKey(
		input.awayTeamId ?? input.detailObject.awayTeamId,
	);

	const lineups: Record<string, unknown>[] = [];
	if (homeTeamId) {
		lineups.push({
			lineup_id: deterministicUuidFromSeed(
				`${input.matchupId}:home:${homeTeamId}:${input.snapshotDate}`,
			),
			matchup_id: input.matchupId,
			team_id: homeTeamId,
			submitted_at: null,
			locked: false,
			raw_json: input.detailObject.lineups ?? null,
			snapshot_date: input.snapshotDate,
		});
	}
	if (awayTeamId) {
		lineups.push({
			lineup_id: deterministicUuidFromSeed(
				`${input.matchupId}:away:${awayTeamId}:${input.snapshotDate}`,
			),
			matchup_id: input.matchupId,
			team_id: awayTeamId,
			submitted_at: null,
			locked: false,
			raw_json: input.detailObject.lineups ?? null,
			snapshot_date: input.snapshotDate,
		});
	}

	const slots: Record<string, unknown>[] = [];
	for (let index = 0; index < rawLineups.length; index += 1) {
		const game = rawLineups[index] ?? {};
		const gameNumber = valueAsNumber(game.gameNumber) ?? index;
		const awayLineupId = awayTeamId
			? deterministicUuidFromSeed(
					`${input.matchupId}:away:${awayTeamId}:${input.snapshotDate}`,
				)
			: null;
		const homeLineupId = homeTeamId
			? deterministicUuidFromSeed(
					`${input.matchupId}:home:${homeTeamId}:${input.snapshotDate}`,
				)
			: null;

		const awayPlayers = [
			valueAsString(game.awayPlayerId1),
			valueAsString(game.awayPlayerId2),
		].filter((playerId) => playerId) as string[];
		const homePlayers = [
			valueAsString(game.homePlayerId1),
			valueAsString(game.homePlayerId2),
		].filter((playerId) => playerId) as string[];

		if (awayLineupId) {
			for (let awayIndex = 0; awayIndex < awayPlayers.length; awayIndex += 1) {
				slots.push({
					lineup_id: awayLineupId,
					slot_no: gameNumber * 2 + awayIndex + 1,
					player_id: awayPlayers[awayIndex],
					partner_player_id: null,
					court_no: null,
					role: "away",
					raw_json: game,
				});
			}
		}
		if (homeLineupId) {
			for (let homeIndex = 0; homeIndex < homePlayers.length; homeIndex += 1) {
				slots.push({
					lineup_id: homeLineupId,
					slot_no: gameNumber * 2 + homeIndex + 1,
					player_id: homePlayers[homeIndex],
					partner_player_id: null,
					court_no: null,
					role: "home",
					raw_json: game,
				});
			}
		}
	}

	return {
		lineups: uniqueByCompositeKey(lineups, [
			"matchup_id",
			"team_id",
			"snapshot_date",
		]),
		slots: uniqueByCompositeKey(slots, ["lineup_id", "slot_no"]),
	};
};

interface DivisionFilterInput {
	regionLocationFilter?: string;
	divisionNameFilter?: string;
}

export const extractDivisionsFromRegions = (
	regions: RegionApiRecord[],
	filter: DivisionFilterInput = {},
): RegionDivision[] => {
	const regionLocationFilter = filter.regionLocationFilter
		?.trim()
		.toLowerCase();
	const divisionNameFilter = filter.divisionNameFilter?.trim().toLowerCase();
	const divisions: RegionDivision[] = [];

	for (const region of regions) {
		const regionLocation = region.location ?? "";
		if (
			regionLocationFilter &&
			regionLocation.trim().toLowerCase() !== regionLocationFilter
		) {
			continue;
		}

		const divisionItems = toArrayFlexible<RegionDivisionApiRecord>(
			region.divisions,
		);
		for (const division of divisionItems) {
			if (
				divisionNameFilter &&
				division.divisionName.trim().toLowerCase() !== divisionNameFilter
			) {
				continue;
			}
			divisions.push({
				regionId: division.regionId,
				regionLocation,
				divisionId: division.divisionId,
				divisionName: division.divisionName,
				seasonNumber: division.seasonNumber,
				seasonYear: division.seasonYear,
			});
		}
	}

	return divisions;
};

export const createCheckpointKey = (input: CheckpointKeyInput): string =>
	`crossclub:${input.seasonYear}:s${input.seasonNumber}:${input.divisionId}:${input.endpointName}`;

export const buildDivisionChunks = (
	divisionIds: string[],
	chunkSize: number,
): string[][] => {
	const safeChunkSize = Math.max(1, chunkSize);
	const chunks: string[][] = [];
	for (let idx = 0; idx < divisionIds.length; idx += safeChunkSize) {
		chunks.push(divisionIds.slice(idx, idx + safeChunkSize));
	}
	return chunks;
};

export const planEndpointWork = (
	mode: SyncMode,
	phase: IngestPhase = "all",
): EndpointName[] => {
	if (phase !== "all") {
		return PHASE_TO_ENDPOINT[phase];
	}
	return mode === "weekly" ? WEEKLY_ENDPOINTS : BOOTSTRAP_ENDPOINTS;
};

export const deterministicUuidFromSeed = (seed: string): string => {
	const hash = createHash("sha1")
		.update(seed)
		.digest("hex")
		.slice(0, 32)
		.split("");
	hash[12] = "4";
	const variant = Number.parseInt(hash[16] ?? "8", 16);
	hash[16] = (8 + (variant % 4)).toString(16);
	return `${hash.slice(0, 8).join("")}-${hash.slice(8, 12).join("")}-${hash.slice(12, 16).join("")}-${hash.slice(16, 20).join("")}-${hash.slice(20, 32).join("")}`;
};

export const selectDetailMatchups = (
	matchups: DetailMatchupCandidate[],
	mode: SyncMode,
	now = new Date(),
	weeklyWindowDays = 120,
): DetailMatchupCandidate[] => {
	if (mode !== "weekly") {
		return matchups;
	}
	const cutoff = new Date(
		now.getTime() - weeklyWindowDays * 24 * 60 * 60 * 1000,
	);
	return matchups.filter((matchup) => {
		const scheduledTime = matchup.scheduledTime ?? null;
		if (!scheduledTime) {
			return true;
		}
		const parsed = new Date(scheduledTime);
		return !Number.isNaN(parsed.getTime()) && parsed >= cutoff;
	});
};

export const findMissingDetailDependencies = (
	completedEndpoints: EndpointName[],
): EndpointName[] =>
	DETAIL_PREREQUISITES.filter(
		(endpoint) => !completedEndpoints.includes(endpoint),
	);

export const phaseRequiresLineupAnalyticsRefresh = (
	phase: IngestPhase,
): boolean =>
	phase === "all" ||
	phase === "matchups" ||
	phase === "playoff-matchups" ||
	phase === "details";

interface BackoffInput {
	attempt: number;
	baseDelayMs: number;
	jitterRatio: number;
	randomValue?: number;
}

export const computeBackoffDelayMs = ({
	attempt,
	baseDelayMs,
	jitterRatio,
	randomValue,
}: BackoffInput): number => {
	const exponential = baseDelayMs * 2 ** Math.max(0, attempt - 1);
	const jitterSeed = randomValue ?? Math.random();
	const jitter = exponential * jitterRatio * jitterSeed;
	return Math.round(exponential + jitter);
};

class SupabaseRestClient {
	private readonly baseUrl: string;
	private readonly apiKey: string;

	public constructor(baseUrl: string, apiKey: string) {
		this.baseUrl = baseUrl.replace(/\/$/, "");
		this.apiKey = apiKey;
	}

	public async insert(
		table: string,
		payload: unknown,
		options: SupabaseInsertOptions = {},
	): Promise<unknown> {
		const returning = options.returning ?? "minimal";
		return this.request(`/rest/v1/${table}`, "POST", payload, {
			Prefer: `return=${returning}`,
		});
	}

	public async upsert(
		table: string,
		payload: unknown,
		options: SupabaseUpsertOptions = {},
	): Promise<void> {
		const suffix = options.onConflict
			? `?on_conflict=${encodeURIComponent(options.onConflict)}`
			: "";
		await this.request(`/rest/v1/${table}${suffix}`, "POST", payload, {
			Prefer: "resolution=merge-duplicates,return=minimal",
		});
	}

	public async getCheckpoint(checkpointKey: string): Promise<string | null> {
		const path = `/rest/v1/ingest_checkpoints?checkpoint_key=eq.${encodeURIComponent(checkpointKey)}&select=checkpoint_value`;
		const rows = (await this.request(path, "GET")) as Array<{
			checkpoint_value: string | null;
		}>;
		return rows[0]?.checkpoint_value ?? null;
	}

	public async rpc(
		functionName: string,
		args: Record<string, unknown> = {},
		schema: PostgrestSchema = "public",
	): Promise<unknown> {
		const schemaHeaders: Record<string, string> | undefined =
			schema === "public"
				? undefined
				: {
						"Accept-Profile": schema,
						"Content-Profile": schema,
					};
		return this.request(`/rest/v1/rpc/${functionName}`, "POST", args, schemaHeaders);
	}

	private async request(
		path: string,
		method: "GET" | "POST",
		payload?: unknown,
		extraHeaders?: Record<string, string>,
	): Promise<unknown> {
		const response = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				apikey: this.apiKey,
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/json",
				...extraHeaders,
			},
			body: payload ? JSON.stringify(payload) : undefined,
		});

		if (!response.ok) {
			const message = await response.text();
			throw new Error(`Supabase REST ${method} ${path} failed: ${message}`);
		}
		return parseJsonResponseSafely(response);
	}
}

const endpointPathForDivision = (
	divisionId: string,
	endpoint: EndpointName,
): string => {
	switch (endpoint) {
		case "players":
			return `/divisions/${divisionId}/players`;
		case "standings":
			return `/divisions/${divisionId}/standings`;
		case "teams":
			return `/divisions/${divisionId}/teams`;
		case "matchups":
			return `/divisions/${divisionId}/matchups`;
		case "playoff-matchups":
			return `/divisions/${divisionId}/matchups?playoffs=true`;
		default:
			return `/divisions/${divisionId}/matchups`;
	}
};

interface FetchRetryConfig {
	retryAttempts: number;
	retryBaseDelayMs: number;
	retryJitterRatio: number;
	onRetry?: (url: string, attempt: number, waitMs: number) => void;
}

const fetchJson = async (
	url: string,
	retryConfig: FetchRetryConfig,
): Promise<unknown> => {
	const maxAttempts = Math.max(1, retryConfig.retryAttempts);
	let attempt = 1;
	while (attempt <= maxAttempts) {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(
					`CrossClub fetch failed (${url}) status ${response.status}`,
				);
			}
			return parseJsonResponseSafely(response);
		} catch (error) {
			if (attempt >= maxAttempts) {
				throw error;
			}
			const waitMs = computeBackoffDelayMs({
				attempt,
				baseDelayMs: retryConfig.retryBaseDelayMs,
				jitterRatio: retryConfig.retryJitterRatio,
			});
			retryConfig.onRetry?.(url, attempt, waitMs);
			await delay(waitMs);
			attempt += 1;
		}
	}
	throw new Error(`Retry loop exhausted for ${url}`);
};

const uniqueByMatchupId = (
	items: DetailMatchupCandidate[],
): DetailMatchupCandidate[] => {
	const deduped = new Map<string, DetailMatchupCandidate>();
	for (const item of items) {
		deduped.set(item.matchupId, item);
	}
	return Array.from(deduped.values());
};

export const uniqueByCompositeKey = <T extends Record<string, unknown>>(
	rows: T[],
	keys: string[],
): T[] => {
	const deduped = new Map<string, T>();
	for (const row of rows) {
		const composite = keys.map((key) => String(row[key] ?? "")).join("::");
		deduped.set(composite, row);
	}
	return Array.from(deduped.values());
};

interface SeasonContextInput {
	seasonNumber: number;
	seasonYear: number;
	snapshotDate: string;
}

export const buildPlayerRosterRows = (
	players: Record<string, unknown>[],
	seasonContext: SeasonContextInput,
): Record<string, unknown>[] =>
	uniqueByCompositeKey(
		players.map((player) => ({
			player_id: player.playerId,
			division_id: player.divisionId,
			team_id: sanitizeTeamForeignKey(player.teamId),
			season_number: seasonContext.seasonNumber,
			season_year: seasonContext.seasonYear,
			is_captain: player.isCaptain ?? false,
			is_sub: player.isSub ?? false,
			club_id: player.clubId ?? null,
			club_name: player.clubName ?? null,
			club_logo: player.clubLogo ?? null,
			club_color: player.clubColor ?? null,
			snapshot_date: seasonContext.snapshotDate,
		})),
		[
			"player_id",
			"division_id",
			"season_number",
			"season_year",
			"snapshot_date",
		],
	);

interface TeamSeasonContextInput extends SeasonContextInput {
	divisionId: string;
}

export const buildTeamSeasonRows = (
	teams: Record<string, unknown>[],
	seasonContext: TeamSeasonContextInput,
): Record<string, unknown>[] =>
	uniqueByCompositeKey(
		teams
			.filter((team) => sanitizeTeamForeignKey(team.teamId))
			.map((team) => ({
				team_id: sanitizeTeamForeignKey(team.teamId),
				division_id: seasonContext.divisionId,
				club_id: team.clubId ?? null,
				team_name: team.teamName,
				season_number: seasonContext.seasonNumber,
				season_year: seasonContext.seasonYear,
				snapshot_date: seasonContext.snapshotDate,
			})),
		["team_id", "division_id", "season_number", "season_year", "snapshot_date"],
	);

export const buildClubRowsFromPlayers = (
	players: Record<string, unknown>[],
): Record<string, unknown>[] =>
	uniqueByCompositeKey(
		players
			.filter((player) => valueAsString(player.clubId))
			.map((player) => ({
				club_id: player.clubId,
				name: player.clubName ?? "Unknown Club",
				logo: player.clubLogo ?? null,
				color: player.clubColor ?? null,
				website: null,
				facebook: null,
				instagram: null,
				twitter: null,
				youtube: null,
				address: null,
				phone: null,
			})),
		["club_id"],
	);

export const buildTeamRowsFromPlayers = (
	players: Record<string, unknown>[],
): Record<string, unknown>[] =>
	uniqueByCompositeKey(
		players
			.filter(
				(player) =>
					sanitizeTeamForeignKey(player.teamId) &&
					valueAsString(player.divisionId) &&
					valueAsString(player.clubId),
			)
			.map((player) => ({
				team_id: sanitizeTeamForeignKey(player.teamId),
				division_id: player.divisionId,
				club_id: player.clubId,
				team_name: player.teamName ?? "Unknown Team",
			})),
		["team_id"],
	);

const incrementCounter = (
	map: Record<string, number>,
	key: string,
	amount = 1,
): void => {
	map[key] = (map[key] ?? 0) + amount;
};

export const ingestCrossClub = async (config: IngestConfig): Promise<void> => {
	const mode: SyncMode = config.mode ?? "bootstrap";
	const phase: IngestPhase = config.phase ?? "all";
	const dryRun = config.dryRun ?? false;
	const apiBaseUrl = (config.apiBaseUrl ?? DEFAULT_API_BASE).replace(/\/$/, "");
	const lat = config.lat ?? "40.2202";
	const lng = config.lng ?? "-74.7642";
	const chunkSize = config.chunkSize ?? 2;
	const delayMs = config.delayMs ?? 600;
	const weeklyWindowDays = config.weeklyWindowDays ?? 120;
	const strictDependencyGuard = config.strictDependencyGuard ?? false;
	const retryAttempts = config.retryAttempts ?? 3;
	const retryBaseDelayMs = config.retryBaseDelayMs ?? 500;
	const retryJitterRatio = config.retryJitterRatio ?? 0.2;
	const regionLocationFilter = config.regionLocationFilter;
	const divisionNameFilter = config.divisionNameFilter;
	const snapshotDate = new Date().toISOString().slice(0, 10);
	let retries = 0;
	let warnings = 0;
	const rowsByTable: Record<string, number> = {};
	const shouldRefreshLineupAnalytics = phaseRequiresLineupAnalyticsRefresh(phase);

	const supabase =
		dryRun || !config.supabaseUrl || !config.supabaseServiceRoleKey
			? null
			: new SupabaseRestClient(
					config.supabaseUrl,
					config.supabaseServiceRoleKey,
				);

	if (!dryRun && !supabase) {
		throw new Error(
			"SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required unless --dry-run is used",
		);
	}

	const runType = `crossclub_${mode}_${phase}`;
	let runId = "dry-run";
	if (supabase) {
		const insertedRunRows = (await supabase.insert(
			"ingest_runs",
			[{ run_type: runType, status: "running" }],
			{ returning: "representation" },
		)) as Array<{ run_id: string }>;
		const insertedRunId = insertedRunRows[0]?.run_id;
		if (!insertedRunId) {
			throw new Error("Could not create ingest run");
		}
		runId = insertedRunId;
	}

	let rowsWritten = 0;
	try {
		const rawRegionsPayload = await fetchJson(
			`${apiBaseUrl}/regions?latitude=${lat}&longitude=${lng}`,
			{
				retryAttempts,
				retryBaseDelayMs,
				retryJitterRatio,
				onRetry: () => {
					retries += 1;
				},
			},
		);
		if (supabase) {
			await supabase.insert("api_raw_ingest", [
				{
					endpoint: "/regions",
					payload: rawRegionsPayload,
					run_id: runId,
					context: { lat, lng, mode, phase },
				},
			]);
		}

		const regions = toArray<RegionApiRecord>(rawRegionsPayload);
		const divisions = extractDivisionsFromRegions(regions, {
			regionLocationFilter,
			divisionNameFilter,
		});

		if (supabase) {
			await supabase.upsert(
				"regions",
				regions.map((region) => ({
					region_id: region.regionId,
					location: region.location,
					latitude: region.latitude ?? null,
					longitude: region.longitude ?? null,
					active: region.active ?? true,
				})),
				{ onConflict: "region_id" },
			);
			await supabase.upsert(
				"divisions",
				divisions.map((division) => ({
					division_id: division.divisionId,
					region_id: division.regionId,
					division_name: division.divisionName,
					season_number: division.seasonNumber,
					season_year: division.seasonYear,
				})),
				{ onConflict: "division_id" },
			);
		}

		const divisionMap = new Map<string, RegionDivision>(
			divisions.map((division) => [division.divisionId, division]),
		);
		const chunks = buildDivisionChunks(
			Array.from(divisionMap.keys()),
			chunkSize,
		);
		const endpoints = planEndpointWork(mode, phase);

		for (const chunk of chunks) {
			for (const divisionId of chunk) {
				const division = divisionMap.get(divisionId);
				if (!division) {
					continue;
				}

				for (const endpointName of endpoints) {
					const checkpointKey = createCheckpointKey({
						divisionId,
						endpointName,
						seasonYear: division.seasonYear,
						seasonNumber: division.seasonNumber,
					});
					if (supabase && mode === "weekly") {
						const previousCheckpoint =
							await supabase.getCheckpoint(checkpointKey);
						if (previousCheckpoint === snapshotDate) {
							continue;
						}
					}

					if (endpointName === "details") {
						if (supabase && strictDependencyGuard) {
							const completed: EndpointName[] = [];
							for (const prerequisite of DETAIL_PREREQUISITES) {
								const prerequisiteCheckpointKey = createCheckpointKey({
									divisionId,
									endpointName: prerequisite,
									seasonYear: division.seasonYear,
									seasonNumber: division.seasonNumber,
								});
								const checkpointValue = await supabase.getCheckpoint(
									prerequisiteCheckpointKey,
								);
								if (checkpointValue) {
									completed.push(prerequisite);
								}
							}
							const missing = findMissingDetailDependencies(completed);
							if (missing.length) {
								warnings += 1;
								console.warn(
									`[crossclub-ingest] strict-dependency-guard division=${divisionId} missing=${missing.join(",")}`,
								);
							}
						}

						const baseMatchups = toArray<DetailMatchupCandidate>(
							await fetchJson(
								`${apiBaseUrl}/divisions/${divisionId}/matchups`,
								{
									retryAttempts,
									retryBaseDelayMs,
									retryJitterRatio,
									onRetry: () => {
										retries += 1;
									},
								},
							),
						);
						const playoffMatchups = toArray<DetailMatchupCandidate>(
							await fetchJson(
								`${apiBaseUrl}/divisions/${divisionId}/matchups?playoffs=true`,
								{
									retryAttempts,
									retryBaseDelayMs,
									retryJitterRatio,
									onRetry: () => {
										retries += 1;
									},
								},
							),
						);
						const detailTargets = selectDetailMatchups(
							uniqueByMatchupId([...baseMatchups, ...playoffMatchups]),
							mode,
							new Date(),
							weeklyWindowDays,
						);

						for (const target of detailTargets) {
							const detailPath = `/divisions/${divisionId}/matchups/${target.matchupId}`;
							const detailPayload = await fetchJson(
								`${apiBaseUrl}${detailPath}`,
								{
									retryAttempts,
									retryBaseDelayMs,
									retryJitterRatio,
									onRetry: () => {
										retries += 1;
									},
								},
							);
							if (supabase) {
								await supabase.insert("api_raw_ingest", [
									{
										endpoint: detailPath,
										payload: detailPayload,
										run_id: runId,
										context: {
											division_id: divisionId,
											matchup_id: target.matchupId,
											mode,
										},
									},
								]);
							}

							const detailObject = toObject(
								denormalizeDotNetJson(detailPayload),
							);
							const rawMatchupStats = Array.isArray(
								detailObject.matchupPlayerStats,
							)
								? (detailObject.matchupPlayerStats as Record<string, unknown>[])
								: [];

							if (supabase && rawMatchupStats.length) {
								const playerRows = uniqueByCompositeKey(
									rawMatchupStats.map((stat) => ({
										player_id: stat.playerId,
										division_id: stat.divisionId ?? divisionId,
										team_id: null,
										first_name: stat.firstName ?? "Unknown",
										middle_name: stat.middleName ?? null,
										last_name: stat.lastName ?? "Unknown",
										gender: stat.gender ?? null,
										is_sub: stat.isSub ?? false,
									})),
									["player_id"],
								);
								await supabase.upsert("players", playerRows, {
									onConflict: "player_id",
								});

								const matchupPlayerStatRows = uniqueByCompositeKey(
									rawMatchupStats.map((stat) => ({
										matchup_id: stat.matchupId,
										player_id: stat.playerId,
										team_id: sanitizeTeamForeignKey(stat.teamId),
										division_id: stat.divisionId ?? divisionId,
										first_name: stat.firstName ?? null,
										middle_name: stat.middleName ?? null,
										last_name: stat.lastName ?? null,
										gender: stat.gender ?? null,
										is_sub: stat.isSub ?? null,
										is_enabled: stat.isEnabled ?? null,
										games_played: stat.gamesPlayed ?? null,
										wins: stat.wins ?? null,
										losses: stat.losses ?? null,
										win_rate: stat.winRate ?? null,
										points_won: stat.pointsWon ?? null,
										total_points_against: stat.totalPointsAgainst ?? null,
										points_per_game: stat.pointsPerGame ?? null,
										total_point_differential:
											stat.totalPointDifferential ?? null,
										average_point_differential:
											stat.averagePointDifferential ?? null,
										clutch_wins: stat.clutchWins ?? null,
										clutch_losses: stat.clutchLosses ?? null,
										clutch_win_rate: stat.clutchWinRate ?? null,
										mixed_ppg: stat.mixedPPG ?? null,
										mixed_wins: stat.mixedWins ?? null,
										mixed_losses: stat.mixedLosses ?? null,
										gender_ppg: stat.genderPPG ?? null,
										gender_wins: stat.genderWins ?? null,
										gender_losses: stat.genderLosses ?? null,
										strength_of_opponent: stat.strengthOfOpponent ?? null,
										snapshot_date: snapshotDate,
									})),
									["matchup_id", "player_id", "snapshot_date"],
								);
								await supabase.upsert(
									"matchup_player_stats",
									matchupPlayerStatRows,
									{ onConflict: "matchup_id,player_id,snapshot_date" },
								);
								rowsWritten += matchupPlayerStatRows.length;
								incrementCounter(
									rowsByTable,
									"matchup_player_stats",
									matchupPlayerStatRows.length,
								);
							}

							if (supabase) {
								const normalizedLineups = normalizeLineupsFromDetail({
									detailObject,
									matchupId: target.matchupId,
									homeTeamId: target.homeTeamId,
									awayTeamId: target.awayTeamId,
									snapshotDate,
								});
								if (normalizedLineups.lineups.length) {
									await supabase.upsert("lineups", normalizedLineups.lineups, {
										onConflict: "matchup_id,team_id,snapshot_date",
									});
									incrementCounter(
										rowsByTable,
										"lineups",
										normalizedLineups.lineups.length,
									);
								}
								if (normalizedLineups.slots.length) {
									await supabase.upsert(
										"lineup_slots",
										normalizedLineups.slots,
										{
											onConflict: "lineup_id,slot_no",
										},
									);
									rowsWritten += normalizedLineups.slots.length;
									incrementCounter(
										rowsByTable,
										"lineup_slots",
										normalizedLineups.slots.length,
									);
								}
							}
						}
					} else {
						const endpointPath = endpointPathForDivision(
							divisionId,
							endpointName,
						);
						const payload = await fetchJson(`${apiBaseUrl}${endpointPath}`, {
							retryAttempts,
							retryBaseDelayMs,
							retryJitterRatio,
							onRetry: () => {
								retries += 1;
							},
						});
						if (supabase) {
							await supabase.insert("api_raw_ingest", [
								{
									endpoint: endpointPath,
									payload,
									run_id: runId,
									context: {
										division_id: divisionId,
										season_year: division.seasonYear,
										season_number: division.seasonNumber,
										mode,
										phase,
									},
								},
							]);
						}

						if (endpointName === "players" && supabase) {
							const players = toArray<Record<string, unknown>>(payload);
							const clubRows = buildClubRowsFromPlayers(players);
							if (clubRows.length) {
								await supabase.upsert("clubs", clubRows, {
									onConflict: "club_id",
								});
							}
							const teamRowsFromPlayers = buildTeamRowsFromPlayers(players);
							if (teamRowsFromPlayers.length) {
								await supabase.upsert("teams", teamRowsFromPlayers, {
									onConflict: "team_id",
								});
							}
							const playerRows = uniqueByCompositeKey(
								players.map((player) => ({
									player_id: player.playerId,
									division_id: player.divisionId,
									team_id: null,
									first_name: player.firstName,
									middle_name: player.middleName ?? null,
									last_name: player.lastName,
									gender: player.gender ?? null,
									dupr: player.dupr ?? null,
									dupr_rating: player.duprRating ?? null,
									is_captain: player.isCaptain ?? false,
									is_sub: player.isSub ?? false,
									club_id: player.clubId ?? null,
									club_name: player.clubName ?? null,
									club_logo: player.clubLogo ?? null,
									club_color: player.clubColor ?? null,
								})),
								["player_id"],
							);
							await supabase.upsert("players", playerRows, {
								onConflict: "player_id",
							});
							const playerDivisionStatRows = uniqueByCompositeKey(
								players.map((player) => ({
									division_id: player.divisionId,
									player_id: player.playerId,
									team_id: sanitizeTeamForeignKey(player.teamId),
									ranking: player.ranking ?? null,
									wins: player.wins ?? null,
									losses: player.losses ?? null,
									games_played: player.gamesPlayed ?? null,
									matches_played: player.matchesPlayed ?? null,
									win_rate: player.winRate ?? null,
									points_won: player.pointsWon ?? null,
									total_points_against: player.totalPointsAgainst ?? null,
									points_per_game: player.pointsPerGame ?? null,
									total_point_differential:
										player.totalPointDifferential ?? null,
									average_point_differential:
										player.averagePointDifferential ?? null,
									clutch_wins: player.clutchWins ?? null,
									clutch_losses: player.clutchLosses ?? null,
									clutch_win_rate: player.clutchWinRate ?? null,
									mixed_ppg: player.mixedPPG ?? null,
									mixed_wins: player.mixedWins ?? null,
									mixed_losses: player.mixedLosses ?? null,
									gender_ppg: player.genderPPG ?? null,
									gender_wins: player.genderWins ?? null,
									gender_losses: player.genderLosses ?? null,
									strength_of_opponent: player.strengthOfOpponent ?? null,
									last_week_strength_of_opponent:
										player.lastWeekStrengthOfOpponent ?? null,
									last_week_ranking: player.lastWeekRanking ?? null,
									snapshot_date: snapshotDate,
								})),
								["division_id", "player_id", "snapshot_date"],
							);
							await supabase.upsert(
								"player_division_stats",
								playerDivisionStatRows,
								{ onConflict: "division_id,player_id,snapshot_date" },
							);
							const playerRosterRows = buildPlayerRosterRows(players, {
								seasonNumber: division.seasonNumber,
								seasonYear: division.seasonYear,
								snapshotDate,
							});
							await supabase.upsert("player_rosters", playerRosterRows, {
								onConflict:
									"player_id,division_id,season_number,season_year,snapshot_date",
							});
							rowsWritten += playerDivisionStatRows.length;
							incrementCounter(rowsByTable, "players", playerRows.length);
							incrementCounter(
								rowsByTable,
								"player_division_stats",
								playerDivisionStatRows.length,
							);
							incrementCounter(
								rowsByTable,
								"player_rosters",
								playerRosterRows.length,
							);
							incrementCounter(rowsByTable, "clubs", clubRows.length);
							incrementCounter(
								rowsByTable,
								"teams",
								teamRowsFromPlayers.length,
							);
						}

						if (endpointName === "standings" && supabase) {
							const standings = toArray<Record<string, unknown>>(payload);
							const standingsRows = uniqueByCompositeKey(
								standings
									.map((standing) => {
										const teamId = sanitizeTeamForeignKey(standing.teamId);
										if (!teamId) {
											return null;
										}
										return {
											division_id: standing.divisionId,
											team_id: teamId,
											season_number: standing.seasonNumber,
											season_year: standing.seasonYear,
											ranking: standing.ranking ?? null,
											pod: standing.pod ?? null,
											wins: standing.wins ?? null,
											losses: standing.losses ?? null,
											draws: standing.draws ?? null,
											mixed_wins: standing.mixedWins ?? null,
											women_wins: standing.womenWins ?? null,
											men_wins: standing.menWins ?? null,
											mixed_losses: standing.mixedLosses ?? null,
											women_losses: standing.womenLosses ?? null,
											men_losses: standing.menLosses ?? null,
											total_points_won: standing.totalPointsWon ?? null,
											team_point_diff: standing.teamPointDiff ?? null,
											clutch_wins: standing.clutchWins ?? null,
											clutch_games: standing.clutchGames ?? null,
											home_wins: standing.homeWins ?? null,
											home_losses: standing.homeLosses ?? null,
											away_wins: standing.awayWins ?? null,
											away_losses: standing.awayLosses ?? null,
											total_games: standing.totalGames ?? null,
											total_single_games: standing.totalSingleGames ?? null,
											pod_ranking: standing.podRanking ?? null,
											record: standing.record ?? null,
											game_record: standing.gameRecord ?? null,
											home_record: standing.homeRecord ?? null,
											away_record: standing.awayRecord ?? null,
											mixed_record: standing.mixedRecord ?? null,
											clutch_record: standing.clutchRecord ?? null,
											mens_record: standing.mensRecord ?? null,
											womens_record: standing.womensRecord ?? null,
											home_win_rate: standing.homeWinRate ?? null,
											away_win_rate: standing.awayWinRate ?? null,
											game_win_rate: standing.gameWinRate ?? null,
											win_percentage: standing.winPercentage ?? null,
											mixed_win_rate: standing.mixedWinRate ?? null,
											women_win_rate: standing.womenWinRate ?? null,
											men_win_rate: standing.menWinRate ?? null,
											average_points_per_game:
												standing.averagePointsPerGame ?? null,
											average_point_differential:
												standing.averagePointDifferential ?? null,
											clutch_win_rate: standing.clutchWinRate ?? null,
											snapshot_date: snapshotDate,
										};
									})
									.filter((standing) => standing !== null),
								[
									"division_id",
									"team_id",
									"season_number",
									"season_year",
									"snapshot_date",
								],
							);
							await supabase.upsert("team_standings", standingsRows, {
								onConflict:
									"division_id,team_id,season_number,season_year,snapshot_date",
							});
							rowsWritten += standingsRows.length;
							incrementCounter(
								rowsByTable,
								"team_standings",
								standingsRows.length,
							);
						}

						if (endpointName === "teams" && supabase) {
							const teams = toArray<Record<string, unknown>>(payload);
							const clubRows = uniqueByCompositeKey(
								teams.map((team) => {
									const club = toObject(team.club);
									return {
										club_id: team.clubId,
										name: club.name ?? "Unknown Club",
										logo: club.logo ?? null,
										color: club.color ?? null,
										website: club.website ?? null,
										facebook: club.facebook ?? null,
										instagram: club.instagram ?? null,
										twitter: club.twitter ?? null,
										youtube: club.youtube ?? null,
										address: club.address ?? null,
										phone: club.phone ?? null,
									};
								}),
								["club_id"],
							);
							await supabase.upsert("clubs", clubRows, {
								onConflict: "club_id",
							});
							const teamRows = uniqueByCompositeKey(
								teams
									.map((team) => {
										const teamId = sanitizeTeamForeignKey(team.teamId);
										if (!teamId) {
											return null;
										}
										return {
											team_id: teamId,
											division_id: divisionId,
											club_id: team.clubId,
											team_name: team.teamName,
										};
									})
									.filter((team) => team !== null),
								["team_id"],
							);
							await supabase.upsert("teams", teamRows, {
								onConflict: "team_id",
							});
							const teamSeasonRows = buildTeamSeasonRows(teams, {
								divisionId,
								seasonNumber: division.seasonNumber,
								seasonYear: division.seasonYear,
								snapshotDate,
							});
							await supabase.upsert("team_seasons", teamSeasonRows, {
								onConflict:
									"team_id,division_id,season_number,season_year,snapshot_date",
							});
							rowsWritten += teamRows.length;
							incrementCounter(rowsByTable, "teams", teamRows.length);
							incrementCounter(
								rowsByTable,
								"team_seasons",
								teamSeasonRows.length,
							);
						}

						if (
							(endpointName === "matchups" ||
								endpointName === "playoff-matchups") &&
							supabase
						) {
							const matchups = toArray<Record<string, unknown>>(payload);
							const matchupRows = uniqueByCompositeKey(
								matchups.map((matchup) => ({
									matchup_id: matchup.matchupId,
									division_id: matchup.divisionId,
									week_number: matchup.weekNumber ?? null,
									home_team_id: sanitizeTeamForeignKey(matchup.homeTeamId),
									away_team_id: sanitizeTeamForeignKey(matchup.awayTeamId),
									home_points: matchup.homePoints ?? null,
									away_points: matchup.awayPoints ?? null,
									end_result: matchup.endResult ?? null,
									away_lineup_locked: matchup.awayLineupLocked ?? null,
									home_lineup_locked: matchup.homeLineupLocked ?? null,
									scheduled_time: matchup.scheduledTime ?? null,
									home_name: matchup.homeName ?? null,
									away_name: matchup.awayName ?? null,
									playoffs: matchup.playoffs ?? false,
									playoff_game: matchup.playoffGame ?? null,
									home_pod_ranking: matchup.homePodRanking ?? null,
									away_pod_ranking: matchup.awayPodRanking ?? null,
									home_wins: matchup.homeWins ?? null,
									away_wins: matchup.awayWins ?? null,
									address: matchup.address ?? null,
									snapshot_date: snapshotDate,
								})),
								["matchup_id"],
							);
							await supabase.upsert("matchups", matchupRows, {
								onConflict: "matchup_id",
							});
							rowsWritten += matchupRows.length;
							incrementCounter(rowsByTable, "matchups", matchupRows.length);
						}
					}

					if (supabase) {
						await supabase.upsert(
							"ingest_checkpoints",
							[
								{
									checkpoint_key: checkpointKey,
									checkpoint_value: snapshotDate,
									last_run_id: runId,
								},
							],
							{ onConflict: "checkpoint_key" },
						);
					}
					await delay(delayMs);
				}
			}
		}

		if (supabase && shouldRefreshLineupAnalytics) {
			await supabase.rpc(
				"refresh_lineup_analytics_views",
				{},
				"analytics",
			);
		}

		if (supabase) {
			await supabase.upsert(
				"ingest_runs",
				[
					{
						run_id: runId,
						run_type: runType,
						status: "completed",
						ended_at: new Date().toISOString(),
						rows_written: rowsWritten,
						metadata: {
							mode,
							phase,
							dry_run: false,
							retries,
							warnings,
							lineup_analytics_refreshed: shouldRefreshLineupAnalytics,
							rows_by_table: rowsByTable,
						},
					},
				],
				{ onConflict: "run_id" },
			);
		}
		console.log(
			`[crossclub-ingest] summary mode=${mode} phase=${phase} dryRun=${dryRun} rows=${rowsWritten} retries=${retries} warnings=${warnings} divisions=${divisions.length} regionFilter=${regionLocationFilter ?? "all"} divisionFilter=${divisionNameFilter ?? "all"} tables=${JSON.stringify(rowsByTable)}`,
		);
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "unknown ingest error";
		if (supabase) {
			await supabase.upsert(
				"ingest_runs",
				[
					{
						run_id: runId,
						run_type: runType,
						status: "failed",
						ended_at: new Date().toISOString(),
						error_message: errorMessage,
						metadata: {
							mode,
							phase,
							dry_run: dryRun,
							retries,
							warnings,
							lineup_analytics_refreshed: false,
							rows_by_table: rowsByTable,
						},
					},
				],
				{ onConflict: "run_id" },
			);
		}
		throw error;
	}
};
