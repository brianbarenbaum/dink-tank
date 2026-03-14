import type {
	DataBrowserDivisionOption,
	DataBrowserSeasonOption,
	DataBrowserTeamOption,
} from "./types";
import type {
	DataBrowserQueryRequest,
	DataBrowserQueryResponse,
} from "../types";

export interface ChatDataBrowserClient {
	getSeasons(): Promise<{ seasons: DataBrowserSeasonOption[] }>;
	getDivisions(input: {
		seasonYear: number;
		seasonNumber: number;
	}): Promise<{ divisions: DataBrowserDivisionOption[] }>;
	getTeams(input: {
		seasonYear: number;
		seasonNumber: number;
		divisionId: string;
	}): Promise<{ teams: DataBrowserTeamOption[] }>;
	query(input: DataBrowserQueryRequest): Promise<DataBrowserQueryResponse>;
}

export interface ChatDataBrowserClientAuthOptions {
	ensureAccessToken?: () => Promise<string | null>;
	refreshAfterUnauthorized?: () => Promise<boolean>;
	onAuthFailure?: () => void;
}

const buildEndpointWithQuery = (
	pathname: string,
	query: Record<string, string>,
): string => {
	const searchParams = new URLSearchParams(query);
	return `${pathname}?${searchParams.toString()}`;
};

export const createChatDataBrowserClient = (
	fetchImpl: typeof fetch,
	getAccessToken: () => string | null,
	authOptions?: ChatDataBrowserClientAuthOptions,
): ChatDataBrowserClient => ({
	async getSeasons() {
		const endpoint = "/api/data-browser/context/seasons";
		const response = await fetchWithAuthRetry(
			fetchImpl,
			getAccessToken,
			{
				endpoint,
				method: "GET",
			},
			authOptions,
		);
		return (await response.json()) as {
			seasons: DataBrowserSeasonOption[];
		};
	},
	async getDivisions(input) {
		const endpoint = buildEndpointWithQuery(
			"/api/data-browser/context/divisions",
			{
				seasonYear: String(input.seasonYear),
				seasonNumber: String(input.seasonNumber),
			},
		);
		const response = await fetchWithAuthRetry(
			fetchImpl,
			getAccessToken,
			{
				endpoint,
				method: "GET",
			},
			authOptions,
		);
		return (await response.json()) as {
			divisions: DataBrowserDivisionOption[];
		};
	},
	async getTeams(input) {
		const endpoint = buildEndpointWithQuery("/api/data-browser/context/teams", {
			seasonYear: String(input.seasonYear),
			seasonNumber: String(input.seasonNumber),
			divisionId: input.divisionId,
		});
		const response = await fetchWithAuthRetry(
			fetchImpl,
			getAccessToken,
			{
				endpoint,
				method: "GET",
			},
			authOptions,
		);
		return (await response.json()) as {
			teams: DataBrowserTeamOption[];
		};
	},
	async query(input) {
		const response = await fetchWithAuthRetry(
			fetchImpl,
			getAccessToken,
			{
				endpoint: "/api/data-browser/query",
				method: "POST",
				body: JSON.stringify(input),
			},
			authOptions,
		);
		return (await response.json()) as DataBrowserQueryResponse;
	},
});

interface FetchRequestOptions {
	endpoint: string;
	method: "GET" | "POST";
	body?: string;
}

const fetchWithAuthRetry = async (
	fetchImpl: typeof fetch,
	getAccessToken: () => string | null,
	requestOptions: FetchRequestOptions,
	authOptions?: ChatDataBrowserClientAuthOptions,
): Promise<Response> => {
	const buildHeaders = async () => {
		const accessToken =
			(await authOptions?.ensureAccessToken?.()) ?? getAccessToken();
		return {
			"content-type": "application/json",
			...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
		};
	};

	const initialResponse = await fetchImpl(requestOptions.endpoint, {
		method: requestOptions.method,
		headers: await buildHeaders(),
		body: requestOptions.body,
	});
	const response =
		initialResponse.status === 401 && authOptions?.refreshAfterUnauthorized
			? (await authOptions.refreshAfterUnauthorized())
				? await fetchImpl(requestOptions.endpoint, {
						method: requestOptions.method,
						headers: await buildHeaders(),
						body: requestOptions.body,
					})
				: initialResponse
			: initialResponse;

	if (!response.ok) {
		if (response.status === 401) {
			authOptions?.onAuthFailure?.();
		}
		throw new Error(`Data browser request failed: ${requestOptions.endpoint}`);
	}

	return response;
};
