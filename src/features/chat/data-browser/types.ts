export type DataBrowserLeafKind =
	| "division_players"
	| "division_standings"
	| "team_overview"
	| "team_players"
	| "team_schedule";

export interface DataBrowserSeasonOption {
	seasonYear: number;
	seasonNumber: number;
	label: string;
}

export interface DataBrowserDivisionOption {
	divisionId: string;
	divisionName: string;
	seasonYear: number;
	seasonNumber: number;
	location: string;
}

export interface DataBrowserTeamOption {
	teamId: string;
	teamName: string;
}
