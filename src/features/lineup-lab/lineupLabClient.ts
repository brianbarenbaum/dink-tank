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

export interface LineupLabClientAuthOptions {
	ensureAccessToken?: () => Promise<string | null>;
	refreshAfterUnauthorized?: () => Promise<boolean>;
	onAuthFailure?: () => void;
}

export const createLineupLabClient = (
	fetchImpl: typeof fetch,
	getAccessToken: () => string | null,
	authOptions?: LineupLabClientAuthOptions,
): LineupLabClient => ({
	async recommend(payload) {
		const buildHeaders = async () => {
			const accessToken =
				(await authOptions?.ensureAccessToken?.()) ?? getAccessToken();
			return {
				"content-type": "application/json",
				...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
			};
		};
		const initialResponse = await fetchImpl("/api/lineup-lab/recommend", {
			method: "POST",
			headers: await buildHeaders(),
			body: JSON.stringify(payload),
		});
		const response =
			initialResponse.status === 401 && authOptions?.refreshAfterUnauthorized
				? (await authOptions.refreshAfterUnauthorized())
					? await fetchImpl("/api/lineup-lab/recommend", {
							method: "POST",
							headers: await buildHeaders(),
							body: JSON.stringify(payload),
						})
					: initialResponse
				: initialResponse;

		if (!response.ok) {
			if (response.status === 401) {
				authOptions?.onAuthFailure?.();
			}
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
		const buildHeaders = async () => {
			const accessToken =
				(await authOptions?.ensureAccessToken?.()) ?? getAccessToken();
			return {
				"content-type": "application/json",
				...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
			};
		};
		const initialResponse = await fetchImpl("/api/lineup-lab/context/divisions", {
			method: "GET",
			headers: await buildHeaders(),
		});
		const response =
			initialResponse.status === 401 && authOptions?.refreshAfterUnauthorized
				? (await authOptions.refreshAfterUnauthorized())
					? await fetchImpl("/api/lineup-lab/context/divisions", {
							method: "GET",
							headers: await buildHeaders(),
						})
					: initialResponse
				: initialResponse;
		if (!response.ok) {
			if (response.status === 401) {
				authOptions?.onAuthFailure?.();
			}
			throw new Error("Lineup divisions request failed");
		}
		return (await response.json()) as {
			divisions: LineupLabDivisionOption[];
		};
	},
	async getTeams(divisionId) {
		const buildHeaders = async () => {
			const accessToken =
				(await authOptions?.ensureAccessToken?.()) ?? getAccessToken();
			return {
				"content-type": "application/json",
				...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
			};
		};
		const endpoint = `/api/lineup-lab/context/teams?divisionId=${encodeURIComponent(divisionId)}`;
		const initialResponse = await fetchImpl(endpoint, {
			method: "GET",
			headers: await buildHeaders(),
		});
		const response =
			initialResponse.status === 401 && authOptions?.refreshAfterUnauthorized
				? (await authOptions.refreshAfterUnauthorized())
					? await fetchImpl(endpoint, {
							method: "GET",
							headers: await buildHeaders(),
						})
					: initialResponse
				: initialResponse;
		if (!response.ok) {
			if (response.status === 401) {
				authOptions?.onAuthFailure?.();
			}
			throw new Error("Lineup teams request failed");
		}
		return (await response.json()) as {
			teams: LineupLabTeamOption[];
		};
	},
	async getMatchups(input) {
		const buildHeaders = async () => {
			const accessToken =
				(await authOptions?.ensureAccessToken?.()) ?? getAccessToken();
			return {
				"content-type": "application/json",
				...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
			};
		};
		const query = new URLSearchParams({
			divisionId: input.divisionId,
			teamId: input.teamId,
			seasonYear: String(input.seasonYear),
			seasonNumber: String(input.seasonNumber),
		});
		const endpoint = `/api/lineup-lab/context/matchups?${query.toString()}`;
		const initialResponse = await fetchImpl(endpoint, {
			method: "GET",
			headers: await buildHeaders(),
		});
		const response =
			initialResponse.status === 401 && authOptions?.refreshAfterUnauthorized
				? (await authOptions.refreshAfterUnauthorized())
					? await fetchImpl(endpoint, {
							method: "GET",
							headers: await buildHeaders(),
						})
					: initialResponse
				: initialResponse;
		if (!response.ok) {
			if (response.status === 401) {
				authOptions?.onAuthFailure?.();
			}
			throw new Error("Lineup matchups request failed");
		}
		return (await response.json()) as LineupLabMatchupContextResponse;
	},
});
