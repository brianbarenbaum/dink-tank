import type {
	LineupLabDivisionOption,
	LineupLabMatchupContextResponse,
	LineupLabRecommendRequest,
	LineupLabTeamOption,
	LineupRecommendationPayload,
} from "./types";

export interface LineupLabClient {
	recommend(payload: LineupLabRecommendRequest): Promise<LineupRecommendationPayload>;
	getDivisions(): Promise<{ divisions: LineupLabDivisionOption[] }>;
	getTeams(divisionId: string): Promise<{ teams: LineupLabTeamOption[] }>;
	getMatchups(input: {
		divisionId: string;
		teamId: string;
		seasonYear: number;
		seasonNumber: number;
	}): Promise<LineupLabMatchupContextResponse>;
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
			let errorMessage = "Lineup lab request failed";
			try {
				const body = (await response.json()) as { message?: string };
				if (typeof body.message === "string" && body.message.length > 0) {
					errorMessage = body.message;
				}
			} catch {
				// fall back to generic error message
			}
			throw new Error(errorMessage);
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
			divisions: LineupLabDivisionOption[];
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
			teams: LineupLabTeamOption[];
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
		return (await response.json()) as LineupLabMatchupContextResponse;
	},
});
