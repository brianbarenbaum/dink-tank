import { describe, expect, it, vi } from "vitest";

import { createChatDataBrowserClient } from "../src/features/chat/data-browser/chatDataBrowserClient";

describe("chat data browser client", () => {
	it("loads seasons from the context endpoint", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ seasons: [] }),
		});

		const client = createChatDataBrowserClient(
			fetchMock as unknown as typeof fetch,
			() => null,
		);
		await client.getSeasons();

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/data-browser/context/seasons",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("loads divisions for a season", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ divisions: [] }),
		});

		const client = createChatDataBrowserClient(
			fetchMock as unknown as typeof fetch,
			() => null,
		);
		await client.getDivisions({ seasonYear: 2025, seasonNumber: 3 });

		expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
			"/api/data-browser/context/divisions?seasonYear=2025&seasonNumber=3",
		);
	});

	it("loads teams for a division and season", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ teams: [] }),
		});

		const client = createChatDataBrowserClient(
			fetchMock as unknown as typeof fetch,
			() => null,
		);
		await client.getTeams({
			seasonYear: 2025,
			seasonNumber: 3,
			divisionId: "11111111-1111-4111-8111-111111111111",
		});

		expect(String(fetchMock.mock.calls[0]?.[0])).toContain("divisionId=");
		expect(String(fetchMock.mock.calls[0]?.[0])).toContain("seasonYear=2025");
		expect(String(fetchMock.mock.calls[0]?.[0])).toContain("seasonNumber=3");
	});

	it("posts direct queries to the typed query endpoint", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				queryId: "query-1",
				payload: { columns: [], rows: [] },
			}),
		});

		const client = createChatDataBrowserClient(
			fetchMock as unknown as typeof fetch,
			() => null,
		);
		await client.query({
			queryType: "division_players",
			scope: {
				seasonYear: 2025,
				seasonNumber: 3,
				divisionId: "11111111-1111-4111-8111-111111111111",
				divisionName: "3.5",
				teamId: null,
				teamName: null,
			},
			viewState: {
				page: 1,
				pageSize: 20,
				sortKey: "ranking",
				sortDirection: "asc",
			},
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/data-browser/query",
			expect.objectContaining({
				method: "POST",
				body: expect.stringContaining('"queryType":"division_players"'),
			}),
		);
	});
});
