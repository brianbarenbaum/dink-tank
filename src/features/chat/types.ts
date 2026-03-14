export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
	id: string;
	role: ChatRole;
	content: string;
	createdAt: string;
}

export type DataBrowserQueryType =
	| "division_players"
	| "division_standings"
	| "team_overview"
	| "team_players"
	| "team_schedule";

export type DirectQueryLayout = "table" | "summary" | "schedule";

export type DirectQueryStatus = "loading" | "success" | "empty" | "error";

export type DirectQuerySortDirection = "asc" | "desc";

export interface DataBrowserQueryScope {
	seasonYear: number;
	seasonNumber: number;
	divisionId: string;
	divisionName: string | null;
	teamId: string | null;
	teamName: string | null;
}

export interface DataBrowserQueryViewState {
	page: number;
	pageSize: number;
	sortKey: string | null;
	sortDirection: DirectQuerySortDirection | null;
}

export interface DataBrowserQueryRequest {
	queryType: DataBrowserQueryType;
	scope: DataBrowserQueryScope;
	viewState: DataBrowserQueryViewState;
}

export interface DirectQueryTableColumn {
	key: string;
	label: string;
}

export type DirectQueryTableRowValue = number | string | boolean | null;

export interface DirectQueryTablePayload {
	columns: DirectQueryTableColumn[];
	rows: Record<string, DirectQueryTableRowValue>[];
}

export type DirectQueryPayload =
	| DirectQueryTablePayload
	| Record<string, unknown>
	| null;

export interface DataBrowserQueryResponse {
	queryId: string;
	queryType: DataBrowserQueryType;
	layout: DirectQueryLayout;
	breadcrumb: string[];
	title: string;
	fetchedAt: string | null;
	page: number;
	pageSize: number;
	totalRows: number | null;
	totalPages: number | null;
	sortKey: string | null;
	sortDirection: DirectQuerySortDirection | null;
	payload: DirectQueryPayload;
}

export interface DirectQueryCardItem extends DataBrowserQueryResponse {
	kind: "direct_query_card";
	id: string;
	createdAt: string;
	fetchedAt: string | null;
	status: DirectQueryStatus;
	request: DataBrowserQueryRequest;
	totalRows: number | null;
	totalPages: number | null;
	errorMessage: string | null;
}

export type ChatTranscriptItem = ChatMessage | DirectQueryCardItem;
