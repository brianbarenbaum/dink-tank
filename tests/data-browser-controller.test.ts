import { describe, expect, it, vi } from "vitest";

import { createDataBrowserController } from "../src/features/chat/data-browser/useDataBrowserController";
import type { DirectQueryCardItem } from "../src/features/chat/types";

const season = { seasonYear: 2025, seasonNumber: 3, label: "2025 S3" };
const division = {
	divisionId: "11111111-1111-4111-8111-111111111111",
	divisionName: "3.5",
	seasonYear: 2025,
	seasonNumber: 3,
	location: "NJ / PA",
};

const buildCard = (
	overrides: Partial<DirectQueryCardItem> = {},
): DirectQueryCardItem => ({
	kind: "direct_query_card",
	id: "direct-query-card-1",
	queryId: "query-1",
	queryType: "division_players",
	layout: "table",
	title: "Division Players",
	breadcrumb: ["2025 S3", "3.5", "Players"],
	createdAt: new Date(0).toISOString(),
	fetchedAt: new Date(0).toISOString(),
	status: "success",
	request: {
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
			page: 2,
			pageSize: 10,
			sortKey: "ranking",
			sortDirection: "asc",
		},
	},
	page: 2,
	pageSize: 10,
	totalRows: 23,
	totalPages: 3,
	sortKey: "ranking",
	sortDirection: "asc",
	errorMessage: null,
	payload: {
		columns: [
			{ key: "ranking", label: "Rank" },
			{ key: "playerName", label: "Player" },
			{ key: "teamName", label: "Team" },
		],
		rows: [{ ranking: 11, playerName: "Jamie Fox", teamName: "Drop Shotters" }],
	},
	...overrides,
});

describe("data browser controller", () => {
	it("loads seasons on init", async () => {
		const client = {
			getSeasons: vi.fn().mockResolvedValue({
				seasons: [{ seasonYear: 2025, seasonNumber: 3, label: "2025 S3" }],
			}),
			getDivisions: vi.fn().mockResolvedValue({ divisions: [] }),
			getTeams: vi.fn().mockResolvedValue({ teams: [] }),
		};

		const controller = createDataBrowserController(client as never);
		await controller.initializationPromise;

		expect(client.getSeasons).toHaveBeenCalledTimes(1);
		expect(client.getDivisions).toHaveBeenCalledWith({
			seasonYear: 2025,
			seasonNumber: 3,
		});
		expect(controller.seasons.value).toHaveLength(1);
		expect(controller.seasons.value[0]?.label).toBe("2025 S3");
	});

	it("preloads divisions and teams during initialization", async () => {
		const client = {
			getSeasons: vi.fn().mockResolvedValue({
				seasons: [{ seasonYear: 2025, seasonNumber: 3, label: "2025 S3" }],
			}),
			getDivisions: vi.fn().mockResolvedValue({
				divisions: [
					{
						divisionId: "11111111-1111-4111-8111-111111111111",
						divisionName: "3.5",
						seasonYear: 2025,
						seasonNumber: 3,
						location: "NJ / PA",
					},
				],
			}),
			getTeams: vi.fn().mockResolvedValue({
				teams: [
					{
						teamId: "22222222-2222-4222-8222-222222222222",
						teamName: "Drop Shotters",
					},
				],
			}),
		};

		const controller = createDataBrowserController(client as never);
		await controller.initializationPromise;

		expect(client.getDivisions).toHaveBeenCalledWith({
			seasonYear: 2025,
			seasonNumber: 3,
		});
		expect(controller.divisionsBySeasonKey.value["2025:3"]).toHaveLength(1);
		expect(client.getTeams).toHaveBeenCalledWith({
			seasonYear: 2025,
			seasonNumber: 3,
			divisionId: "11111111-1111-4111-8111-111111111111",
		});
		expect(
			controller.teamsByDivisionKey.value[
				"2025:3:11111111-1111-4111-8111-111111111111"
			],
		).toHaveLength(1);
	});

	it("expands preloaded seasons and teams branches without refetching", async () => {
		const client = {
			getSeasons: vi.fn().mockResolvedValue({
				seasons: [{ seasonYear: 2025, seasonNumber: 3, label: "2025 S3" }],
			}),
			getDivisions: vi.fn().mockResolvedValue({
				divisions: [
					{
						divisionId: "11111111-1111-4111-8111-111111111111",
						divisionName: "3.5",
						seasonYear: 2025,
						seasonNumber: 3,
						location: "NJ / PA",
					},
				],
			}),
			getTeams: vi.fn().mockResolvedValue({
				teams: [
					{
						teamId: "22222222-2222-4222-8222-222222222222",
						teamName: "Drop Shotters",
					},
				],
			}),
		};

		const controller = createDataBrowserController(client as never);
		await controller.initializationPromise;
		expect(client.getDivisions).toHaveBeenCalledTimes(1);
		expect(client.getTeams).toHaveBeenCalledTimes(1);

		await controller.toggleSeason("2025:3");
		await controller.toggleDivision({
			seasonKey: "2025:3",
			divisionId: "11111111-1111-4111-8111-111111111111",
		});
		await controller.toggleTeamsBranch({
			seasonKey: "2025:3",
			divisionId: "11111111-1111-4111-8111-111111111111",
		});

		expect(client.getDivisions).toHaveBeenCalledTimes(1);
		expect(client.getTeams).toHaveBeenCalledTimes(1);
		expect(
			controller.teamsByDivisionKey.value[
				"2025:3:11111111-1111-4111-8111-111111111111"
			],
		).toHaveLength(1);
		expect(
			controller.expandedTeamKeys.value.has(
				"2025:3:11111111-1111-4111-8111-111111111111:teams",
			),
		).toBe(true);
	});

	it("allows multiple branches to remain open", async () => {
		const client = {
			getSeasons: vi.fn().mockResolvedValue({
				seasons: [
					{ seasonYear: 2025, seasonNumber: 3, label: "2025 S3" },
					{ seasonYear: 2024, seasonNumber: 2, label: "2024 S2" },
				],
			}),
			getDivisions: vi
				.fn()
				.mockImplementation(async ({ seasonYear, seasonNumber }) => ({
					divisions: [
						{
							divisionId: `${seasonYear}-${seasonNumber}-division`,
							divisionName: `${seasonYear} Division`,
							seasonYear,
							seasonNumber,
							location: "NJ / PA",
						},
					],
				})),
			getTeams: vi.fn().mockResolvedValue({ teams: [] }),
		};

		const controller = createDataBrowserController(client as never);
		await controller.initializationPromise;

		await controller.toggleSeason("2025:3");
		await controller.toggleSeason("2024:2");
		await controller.toggleDivision({
			seasonKey: "2025:3",
			divisionId: "2025-3-division",
		});
		await controller.toggleDivision({
			seasonKey: "2024:2",
			divisionId: "2024-2-division",
		});

		expect(controller.expandedSeasonKeys.value.has("2025:3")).toBe(true);
		expect(controller.expandedSeasonKeys.value.has("2024:2")).toBe(true);
		expect(
			controller.expandedDivisionKeys.value.has("2025:3:2025-3-division"),
		).toBe(true);
		expect(
			controller.expandedDivisionKeys.value.has("2024:2:2024-2-division"),
		).toBe(true);
	});

	it("stores a single active card when a division leaf is executed", async () => {
		const query = vi.fn().mockResolvedValue({
			queryId: "query-1",
			queryType: "division_players",
			layout: "table",
			breadcrumb: ["2025 S3", "3.5", "Players"],
			title: "Division Players",
			fetchedAt: new Date(1).toISOString(),
			page: 1,
			pageSize: 10,
			totalRows: 23,
			totalPages: 3,
			sortKey: "ranking",
			sortDirection: "asc",
			payload: {
				columns: [
					{ key: "ranking", label: "Rank" },
					{ key: "playerName", label: "Player" },
				],
				rows: [{ ranking: 1, playerName: "Jamie Fox" }],
			},
		});
		const client = {
			getSeasons: vi.fn().mockResolvedValue({ seasons: [season] }),
			getDivisions: vi.fn(),
			getTeams: vi.fn(),
			query,
		};

		const controller = createDataBrowserController(client as never);
		await controller.initializationPromise;

		await controller.executeDivisionLeafQuery({
			leafKind: "division_players",
			season,
			division,
		});

		expect(controller.hasSelectedLeaf.value).toBe(true);
		expect(controller.activeCard.value).not.toBeNull();
		expect(controller.activeCard.value?.title).toBe("Division Players");
		expect(controller.activeCard.value?.page).toBe(1);
		expect(controller.activeCard.value?.payload).toEqual(
			expect.objectContaining({
				rows: [{ ranking: 1, playerName: "Jamie Fox" }],
			}),
		);
	});

	it("sorts a fully loaded active table locally without fetching again", async () => {
		const query = vi.fn();
		const client = {
			getSeasons: vi.fn().mockResolvedValue({ seasons: [] }),
			getDivisions: vi.fn(),
			getTeams: vi.fn(),
			query,
		};

		const controller = createDataBrowserController(client as never);
		await controller.initializationPromise;

		controller.activeCard.value = buildCard({
			page: 1,
			pageSize: 10_000,
			totalRows: 2,
			totalPages: 1,
			request: {
				...buildCard().request,
				viewState: {
					...buildCard().request.viewState,
					page: 1,
					pageSize: 10_000,
				},
			},
			payload: {
				columns: [
					{ key: "ranking", label: "Rank" },
					{ key: "playerName", label: "Player" },
					{ key: "teamName", label: "Team" },
				],
				rows: [
					{ ranking: 2, playerName: "Taylor Swift", teamName: "B Team" },
					{ ranking: 1, playerName: "Alex Ace", teamName: "A Team" },
				],
			},
		});

		await controller.goToDirectQuerySort({
			cardId: controller.activeCard.value.id,
			card: controller.activeCard.value,
			sortKey: "playerName",
		});

		expect(query).not.toHaveBeenCalled();
		expect(controller.activeCard.value?.sortKey).toBe("playerName");
		expect(controller.activeCard.value?.sortDirection).toBe("asc");
		expect(controller.activeCard.value?.request.viewState.sortKey).toBe(
			"playerName",
		);
		expect(controller.activeCard.value?.payload).toEqual(
			expect.objectContaining({
				rows: [
					{ ranking: 1, playerName: "Alex Ace", teamName: "A Team" },
					{ ranking: 2, playerName: "Taylor Swift", teamName: "B Team" },
				],
			}),
		);
	});

	it("falls back to a server sort when the active table is not fully loaded", async () => {
		const query = vi.fn().mockResolvedValue({
			queryId: "query-2",
			queryType: "division_players",
			layout: "table",
			breadcrumb: ["2025 S3", "3.5", "Players"],
			title: "Division Players",
			fetchedAt: new Date(1).toISOString(),
			page: 1,
			pageSize: 10,
			totalRows: 23,
			totalPages: 3,
			sortKey: "playerName",
			sortDirection: "asc",
			payload: {
				columns: [
					{ key: "ranking", label: "Rank" },
					{ key: "playerName", label: "Player" },
					{ key: "teamName", label: "Team" },
				],
				rows: [{ ranking: 1, playerName: "Alex Ace", teamName: "A Team" }],
			},
		});
		const client = {
			getSeasons: vi.fn().mockResolvedValue({ seasons: [] }),
			getDivisions: vi.fn(),
			getTeams: vi.fn(),
			query,
		};

		const controller = createDataBrowserController(client as never);
		await controller.initializationPromise;

		controller.activeCard.value = buildCard();

		await controller.goToDirectQuerySort({
			cardId: controller.activeCard.value.id,
			card: controller.activeCard.value,
			sortKey: "playerName",
		});

		expect(query).toHaveBeenCalledWith({
			...controller.activeCard.value?.request,
			viewState: {
				...buildCard().request.viewState,
				page: 1,
				sortKey: "playerName",
				sortDirection: "asc",
			},
		});
		expect(controller.activeCard.value?.page).toBe(1);
		expect(controller.activeCard.value?.sortKey).toBe("playerName");
		expect(controller.activeCard.value?.sortDirection).toBe("asc");
		expect(controller.activeCard.value?.payload).toEqual(
			expect.objectContaining({
				rows: [{ ranking: 1, playerName: "Alex Ace", teamName: "A Team" }],
			}),
		);
	});

	it("appends rows when loading the next page for the active card", async () => {
		const query = vi.fn().mockResolvedValue({
			queryId: "query-3",
			queryType: "division_players",
			layout: "table",
			breadcrumb: ["2025 S3", "3.5", "Players"],
			title: "Division Players",
			fetchedAt: new Date(1).toISOString(),
			page: 1,
			pageSize: 10,
			totalRows: 23,
			totalPages: 3,
			sortKey: "ranking",
			sortDirection: "asc",
			payload: {
				columns: [
					{ key: "ranking", label: "Rank" },
					{ key: "playerName", label: "Player" },
				],
				rows: [{ ranking: 12, playerName: "Taylor Swift" }],
			},
		});
		const client = {
			getSeasons: vi.fn().mockResolvedValue({ seasons: [] }),
			getDivisions: vi.fn(),
			getTeams: vi.fn(),
			query,
		};

		const controller = createDataBrowserController(client as never);
		await controller.initializationPromise;

		controller.activeCard.value = buildCard({
			page: 1,
			request: {
				...buildCard().request,
				viewState: {
					...buildCard().request.viewState,
					page: 1,
				},
			},
			payload: {
				columns: [
					{ key: "ranking", label: "Rank" },
					{ key: "playerName", label: "Player" },
				],
				rows: [{ ranking: 1, playerName: "Jamie Fox" }],
			},
		});

		await controller.goToDirectQueryPage({
			cardId: controller.activeCard.value.id,
			card: controller.activeCard.value,
			page: 2,
		});

		expect(query).toHaveBeenCalledWith({
			...buildCard().request,
			viewState: {
				...buildCard().request.viewState,
				page: 2,
				sortKey: "ranking",
				sortDirection: "asc",
			},
		});
		expect(controller.activeCard.value?.page).toBe(2);
		expect(controller.activeCard.value?.payload).toEqual(
			expect.objectContaining({
				rows: [
					{ ranking: 1, playerName: "Jamie Fox" },
					{ ranking: 12, playerName: "Taylor Swift" },
				],
			}),
		);
	});
});
