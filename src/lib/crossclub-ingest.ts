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
	divisionId: string;
	divisionName: string;
	seasonNumber: number;
	seasonYear: number;
}

export interface DetailMatchupCandidate {
	matchupId: string;
	scheduledTime?: string | null;
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
}

interface RegionApiRecord {
	regionId: string;
	location: string;
	latitude?: number;
	longitude?: number;
	active?: boolean;
	divisions?: RegionDivisionCollection;
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

const DEFAULT_API_BASE =
	"https://cplsecureapiproxy.azurewebsites.net/api/CPLSecureApiProxy/v0/api";

const WEEKLY_ENDPOINTS: EndpointName[] = ["matchups", "playoff-matchups", "standings"];
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

const toObject = (value: unknown): Record<string, unknown> => {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
};

const valueAsString = (value: unknown): string | null =>
	typeof value === "string" ? value : null;

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
	const hash = createHash("sha1").update(seed).digest("hex").slice(0, 32).split("");
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
	const cutoff = new Date(now.getTime() - weeklyWindowDays * 24 * 60 * 60 * 1000);
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
		if (response.status === 204) {
			return null;
		}
		return response.json();
	}
}

const endpointPathForDivision = (divisionId: string, endpoint: EndpointName): string => {
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
				throw new Error(`CrossClub fetch failed (${url}) status ${response.status}`);
			}
			return response.json();
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

const uniqueByMatchupId = (items: DetailMatchupCandidate[]): DetailMatchupCandidate[] => {
	const deduped = new Map<string, DetailMatchupCandidate>();
	for (const item of items) {
		deduped.set(item.matchupId, item);
	}
	return Array.from(deduped.values());
};

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
	const snapshotDate = new Date().toISOString().slice(0, 10);
	let retries = 0;
	let warnings = 0;
	const rowsByTable: Record<string, number> = {};

	const supabase =
		dryRun || !config.supabaseUrl || !config.supabaseServiceRoleKey
			? null
			: new SupabaseRestClient(config.supabaseUrl, config.supabaseServiceRoleKey);

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
		const divisions: RegionDivision[] = [];
		for (const region of regions) {
			const divisionItems = region.divisions?.$values ?? [];
			for (const division of divisionItems) {
				divisions.push({
					regionId: division.regionId,
					divisionId: division.divisionId,
					divisionName: division.divisionName,
					seasonNumber: division.seasonNumber,
					seasonYear: division.seasonYear,
				});
			}
		}

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
		const chunks = buildDivisionChunks(Array.from(divisionMap.keys()), chunkSize);
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
						const previousCheckpoint = await supabase.getCheckpoint(checkpointKey);
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
								const checkpointValue =
									await supabase.getCheckpoint(prerequisiteCheckpointKey);
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
							await fetchJson(`${apiBaseUrl}/divisions/${divisionId}/matchups`, {
								retryAttempts,
								retryBaseDelayMs,
								retryJitterRatio,
								onRetry: () => {
									retries += 1;
								},
							}),
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
							const detailPayload = await fetchJson(`${apiBaseUrl}${detailPath}`, {
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

							const detailObject = toObject(denormalizeDotNetJson(detailPayload));
							const rawMatchupStats = Array.isArray(detailObject.matchupPlayerStats)
								? (detailObject.matchupPlayerStats as Record<string, unknown>[])
								: [];
							const rawLineups = Array.isArray(detailObject.lineups)
								? (detailObject.lineups as Record<string, unknown>[])
								: [];

							if (supabase && rawMatchupStats.length) {
								await supabase.upsert(
									"players",
									rawMatchupStats.map((stat) => ({
										player_id: stat.playerId,
										division_id: stat.divisionId ?? divisionId,
										team_id: stat.teamId ?? null,
										first_name: stat.firstName ?? "Unknown",
										middle_name: stat.middleName ?? null,
										last_name: stat.lastName ?? "Unknown",
										gender: stat.gender ?? null,
										is_sub: stat.isSub ?? false,
									})),
									{ onConflict: "player_id" },
								);

								await supabase.upsert(
									"matchup_player_stats",
									rawMatchupStats.map((stat) => ({
										matchup_id: stat.matchupId,
										player_id: stat.playerId,
										team_id: stat.teamId ?? null,
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
										total_point_differential: stat.totalPointDifferential ?? null,
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
									{ onConflict: "matchup_id,player_id,snapshot_date" },
								);
								rowsWritten += rawMatchupStats.length;
								incrementCounter(
									rowsByTable,
									"matchup_player_stats",
									rawMatchupStats.length,
								);
							}

							if (supabase && rawLineups.length) {
								const lineups = rawLineups
									.map((lineup) => {
										const teamId = valueAsString(lineup.teamId);
										if (!teamId) {
											return null;
										}
										const lineupId =
											valueAsString(lineup.lineupId) ??
											deterministicUuidFromSeed(
												`${target.matchupId}:${teamId}:${snapshotDate}`,
											);
										return {
											lineup_id: lineupId,
											matchup_id: target.matchupId,
											team_id: teamId,
											submitted_at:
												valueAsString(lineup.submittedAt) ??
												valueAsString(lineup.updatedAt) ??
												null,
											locked: Boolean(lineup.locked ?? lineup.isLocked ?? false),
											raw_json: lineup,
											snapshot_date: snapshotDate,
										};
									})
									.filter((lineup) => lineup !== null);

								await supabase.upsert("lineups", lineups, {
									onConflict: "matchup_id,team_id,snapshot_date",
								});
								incrementCounter(rowsByTable, "lineups", lineups.length);

								const slots: Record<string, unknown>[] = [];
								for (const lineup of rawLineups) {
									const teamId = valueAsString(lineup.teamId);
									if (!teamId) {
										continue;
									}
									const lineupId =
										valueAsString(lineup.lineupId) ??
										deterministicUuidFromSeed(
											`${target.matchupId}:${teamId}:${snapshotDate}`,
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
												valueAsNumber(slot.courtNo) ??
												valueAsNumber(slot.courtNumber),
											role: valueAsString(slot.role),
											raw_json: slot,
										});
									}
								}
								if (slots.length) {
									await supabase.upsert("lineup_slots", slots, {
										onConflict: "lineup_id,slot_no",
									});
									rowsWritten += slots.length;
									incrementCounter(rowsByTable, "lineup_slots", slots.length);
								}
							}
						}
					} else {
						const endpointPath = endpointPathForDivision(divisionId, endpointName);
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
							await supabase.upsert(
								"players",
								players.map((player) => ({
									player_id: player.playerId,
									division_id: player.divisionId,
									team_id: player.teamId ?? null,
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
								{ onConflict: "player_id" },
							);
							await supabase.upsert(
								"player_division_stats",
								players.map((player) => ({
									division_id: player.divisionId,
									player_id: player.playerId,
									team_id: player.teamId ?? null,
									ranking: player.ranking ?? null,
									wins: player.wins ?? null,
									losses: player.losses ?? null,
									games_played: player.gamesPlayed ?? null,
									matches_played: player.matchesPlayed ?? null,
									win_rate: player.winRate ?? null,
									points_won: player.pointsWon ?? null,
									total_points_against: player.totalPointsAgainst ?? null,
									points_per_game: player.pointsPerGame ?? null,
									total_point_differential: player.totalPointDifferential ?? null,
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
								{ onConflict: "division_id,player_id,snapshot_date" },
							);
							rowsWritten += players.length;
							incrementCounter(rowsByTable, "players", players.length);
							incrementCounter(rowsByTable, "player_division_stats", players.length);
						}

						if (endpointName === "standings" && supabase) {
							const standings = toArray<Record<string, unknown>>(payload);
							await supabase.upsert(
								"team_standings",
								standings.map((standing) => ({
									division_id: standing.divisionId,
									team_id: standing.teamId,
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
									average_points_per_game: standing.averagePointsPerGame ?? null,
									average_point_differential:
										standing.averagePointDifferential ?? null,
									clutch_win_rate: standing.clutchWinRate ?? null,
									snapshot_date: snapshotDate,
								})),
								{
									onConflict:
										"division_id,team_id,season_number,season_year,snapshot_date",
								},
							);
							rowsWritten += standings.length;
							incrementCounter(rowsByTable, "team_standings", standings.length);
						}

						if (endpointName === "teams" && supabase) {
							const teams = toArray<Record<string, unknown>>(payload);
							await supabase.upsert(
								"clubs",
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
								{ onConflict: "club_id" },
							);
							await supabase.upsert(
								"teams",
								teams.map((team) => ({
									team_id: team.teamId,
									division_id: divisionId,
									club_id: team.clubId,
									team_name: team.teamName,
								})),
								{ onConflict: "team_id" },
							);
							rowsWritten += teams.length;
							incrementCounter(rowsByTable, "teams", teams.length);
						}

						if (
							(endpointName === "matchups" || endpointName === "playoff-matchups") &&
							supabase
						) {
							const matchups = toArray<Record<string, unknown>>(payload);
							await supabase.upsert(
								"matchups",
								matchups.map((matchup) => ({
									matchup_id: matchup.matchupId,
									division_id: matchup.divisionId,
									week_number: matchup.weekNumber ?? null,
									home_team_id: matchup.homeTeamId ?? null,
									away_team_id: matchup.awayTeamId ?? null,
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
								{ onConflict: "matchup_id" },
							);
							rowsWritten += matchups.length;
							incrementCounter(rowsByTable, "matchups", matchups.length);
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

		if (supabase) {
			await supabase.upsert(
				"ingest_runs",
				[
					{
						run_id: runId,
						status: "completed",
						ended_at: new Date().toISOString(),
						rows_written: rowsWritten,
						metadata: {
							mode,
							phase,
							dry_run: false,
							retries,
							warnings,
							rows_by_table: rowsByTable,
						},
					},
				],
				{ onConflict: "run_id" },
			);
		}
		console.log(
			`[crossclub-ingest] summary mode=${mode} phase=${phase} dryRun=${dryRun} rows=${rowsWritten} retries=${retries} warnings=${warnings} tables=${JSON.stringify(rowsByTable)}`,
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
						status: "failed",
						ended_at: new Date().toISOString(),
						error_message: errorMessage,
						metadata: {
							mode,
							phase,
							dry_run: dryRun,
							retries,
							warnings,
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
