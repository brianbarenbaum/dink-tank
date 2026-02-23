import type { LineupRecommendationPayload } from "./types";

export interface LineupLabRecommendRequest {
	divisionId: string;
	seasonYear: number;
	seasonNumber: number;
	teamId: string;
	oppTeamId: string;
	matchupId: string;
	availablePlayerIds: string[];
	objective: "MAX_EXPECTED_WINS" | "MINIMIZE_DOWNSIDE";
	maxRecommendations?: number;
	downsideQuantile?: number;
	scenarioLimit?: number;
}

export interface LineupLabRosterPlayer {
	playerId: string;
	firstName: string | null;
	lastName: string | null;
	gender: string | null;
	isSub: boolean;
	suggested: boolean;
}

export interface LineupLabClient {
	recommend(payload: LineupLabRecommendRequest): Promise<LineupRecommendationPayload>;
	getDivisions(): Promise<{
		divisions: Array<{
			divisionId: string;
			divisionName: string;
			seasonYear: number;
			seasonNumber: number;
			location: string;
		}>;
	}>;
	getTeams(divisionId: string): Promise<{
		teams: Array<{
			teamId: string;
			teamName: string;
		}>;
	}>;
	getMatchups(input: {
		divisionId: string;
		teamId: string;
		seasonYear: number;
		seasonNumber: number;
	}): Promise<{
		matchups: Array<{
			matchupId: string;
			weekNumber: number | null;
			scheduledTime: string | null;
			teamId: string;
			oppTeamId: string;
			teamName: string;
			oppTeamName: string;
		}>;
		availablePlayerIds: string[];
		suggestedAvailablePlayerIds: string[];
		rosterPlayers: LineupLabRosterPlayer[];
	}>;
}

export const createLineupLabClient = (
	fetchImpl: typeof fetch,
	getAccessToken: () => string | null,
): LineupLabClient => ({
	async recommend(payload) {
		const accessToken = getAccessToken();
		const response = await fetchImpl("/api/lineup-lab/recommend", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			throw new Error("Lineup lab request failed");
		}

		return (await response.json()) as LineupRecommendationPayload;
	},
	async getDivisions() {
		const accessToken = getAccessToken();
		const response = await fetchImpl("/api/lineup-lab/context/divisions", {
			method: "GET",
			headers: {
				"content-type": "application/json",
				...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
			},
		});
		if (!response.ok) {
			throw new Error("Lineup divisions request failed");
		}
		return (await response.json()) as {
			divisions: Array<{
				divisionId: string;
				divisionName: string;
				seasonYear: number;
				seasonNumber: number;
				location: string;
			}>;
		};
	},
	async getTeams(divisionId) {
		const accessToken = getAccessToken();
		const response = await fetchImpl(
			`/api/lineup-lab/context/teams?divisionId=${encodeURIComponent(divisionId)}`,
			{
				method: "GET",
				headers: {
					"content-type": "application/json",
					...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
				},
			},
		);
		if (!response.ok) {
			throw new Error("Lineup teams request failed");
		}
		return (await response.json()) as {
			teams: Array<{
				teamId: string;
				teamName: string;
			}>;
		};
	},
	async getMatchups(input) {
		const accessToken = getAccessToken();
		const query = new URLSearchParams({
			divisionId: input.divisionId,
			teamId: input.teamId,
			seasonYear: String(input.seasonYear),
			seasonNumber: String(input.seasonNumber),
		});
		const response = await fetchImpl(
			`/api/lineup-lab/context/matchups?${query.toString()}`,
			{
				method: "GET",
				headers: {
					"content-type": "application/json",
					...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
				},
			},
		);
		if (!response.ok) {
			throw new Error("Lineup matchups request failed");
		}
		return (await response.json()) as {
			matchups: Array<{
				matchupId: string;
				weekNumber: number | null;
				scheduledTime: string | null;
				teamId: string;
				oppTeamId: string;
				teamName: string;
				oppTeamName: string;
			}>;
			availablePlayerIds: string[];
			suggestedAvailablePlayerIds: string[];
			rosterPlayers: LineupLabRosterPlayer[];
		};
	},
});
