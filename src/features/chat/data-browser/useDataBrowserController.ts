import { getActivePinia } from "pinia";
import { computed, ref, type Ref } from "vue";

import {
	createChatDataBrowserClient,
	type ChatDataBrowserClient,
} from "./chatDataBrowserClient";
import type {
	DataBrowserDivisionOption,
	DataBrowserSeasonOption,
	DataBrowserTeamOption,
} from "./types";
import type {
	DataBrowserQueryRequest,
	DataBrowserQueryResponse,
	DataBrowserQueryType,
	DirectQueryCardItem,
	DirectQueryPayload,
	DirectQuerySortDirection,
	DirectQueryTablePayload,
} from "../types";
import { useAuthStore } from "../../../stores/auth";

type DivisionLeafKind = "division_players" | "division_standings";
type TeamLeafKind = "team_overview" | "team_players" | "team_schedule";
type DataBrowserLeafKind = DivisionLeafKind | TeamLeafKind;
type ViewStateDefaults = Pick<
	DataBrowserQueryRequest["viewState"],
	"sortKey" | "sortDirection"
>;

export interface DataBrowserDivisionBranchInput {
	seasonKey: string;
	divisionId: string;
}

export interface DataBrowserTeamBranchInput
	extends DataBrowserDivisionBranchInput {
	teamId: string;
}

export interface DataBrowserTeamLeafExecutionInput {
	leafKind: TeamLeafKind;
	season: DataBrowserSeasonOption;
	division: DataBrowserDivisionOption;
	team: DataBrowserTeamOption;
}

export interface DataBrowserController {
	seasons: Ref<DataBrowserSeasonOption[]>;
	divisionsBySeasonKey: Ref<Record<string, DataBrowserDivisionOption[]>>;
	teamsByDivisionKey: Ref<Record<string, DataBrowserTeamOption[]>>;
	expandedSeasonKeys: Ref<Set<string>>;
	expandedDivisionKeys: Ref<Set<string>>;
	expandedTeamKeys: Ref<Set<string>>;
	activeCard: Ref<DirectQueryCardItem | null>;
	hasSelectedLeaf: Ref<boolean>;
	isLoadingNextPage: Ref<boolean>;
	canLoadNextPage: Readonly<Ref<boolean>>;
	isInitializing: Ref<boolean>;
	initializationError: Ref<string | null>;
	isLoadingDivisionsBySeasonKey: Ref<Record<string, boolean>>;
	divisionErrorBySeasonKey: Ref<Record<string, string | null>>;
	isLoadingTeamsByDivisionKey: Ref<Record<string, boolean>>;
	teamErrorByDivisionKey: Ref<Record<string, string | null>>;
	initializationPromise: Promise<void>;
	toggleSeason: (seasonKey: string) => Promise<void>;
	toggleDivision: (input: DataBrowserDivisionBranchInput) => Promise<void>;
	toggleTeamsBranch: (input: DataBrowserDivisionBranchInput) => Promise<void>;
	toggleTeam: (input: DataBrowserTeamBranchInput) => void;
	executeDivisionLeafQuery: (input: {
		leafKind: DivisionLeafKind;
		season: DataBrowserSeasonOption;
		division: DataBrowserDivisionOption;
	}) => Promise<void>;
	executeTeamLeafQuery: (
		input: DataBrowserTeamLeafExecutionInput,
	) => Promise<void>;
	loadNextPage: () => Promise<void>;
	goToDirectQueryPage: (input: {
		cardId: string;
		card: DirectQueryCardItem;
		page: number;
	}) => Promise<void>;
	goToDirectQuerySort: (input: {
		cardId: string;
		card: DirectQueryCardItem;
		sortKey: string;
	}) => Promise<void>;
}

interface SeasonScope {
	seasonYear: number;
	seasonNumber: number;
}

interface LoadingCardMetadata {
	title: string;
	breadcrumb: string[];
}

// The dedicated data browser renders a single scrollable table, so it is
// simpler to fetch the full bounded result set in one request.
const DEFAULT_PAGE_SIZE = 10_000;

const QUERY_VIEW_STATE_DEFAULTS: Record<
	DataBrowserQueryType,
	ViewStateDefaults
> = {
	division_players: {
		sortKey: "ranking",
		sortDirection: "asc",
	},
	division_standings: {
		sortKey: "ranking",
		sortDirection: "asc",
	},
	team_overview: {
		sortKey: null,
		sortDirection: null,
	},
	team_players: {
		sortKey: "ranking",
		sortDirection: "asc",
	},
	team_schedule: {
		sortKey: null,
		sortDirection: null,
	},
};

const QUERY_TITLES: Record<DataBrowserQueryType, string> = {
	division_players: "Division Players",
	division_standings: "Division Standings",
	team_overview: "Team Overview",
	team_players: "Team Players",
	team_schedule: "Team Schedule",
};

const QUERY_LEAF_LABELS: Record<DataBrowserQueryType, string> = {
	division_players: "Players",
	division_standings: "Standings",
	team_overview: "Overview",
	team_players: "Players",
	team_schedule: "Schedule",
};

const getSeasonKey = (season: SeasonScope): string =>
	`${season.seasonYear}:${season.seasonNumber}`;

const parseSeasonKey = (seasonKey: string): SeasonScope | null => {
	const [seasonYearRaw, seasonNumberRaw] = seasonKey.split(":");
	const seasonYear = Number.parseInt(seasonYearRaw ?? "", 10);
	const seasonNumber = Number.parseInt(seasonNumberRaw ?? "", 10);
	if (!Number.isInteger(seasonYear) || !Number.isInteger(seasonNumber)) {
		return null;
	}

	return {
		seasonYear,
		seasonNumber,
	};
};

const updateExpandedKeys = (current: Set<string>, key: string): Set<string> => {
	const next = new Set(current);
	if (next.has(key)) {
		next.delete(key);
	} else {
		next.add(key);
	}
	return next;
};

const getDivisionKey = (input: DataBrowserDivisionBranchInput): string =>
	`${input.seasonKey}:${input.divisionId}`;

const getTeamsBranchKey = (input: DataBrowserDivisionBranchInput): string =>
	`${getDivisionKey(input)}:teams`;

const getTeamKey = (input: DataBrowserTeamBranchInput): string =>
	`${getDivisionKey(input)}:team:${input.teamId}`;

const buildLeafRequest = (input: {
	queryType: DataBrowserLeafKind;
	season: DataBrowserSeasonOption;
	division: DataBrowserDivisionOption;
	team?: DataBrowserTeamOption;
}): DataBrowserQueryRequest => ({
	queryType: input.queryType,
	scope: {
		seasonYear: input.season.seasonYear,
		seasonNumber: input.season.seasonNumber,
		divisionId: input.division.divisionId,
		divisionName: input.division.divisionName,
		teamId: input.team?.teamId ?? null,
		teamName: input.team?.teamName ?? null,
	},
	viewState: {
		page: 1,
		pageSize: DEFAULT_PAGE_SIZE,
		sortKey: QUERY_VIEW_STATE_DEFAULTS[input.queryType].sortKey,
		sortDirection: QUERY_VIEW_STATE_DEFAULTS[input.queryType].sortDirection,
	},
});

const buildLoadingCardMetadata = (input: {
	queryType: DataBrowserLeafKind;
	season: DataBrowserSeasonOption;
	division: DataBrowserDivisionOption;
	team?: DataBrowserTeamOption;
}): LoadingCardMetadata => ({
	title: QUERY_TITLES[input.queryType],
	breadcrumb: [
		input.season.label,
		input.division.divisionName,
		...(input.team ? [input.team.teamName] : []),
		QUERY_LEAF_LABELS[input.queryType],
	],
});

const buildLoadingCard = (
	request: DataBrowserQueryRequest,
	metadata: LoadingCardMetadata,
	input: {
		id?: string;
		createdAt?: string;
		payload?: DirectQueryPayload;
	},
): DirectQueryCardItem => ({
	kind: "direct_query_card",
	id: input.id ?? crypto.randomUUID(),
	queryId: crypto.randomUUID(),
	queryType: request.queryType,
	layout:
		request.queryType === "team_overview"
			? "summary"
			: request.queryType === "team_schedule"
				? "schedule"
				: "table",
	title: metadata.title,
	breadcrumb: metadata.breadcrumb,
	createdAt: input.createdAt ?? new Date().toISOString(),
	fetchedAt: null,
	status: "loading",
	request,
	page: request.viewState.page,
	pageSize: request.viewState.pageSize,
	totalRows: null,
	totalPages: null,
	sortKey: request.viewState.sortKey,
	sortDirection: request.viewState.sortDirection,
	errorMessage: null,
	payload: input.payload ?? null,
});

const isTablePayload = (
	payload: DirectQueryPayload,
): payload is DirectQueryTablePayload =>
	Boolean(
		payload &&
			typeof payload === "object" &&
			"columns" in payload &&
			"rows" in payload &&
			Array.isArray(payload.columns) &&
			Array.isArray(payload.rows),
	);

const getCardStatusFromResponse = (
	response: DataBrowserQueryResponse,
	payloadOverride?: DirectQueryPayload,
): DirectQueryCardItem["status"] => {
	const payload = payloadOverride ?? response.payload;
	if (isTablePayload(payload) && payload.rows.length === 0) {
		return "empty";
	}

	return "success";
};

const buildErrorCard = (
	card: DirectQueryCardItem,
	request: DataBrowserQueryRequest,
): DirectQueryCardItem => ({
	...card,
	queryType: request.queryType,
	fetchedAt: new Date().toISOString(),
	status: "error",
	request,
	page: request.viewState.page,
	pageSize: request.viewState.pageSize,
	sortKey: request.viewState.sortKey,
	sortDirection: request.viewState.sortDirection,
	errorMessage: "Unable to load direct query results.",
	payload: null,
	totalRows: 0,
	totalPages: 0,
});

const getNextSortDirection = (
	card: DirectQueryCardItem,
	sortKey: string,
): DirectQuerySortDirection =>
	card.sortKey === sortKey && card.sortDirection === "asc" ? "desc" : "asc";

const isNumericSortValue = (value: unknown): boolean =>
	(typeof value === "number" && Number.isFinite(value)) ||
	(typeof value === "string" &&
		value.trim().length > 0 &&
		Number.isFinite(Number(value)));

const compareSortValues = (left: unknown, right: unknown): number => {
	const leftMissing = left === null || left === undefined || left === "";
	const rightMissing = right === null || right === undefined || right === "";
	if (leftMissing && rightMissing) {
		return 0;
	}
	if (leftMissing) {
		return 1;
	}
	if (rightMissing) {
		return -1;
	}

	if (isNumericSortValue(left) && isNumericSortValue(right)) {
		return Number(left) - Number(right);
	}

	return String(left).localeCompare(String(right), undefined, {
		numeric: true,
		sensitivity: "base",
	});
};

const sortTablePayloadRows = (
	payload: DirectQueryTablePayload,
	sortKey: string,
	sortDirection: DirectQuerySortDirection,
): DirectQueryTablePayload => ({
	columns: payload.columns,
	rows: [...payload.rows].sort((leftRow, rightRow) => {
		const comparison = compareSortValues(leftRow[sortKey], rightRow[sortKey]);
		return sortDirection === "desc" ? comparison * -1 : comparison;
	}),
});

const isFullyLoadedTableCard = (card: DirectQueryCardItem): boolean =>
	isTablePayload(card.payload) &&
	(card.totalPages === 1 ||
		(card.totalRows !== null && card.payload.rows.length >= card.totalRows));

const buildLocallySortedCard = (
	card: DirectQueryCardItem,
	request: DataBrowserQueryRequest,
): DirectQueryCardItem => {
	if (!isTablePayload(card.payload) || !request.viewState.sortKey) {
		return card;
	}

	const payload = sortTablePayloadRows(
		card.payload,
		request.viewState.sortKey,
		request.viewState.sortDirection ?? "asc",
	);

	return {
		...card,
		status: payload.rows.length === 0 ? "empty" : "success",
		request,
		page: request.viewState.page,
		pageSize: request.viewState.pageSize,
		sortKey: request.viewState.sortKey,
		sortDirection: request.viewState.sortDirection,
		errorMessage: null,
		payload,
	};
};

const appendTableRows = (
	currentPayload: DirectQueryPayload,
	nextPayload: DirectQueryPayload,
): DirectQueryPayload => {
	if (!isTablePayload(currentPayload) || !isTablePayload(nextPayload)) {
		return nextPayload;
	}

	return {
		columns: nextPayload.columns,
		rows: [...currentPayload.rows, ...nextPayload.rows],
	};
};

const buildUpdatedCard = (
	card: DirectQueryCardItem,
	request: DataBrowserQueryRequest,
	response: DataBrowserQueryResponse,
	options?: {
		appendRows?: boolean;
	},
): DirectQueryCardItem => {
	const payload = options?.appendRows
		? appendTableRows(card.payload, response.payload)
		: response.payload;

	return {
		...card,
		...response,
		status: getCardStatusFromResponse(response, payload),
		request,
		page: request.viewState.page,
		pageSize: request.viewState.pageSize,
		sortKey: request.viewState.sortKey,
		sortDirection: request.viewState.sortDirection,
		errorMessage: null,
		payload,
	};
};

export function createDataBrowserController(
	client: ChatDataBrowserClient,
): DataBrowserController {
	const seasons = ref<DataBrowserSeasonOption[]>([]);
	const divisionsBySeasonKey = ref<Record<string, DataBrowserDivisionOption[]>>(
		{},
	);
	const teamsByDivisionKey = ref<Record<string, DataBrowserTeamOption[]>>({});
	const expandedSeasonKeys = ref(new Set<string>());
	const expandedDivisionKeys = ref(new Set<string>());
	const expandedTeamKeys = ref(new Set<string>());
	const activeCard = ref<DirectQueryCardItem | null>(null);
	const hasSelectedLeaf = ref(false);
	const isLoadingNextPage = ref(false);
	const isInitializing = ref(true);
	const initializationError = ref<string | null>(null);
	const isLoadingDivisionsBySeasonKey = ref<Record<string, boolean>>({});
	const divisionErrorBySeasonKey = ref<Record<string, string | null>>({});
	const isLoadingTeamsByDivisionKey = ref<Record<string, boolean>>({});
	const teamErrorByDivisionKey = ref<Record<string, string | null>>({});
	const activeRequestId = ref(0);

	const canLoadNextPage = computed(() => {
		const card = activeCard.value;
		if (!card || card.layout !== "table" || card.status !== "success") {
			return false;
		}

		const totalPages = card.totalPages ?? 0;
		return !isLoadingNextPage.value && totalPages > 0 && card.page < totalPages;
	});

	const loadDivisionsForSeason = async (seasonKey: string): Promise<void> => {
		if (divisionsBySeasonKey.value[seasonKey]) {
			return;
		}
		if (isLoadingDivisionsBySeasonKey.value[seasonKey]) {
			return;
		}

		const seasonScope = parseSeasonKey(seasonKey);
		if (!seasonScope) {
			divisionErrorBySeasonKey.value = {
				...divisionErrorBySeasonKey.value,
				[seasonKey]: "Invalid season scope.",
			};
			return;
		}

		isLoadingDivisionsBySeasonKey.value = {
			...isLoadingDivisionsBySeasonKey.value,
			[seasonKey]: true,
		};
		divisionErrorBySeasonKey.value = {
			...divisionErrorBySeasonKey.value,
			[seasonKey]: null,
		};

		try {
			const response = await client.getDivisions(seasonScope);
			divisionsBySeasonKey.value = {
				...divisionsBySeasonKey.value,
				[seasonKey]: response.divisions,
			};
		} catch {
			divisionErrorBySeasonKey.value = {
				...divisionErrorBySeasonKey.value,
				[seasonKey]: "Unable to load divisions for this season.",
			};
		} finally {
			isLoadingDivisionsBySeasonKey.value = {
				...isLoadingDivisionsBySeasonKey.value,
				[seasonKey]: false,
			};
		}
	};

	const loadTeamsForDivision = async (
		input: DataBrowserDivisionBranchInput,
	): Promise<void> => {
		const divisionKey = getDivisionKey(input);
		if (teamsByDivisionKey.value[divisionKey]) {
			return;
		}
		if (isLoadingTeamsByDivisionKey.value[divisionKey]) {
			return;
		}

		const seasonScope = parseSeasonKey(input.seasonKey);
		if (!seasonScope) {
			teamErrorByDivisionKey.value = {
				...teamErrorByDivisionKey.value,
				[divisionKey]: "Invalid season scope.",
			};
			return;
		}

		isLoadingTeamsByDivisionKey.value = {
			...isLoadingTeamsByDivisionKey.value,
			[divisionKey]: true,
		};
		teamErrorByDivisionKey.value = {
			...teamErrorByDivisionKey.value,
			[divisionKey]: null,
		};

		try {
			const response = await client.getTeams({
				...seasonScope,
				divisionId: input.divisionId,
			});
			teamsByDivisionKey.value = {
				...teamsByDivisionKey.value,
				[divisionKey]: response.teams,
			};
		} catch {
			teamErrorByDivisionKey.value = {
				...teamErrorByDivisionKey.value,
				[divisionKey]: "Unable to load teams for this division.",
			};
		} finally {
			isLoadingTeamsByDivisionKey.value = {
				...isLoadingTeamsByDivisionKey.value,
				[divisionKey]: false,
			};
		}
	};

	const beginRequest = (): number => {
		activeRequestId.value += 1;
		return activeRequestId.value;
	};

	const isLatestRequest = (requestId: number): boolean =>
		requestId === activeRequestId.value;

	const executeLeafRequest = async (input: {
		request: DataBrowserQueryRequest;
		metadata: LoadingCardMetadata;
	}): Promise<void> => {
		hasSelectedLeaf.value = true;
		isLoadingNextPage.value = false;
		const requestId = beginRequest();
		const loadingCard = buildLoadingCard(input.request, input.metadata, {});
		activeCard.value = loadingCard;

		try {
			const response = await client.query(input.request);
			if (!isLatestRequest(requestId) || !activeCard.value) {
				return;
			}

			activeCard.value = buildUpdatedCard(
				activeCard.value,
				input.request,
				response,
			);
		} catch {
			if (!isLatestRequest(requestId) || !activeCard.value) {
				return;
			}

			activeCard.value = buildErrorCard(activeCard.value, input.request);
		}
	};

	const toggleSeason = async (seasonKey: string): Promise<void> => {
		const nextKeys = updateExpandedKeys(expandedSeasonKeys.value, seasonKey);
		const isOpening = nextKeys.has(seasonKey);
		expandedSeasonKeys.value = nextKeys;
		if (isOpening) {
			await loadDivisionsForSeason(seasonKey);
		}
	};

	const toggleDivision = async (
		input: DataBrowserDivisionBranchInput,
	): Promise<void> => {
		expandedDivisionKeys.value = updateExpandedKeys(
			expandedDivisionKeys.value,
			getDivisionKey(input),
		);
	};

	const toggleTeamsBranch = async (
		input: DataBrowserDivisionBranchInput,
	): Promise<void> => {
		const branchKey = getTeamsBranchKey(input);
		const nextKeys = updateExpandedKeys(expandedTeamKeys.value, branchKey);
		const isOpening = nextKeys.has(branchKey);
		expandedTeamKeys.value = nextKeys;
		if (isOpening) {
			await loadTeamsForDivision(input);
		}
	};

	const toggleTeam = (input: DataBrowserTeamBranchInput): void => {
		expandedTeamKeys.value = updateExpandedKeys(
			expandedTeamKeys.value,
			getTeamKey(input),
		);
	};

	const executeDivisionLeafQuery = async (input: {
		leafKind: DivisionLeafKind;
		season: DataBrowserSeasonOption;
		division: DataBrowserDivisionOption;
	}): Promise<void> => {
		const request = buildLeafRequest({
			queryType: input.leafKind,
			season: input.season,
			division: input.division,
		});

		await executeLeafRequest({
			request,
			metadata: buildLoadingCardMetadata({
				queryType: input.leafKind,
				season: input.season,
				division: input.division,
			}),
		});
	};

	const executeTeamLeafQuery = async (
		input: DataBrowserTeamLeafExecutionInput,
	): Promise<void> => {
		const request = buildLeafRequest({
			queryType: input.leafKind,
			season: input.season,
			division: input.division,
			team: input.team,
		});

		await executeLeafRequest({
			request,
			metadata: buildLoadingCardMetadata({
				queryType: input.leafKind,
				season: input.season,
				division: input.division,
				team: input.team,
			}),
		});
	};

	const goToDirectQueryPage = async (input: {
		cardId: string;
		card: DirectQueryCardItem;
		page: number;
	}): Promise<void> => {
		if (!activeCard.value || activeCard.value.id !== input.cardId) {
			return;
		}
		if (
			input.page < 1 ||
			input.page === input.card.page ||
			(input.card.totalPages !== null && input.page > input.card.totalPages)
		) {
			return;
		}

		const request: DataBrowserQueryRequest = {
			...input.card.request,
			viewState: {
				...input.card.request.viewState,
				page: input.page,
			},
		};

		const isAppendRequest = input.page > input.card.page;
		const requestId = beginRequest();

		if (isAppendRequest) {
			isLoadingNextPage.value = true;
		} else {
			isLoadingNextPage.value = false;
			activeCard.value = buildLoadingCard(
				request,
				{
					title: input.card.title,
					breadcrumb: input.card.breadcrumb,
				},
				{
					id: input.card.id,
					createdAt: input.card.createdAt,
					payload: input.card.payload,
				},
			);
		}

		try {
			const response = await client.query(request);
			if (!isLatestRequest(requestId) || !activeCard.value) {
				return;
			}

			activeCard.value = buildUpdatedCard(activeCard.value, request, response, {
				appendRows: isAppendRequest,
			});
		} catch {
			if (!isLatestRequest(requestId) || !activeCard.value) {
				return;
			}

			if (!isAppendRequest) {
				activeCard.value = buildErrorCard(activeCard.value, request);
			}
		} finally {
			if (isLatestRequest(requestId)) {
				isLoadingNextPage.value = false;
			}
		}
	};

	const loadNextPage = async (): Promise<void> => {
		const card = activeCard.value;
		if (!card || !canLoadNextPage.value) {
			return;
		}

		await goToDirectQueryPage({
			cardId: card.id,
			card,
			page: card.page + 1,
		});
	};

	const goToDirectQuerySort = async (input: {
		cardId: string;
		card: DirectQueryCardItem;
		sortKey: string;
	}): Promise<void> => {
		if (
			!input.sortKey ||
			!activeCard.value ||
			activeCard.value.id !== input.cardId
		) {
			return;
		}

		const request: DataBrowserQueryRequest = {
			...input.card.request,
			viewState: {
				...input.card.request.viewState,
				page: 1,
				sortKey: input.sortKey,
				sortDirection: getNextSortDirection(input.card, input.sortKey),
			},
		};

		if (isFullyLoadedTableCard(input.card)) {
			activeCard.value = buildLocallySortedCard(input.card, request);
			return;
		}

		const requestId = beginRequest();
		isLoadingNextPage.value = false;
		activeCard.value = buildLoadingCard(
			request,
			{
				title: input.card.title,
				breadcrumb: input.card.breadcrumb,
			},
			{
				id: input.card.id,
				createdAt: input.card.createdAt,
				payload: input.card.payload,
			},
		);

		try {
			const response = await client.query(request);
			if (!isLatestRequest(requestId) || !activeCard.value) {
				return;
			}

			activeCard.value = buildUpdatedCard(activeCard.value, request, response);
		} catch {
			if (!isLatestRequest(requestId) || !activeCard.value) {
				return;
			}

			activeCard.value = buildErrorCard(activeCard.value, request);
		}
	};

	const initializationPromise = client
		.getSeasons()
		.then(async (response) => {
			seasons.value = response.seasons;

			await Promise.all(
				response.seasons.map((season) =>
					loadDivisionsForSeason(getSeasonKey(season)),
				),
			);

			const teamPreloadJobs = response.seasons.flatMap((season) => {
				const seasonKey = getSeasonKey(season);
				return (divisionsBySeasonKey.value[seasonKey] ?? []).map((division) =>
					loadTeamsForDivision({
						seasonKey,
						divisionId: division.divisionId,
					}),
				);
			});

			await Promise.all(teamPreloadJobs);
		})
		.catch(() => {
			initializationError.value = "Unable to load data browser seasons.";
		})
		.finally(() => {
			isInitializing.value = false;
		});

	return {
		seasons,
		divisionsBySeasonKey,
		teamsByDivisionKey,
		expandedSeasonKeys,
		expandedDivisionKeys,
		expandedTeamKeys,
		activeCard,
		hasSelectedLeaf,
		isLoadingNextPage,
		canLoadNextPage,
		isInitializing,
		initializationError,
		isLoadingDivisionsBySeasonKey,
		divisionErrorBySeasonKey,
		isLoadingTeamsByDivisionKey,
		teamErrorByDivisionKey,
		initializationPromise,
		toggleSeason,
		toggleDivision,
		toggleTeamsBranch,
		toggleTeam,
		executeDivisionLeafQuery,
		executeTeamLeafQuery,
		loadNextPage,
		goToDirectQueryPage,
		goToDirectQuerySort,
	};
}

export const useDataBrowserController = (): DataBrowserController => {
	const activePinia = getActivePinia();
	if (!activePinia) {
		const fallbackClient = createChatDataBrowserClient(fetch, () => null);
		return createDataBrowserController(fallbackClient);
	}

	const authStore = useAuthStore(activePinia);
	const client = createChatDataBrowserClient(
		fetch,
		() => authStore.accessToken,
		{
			ensureAccessToken: authStore.getTokenForRequest,
			refreshAfterUnauthorized: authStore.refreshAfterUnauthorized,
			onAuthFailure: authStore.clearSession,
		},
	);

	return createDataBrowserController(client);
};
