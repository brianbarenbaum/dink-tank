export interface DataBrowserSeasonOption {
	seasonYear: number;
	seasonNumber: number;
	label: string;
}

export interface DataBrowserDivisionScope {
	seasonYear: number;
	seasonNumber: number;
}

export interface DataBrowserDivisionOption {
	divisionId: string;
	divisionName: string;
	seasonYear: number;
	seasonNumber: number;
	location: string;
}

export interface DataBrowserTeamScope extends DataBrowserDivisionScope {
	divisionId: string;
}

export interface DataBrowserTeamOption {
	teamId: string;
	teamName: string;
}

export type DataBrowserQueryType =
	| "division_players"
	| "division_standings"
	| "team_overview"
	| "team_players"
	| "team_schedule";

export type DataBrowserQueryLayout = "table" | "summary" | "schedule";

export type DataBrowserSortDirection = "asc" | "desc";

export interface DataBrowserQueryScope extends DataBrowserTeamScope {
	divisionName: string;
	teamId: string | null;
	teamName: string | null;
}

export interface DataBrowserQueryViewState {
	page: number;
	pageSize: number;
	sortKey: string | null;
	sortDirection: DataBrowserSortDirection | null;
}

export interface DataBrowserQueryRequest {
	queryType: DataBrowserQueryType;
	scope: DataBrowserQueryScope;
	viewState: DataBrowserQueryViewState;
}

export interface DataBrowserQueryColumn {
	key: string;
	label: string;
}

export type DataBrowserQueryRowValue = string | number | boolean | null;

export interface DataBrowserTablePayload {
	columns: DataBrowserQueryColumn[];
	rows: Record<string, DataBrowserQueryRowValue>[];
}

export type DataBrowserQueryPayload =
	| DataBrowserTablePayload
	| Record<string, unknown>
	| null;

export interface DataBrowserQueryResponse {
	queryId: string;
	queryType: DataBrowserQueryType;
	layout: DataBrowserQueryLayout;
	breadcrumb: string[];
	title: string;
	fetchedAt: string;
	page: number;
	pageSize: number;
	totalRows: number;
	totalPages: number;
	sortKey: string | null;
	sortDirection: DataBrowserSortDirection | null;
	payload: DataBrowserQueryPayload;
}
