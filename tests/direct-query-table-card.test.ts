import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import DirectQueryTableCard from "../src/features/chat/components/DirectQueryTableCard.vue";
import type { DirectQueryCardItem } from "../src/features/chat/types";

const buildCard = (
	overrides: Partial<DirectQueryCardItem> = {},
): DirectQueryCardItem => ({
	kind: "direct_query_card",
	id: "direct-query-1",
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
			page: 1,
			pageSize: 10,
			sortKey: "ranking",
			sortDirection: "asc",
		},
	},
	page: 1,
	pageSize: 10,
	totalRows: 1,
	totalPages: 1,
	sortKey: "ranking",
	sortDirection: "asc",
	errorMessage: null,
	payload: {
		columns: [
			{ key: "ranking", label: "Rank" },
			{ key: "playerName", label: "Player" },
		],
		rows: [{ ranking: 1, playerName: "Jamie Fox" }],
	},
	...overrides,
});

describe("DirectQueryTableCard", () => {
	it("renders the direct query shell, success table, and pagination region", () => {
		const wrapper = mount(DirectQueryTableCard, {
			props: {
				card: buildCard({
					totalRows: 23,
					totalPages: 3,
				}),
			},
		});

		expect(wrapper.get("[data-testid='direct-query-card']").classes()).toEqual(
			expect.arrayContaining([
				"direct-query-card-surface",
				"chat-divider-border",
			]),
		);
		expect(
			wrapper.get("[data-testid='direct-query-card']").text(),
		).not.toContain("Direct query");
		expect(wrapper.text()).not.toContain("Division Players");
		expect(wrapper.text()).toContain("2025 S3 / 3.5 / Players");
		expect(wrapper.text()).toContain("Last Updated Jan 01, 1970");
		expect(wrapper.text()).not.toContain(new Date(0).toISOString());
		expect(wrapper.text()).toContain("Jamie Fox");
		expect(wrapper.text()).toContain("Page 1 of 3");
		expect(wrapper.text()).toContain("23 rows");
		expect(
			wrapper.get("[data-testid='direct-query-previous-page']").attributes(),
		).toHaveProperty("disabled");
		expect(
			wrapper
				.get("[data-testid='direct-query-next-page']")
				.attributes("disabled"),
		).toBeUndefined();
		expect(
			wrapper.get("[data-testid='direct-query-previous-page']").classes(),
		).toEqual(expect.arrayContaining(["cursor-pointer"]));
		expect(
			wrapper.get("[data-testid='direct-query-next-page']").classes(),
		).toEqual(expect.arrayContaining(["cursor-pointer"]));
	});

	it("hides pagination buttons and shows the loaded row count for the dedicated data browser flow", () => {
		const wrapper = mount(DirectQueryTableCard, {
			props: {
				card: buildCard({
					totalRows: 23,
					totalPages: 3,
				}),
				showPagination: false,
			},
		});

		expect(
			wrapper.find("[data-testid='direct-query-previous-page']").exists(),
		).toBe(false);
		expect(
			wrapper.find("[data-testid='direct-query-next-page']").exists(),
		).toBe(false);
		expect(wrapper.text()).toContain("Jamie Fox");
		expect(wrapper.text()).toContain("1 of 23 rows loaded");
	});

	it("renders a live player-name filter for dedicated player tables", async () => {
		const wrapper = mount(DirectQueryTableCard, {
			props: {
				card: buildCard({
					totalRows: 3,
					totalPages: 1,
					payload: {
						columns: [
							{ key: "ranking", label: "Rank" },
							{ key: "playerName", label: "Player" },
							{ key: "teamName", label: "Team" },
						],
						rows: [
							{
								ranking: 1,
								playerName: "Jamie Fox",
								teamName: "Drop Shotters",
							},
							{
								ranking: 2,
								playerName: "Taylor Swift",
								teamName: "Topspin Club",
							},
							{
								ranking: 3,
								playerName: "Morgan Lee",
								teamName: "Kitchen Kings",
							},
						],
					},
				}),
				showPagination: false,
			},
		});

		const searchInput = wrapper.get(
			"[data-testid='direct-query-player-search']",
		);

		expect(searchInput.attributes("placeholder")).toBe(
			"Search player names...",
		);
		expect(searchInput.classes()).toEqual(
			expect.arrayContaining([
				"h-14",
				"w-full",
				"max-w-sm",
				"rounded-md",
				"border",
			]),
		);
		expect(wrapper.text()).toContain("Jamie Fox");
		expect(wrapper.text()).toContain("Taylor Swift");

		await searchInput.setValue("tay");

		expect(wrapper.text()).not.toContain("Jamie Fox");
		expect(wrapper.text()).toContain("Taylor Swift");
		expect(wrapper.text()).not.toContain("Morgan Lee");
	});

	it("does not render a player-name filter for non-player tables", () => {
		const wrapper = mount(DirectQueryTableCard, {
			props: {
				card: buildCard({
					queryType: "division_standings",
					title: "Division Standings",
					breadcrumb: ["2025 S3", "3.5", "Standings"],
					request: {
						...buildCard().request,
						queryType: "division_standings",
					},
					payload: {
						columns: [
							{ key: "ranking", label: "Rank" },
							{ key: "teamName", label: "Team" },
						],
						rows: [{ ranking: 1, teamName: "Drop Shotters" }],
					},
				}),
				showPagination: false,
			},
		});

		expect(
			wrapper.find("[data-testid='direct-query-player-search']").exists(),
		).toBe(false);
	});

	it("renders a scrollable table viewport with a sticky header in the dedicated data browser flow", () => {
		const wrapper = mount(DirectQueryTableCard, {
			props: {
				card: buildCard({
					totalRows: 40,
					totalPages: 4,
					payload: {
						columns: [
							{ key: "ranking", label: "Rank" },
							{ key: "playerName", label: "Player" },
							{ key: "teamName", label: "Team" },
						],
						rows: Array.from({ length: 20 }, (_, index) => ({
							ranking: index + 1,
							playerName: `Player ${index + 1}`,
							teamName: `Team ${index + 1}`,
						})),
					},
				}),
				showPagination: false,
			},
		});

		expect(wrapper.get("[data-testid='direct-query-card']").classes()).toEqual(
			expect.arrayContaining(["min-h-0", "flex-1"]),
		);
		expect(
			wrapper.get("[data-testid='direct-query-table-scroll-region']").classes(),
		).toEqual(
			expect.arrayContaining([
				"chat-scrollbar",
				"min-h-0",
				"flex-1",
				"overflow-y-auto",
			]),
		);
		expect(
			wrapper.get("[data-testid='direct-query-table-header']").classes(),
		).toEqual(expect.arrayContaining(["sticky", "top-0", "z-10"]));
	});

	it("keeps the dedicated data browser loading skeleton capped at ten rows even for full-result page sizes", () => {
		const wrapper = mount(DirectQueryTableCard, {
			props: {
				card: buildCard({
					status: "loading",
					pageSize: 10_000,
					payload: null,
				}),
				showPagination: false,
			},
		});

		expect(
			wrapper.findAll("[data-testid='direct-query-loading-row']"),
		).toHaveLength(10);
	});

	it("renders sortable headers only for the supported players and standings columns", () => {
		const playersWrapper = mount(DirectQueryTableCard, {
			props: {
				card: buildCard({
					payload: {
						columns: [
							{ key: "ranking", label: "Rank" },
							{ key: "playerName", label: "Player" },
							{ key: "teamName", label: "Team" },
							{ key: "record", label: "Record" },
						],
						rows: [
							{
								ranking: 1,
								playerName: "Jamie Fox",
								teamName: "Drop Shotters",
								record: "7-1",
							},
						],
					},
				}),
			},
		});

		expect(
			playersWrapper.find("[data-testid='direct-query-sort-ranking']").exists(),
		).toBe(true);
		expect(
			playersWrapper
				.find("[data-testid='direct-query-sort-playerName']")
				.exists(),
		).toBe(true);
		expect(
			playersWrapper
				.find("[data-testid='direct-query-sort-teamName']")
				.exists(),
		).toBe(true);
		expect(
			playersWrapper.find("[data-testid='direct-query-sort-record']").exists(),
		).toBe(false);

		const standingsWrapper = mount(DirectQueryTableCard, {
			props: {
				card: buildCard({
					queryType: "division_standings",
					title: "Division Standings",
					breadcrumb: ["2025 S3", "3.5", "Standings"],
					request: {
						...buildCard().request,
						queryType: "division_standings",
					},
					sortKey: "winPercentage",
					payload: {
						columns: [
							{ key: "ranking", label: "Rank" },
							{ key: "teamName", label: "Team" },
							{ key: "record", label: "Record" },
							{ key: "winPercentage", label: "Win %" },
							{ key: "podName", label: "Pod" },
						],
						rows: [
							{
								ranking: 1,
								teamName: "Drop Shotters",
								record: "7-1",
								winPercentage: "87.5",
								podName: "Pod A",
							},
						],
					},
				}),
			},
		});

		expect(
			standingsWrapper
				.find("[data-testid='direct-query-sort-ranking']")
				.exists(),
		).toBe(true);
		expect(
			standingsWrapper
				.find("[data-testid='direct-query-sort-teamName']")
				.exists(),
		).toBe(true);
		expect(
			standingsWrapper
				.find("[data-testid='direct-query-sort-winPercentage']")
				.exists(),
		).toBe(true);
		expect(
			standingsWrapper
				.find("[data-testid='direct-query-sort-podName']")
				.exists(),
		).toBe(true);
		expect(
			standingsWrapper
				.find("[data-testid='direct-query-sort-record']")
				.exists(),
		).toBe(false);
	});

	it("renders loading, empty, and error states inside the card body", () => {
		const loadingWrapper = mount(DirectQueryTableCard, {
			props: {
				card: buildCard({
					status: "loading",
					payload: null,
				}),
			},
		});
		expect(loadingWrapper.text()).toContain("Loading query results");
		expect(
			loadingWrapper.findAll("[data-testid='direct-query-loading-row']"),
		).toHaveLength(10);
		expect(loadingWrapper.text()).toContain("Rank");
		expect(loadingWrapper.text()).toContain("Player");

		const paginatingWrapper = mount(DirectQueryTableCard, {
			props: {
				card: buildCard({
					status: "loading",
				}),
			},
		});
		expect(
			paginatingWrapper.findAll("[data-testid='direct-query-loading-row']"),
		).toHaveLength(10);
		expect(paginatingWrapper.text()).not.toContain("Jamie Fox");

		const emptyWrapper = mount(DirectQueryTableCard, {
			props: {
				card: buildCard({
					status: "empty",
					totalRows: 0,
					totalPages: 0,
					payload: {
						columns: [],
						rows: [],
					},
				}),
			},
		});
		expect(emptyWrapper.text()).toContain("No results found for this query.");

		const errorWrapper = mount(DirectQueryTableCard, {
			props: {
				card: buildCard({
					status: "error",
					errorMessage: "Unable to load direct query results.",
					payload: null,
				}),
			},
		});
		expect(errorWrapper.text()).toContain(
			"Unable to load direct query results.",
		);
	});

	it("emits previous and next page requests from the footer controls", async () => {
		const wrapper = mount(DirectQueryTableCard, {
			props: {
				card: buildCard({
					page: 2,
					totalRows: 23,
					totalPages: 3,
				}),
			},
		});

		await wrapper
			.get("[data-testid='direct-query-previous-page']")
			.trigger("click");
		await wrapper
			.get("[data-testid='direct-query-next-page']")
			.trigger("click");

		expect(wrapper.emitted("paginate")).toEqual([[1], [3]]);
	});

	it("emits sort requests from sortable column headers", async () => {
		const wrapper = mount(DirectQueryTableCard, {
			props: {
				card: buildCard({
					payload: {
						columns: [
							{ key: "ranking", label: "Rank" },
							{ key: "playerName", label: "Player" },
							{ key: "teamName", label: "Team" },
							{ key: "record", label: "Record" },
						],
						rows: [
							{
								ranking: 1,
								playerName: "Jamie Fox",
								teamName: "Drop Shotters",
								record: "7-1",
							},
						],
					},
				}),
			},
		});

		await wrapper
			.get("[data-testid='direct-query-sort-ranking']")
			.trigger("click");
		await wrapper
			.get("[data-testid='direct-query-sort-playerName']")
			.trigger("click");

		expect(wrapper.emitted("sort")).toEqual([["ranking"], ["playerName"]]);
	});
});
