import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { describe, expect, it, vi } from "vitest";

import { createDataBrowserController } from "../src/features/chat/data-browser/useDataBrowserController";
import type { DataBrowserQueryResponse } from "../src/features/chat/types";
import DataBrowserSidebarContent from "../src/features/data-browser/components/DataBrowserSidebarContent.vue";
import DataBrowserTabShell from "../src/features/data-browser/components/DataBrowserTabShell.vue";

const season = { seasonYear: 2025, seasonNumber: 3, label: "2025 S3" };
const division = {
	divisionId: "11111111-1111-4111-8111-111111111111",
	divisionName: "3.5",
	seasonYear: 2025,
	seasonNumber: 3,
	location: "NJ / PA",
};

const buildQueryResponse = (
	overrides: Partial<DataBrowserQueryResponse> = {},
): DataBrowserQueryResponse => ({
	queryId: crypto.randomUUID(),
	queryType: "division_players",
	layout: "table",
	breadcrumb: ["2025 S3", "3.5", "Players"],
	title: "Division Players",
	fetchedAt: new Date(0).toISOString(),
	page: 1,
	pageSize: 10,
	totalRows: 12,
	totalPages: 2,
	sortKey: "ranking",
	sortDirection: "asc",
	payload: {
		columns: [
			{ key: "ranking", label: "Rank" },
			{ key: "playerName", label: "Player" },
		],
		rows: [{ ranking: 1, playerName: "Jamie Fox" }],
	},
	...overrides,
});

const mountHarness = (queryImpl: () => Promise<DataBrowserQueryResponse>) => {
	const client = {
		getSeasons: vi.fn().mockResolvedValue({ seasons: [season] }),
		getDivisions: vi.fn().mockResolvedValue({ divisions: [division] }),
		getTeams: vi.fn().mockResolvedValue({ teams: [] }),
		query: vi.fn().mockImplementation(queryImpl),
	};
	const dataBrowserController = createDataBrowserController(client as never);

	const Harness = defineComponent({
		components: {
			DataBrowserSidebarContent,
			DataBrowserTabShell,
		},
		setup() {
			return {
				dataBrowserController,
			};
		},
		template: `
			<div class="flex min-h-0 gap-4">
				<DataBrowserSidebarContent :controller="dataBrowserController" />
				<DataBrowserTabShell :controller="dataBrowserController" />
			</div>
		`,
	});

	return {
		wrapper: mount(Harness),
		client,
		dataBrowserController,
	};
};

describe("data browser dedicated page leaf clicks", () => {
	it("shows an empty state before any leaf is selected in session", async () => {
		const { wrapper } = mountHarness(async () => buildQueryResponse());

		await flushPromises();

		expect(wrapper.get("[data-testid='data-browser-root']").text()).toContain(
			"Select a leaf from the sidebar to view data.",
		);
		expect(wrapper.find("[data-testid='direct-query-card']").exists()).toBe(
			false,
		);
	});

	it("clicking a division leaf shows one loading card and then one hydrated card", async () => {
		let resolveQuery:
			| ((
					value:
						| DataBrowserQueryResponse
						| PromiseLike<DataBrowserQueryResponse>,
			  ) => void)
			| undefined;
		const queryPromise = new Promise<DataBrowserQueryResponse>((resolve) => {
			resolveQuery = resolve;
		});
		const { wrapper } = mountHarness(() => queryPromise);

		await flushPromises();
		await wrapper
			.get("[data-testid='data-browser-season-2025-3']")
			.trigger("click");
		await flushPromises();
		await wrapper
			.get(
				"[data-testid='data-browser-division-11111111-1111-4111-8111-111111111111']",
			)
			.trigger("click");
		await wrapper
			.get(
				"[data-testid='data-browser-leaf-division_players-11111111-1111-4111-8111-111111111111']",
			)
			.trigger("click");
		await flushPromises();

		expect(wrapper.findAll("[data-testid='direct-query-card']")).toHaveLength(
			1,
		);
		expect(wrapper.text()).toContain("2025 S3 / 3.5 / Players");
		expect(wrapper.text()).toContain("Loading query results");

		resolveQuery?.(buildQueryResponse());
		await flushPromises();

		expect(wrapper.findAll("[data-testid='direct-query-card']")).toHaveLength(
			1,
		);
		expect(wrapper.text()).toContain("Jamie Fox");
	});

	it("clicking another division leaf replaces the visible card instead of appending", async () => {
		const { wrapper } = mountHarness(async () =>
			buildQueryResponse({
				queryType: "division_standings",
				title: "Division Standings",
				breadcrumb: ["2025 S3", "3.5", "Standings"],
				payload: {
					columns: [
						{ key: "ranking", label: "Rank" },
						{ key: "teamName", label: "Team" },
					],
					rows: [{ ranking: 1, teamName: "Drop Shotters" }],
				},
			}),
		);

		await flushPromises();
		await wrapper
			.get("[data-testid='data-browser-season-2025-3']")
			.trigger("click");
		await flushPromises();
		await wrapper
			.get(
				"[data-testid='data-browser-division-11111111-1111-4111-8111-111111111111']",
			)
			.trigger("click");
		const playersLeaf = wrapper.get(
			"[data-testid='data-browser-leaf-division_players-11111111-1111-4111-8111-111111111111']",
		);
		const standingsLeaf = wrapper.get(
			"[data-testid='data-browser-leaf-division_standings-11111111-1111-4111-8111-111111111111']",
		);

		await playersLeaf.trigger("click");
		await flushPromises();
		expect(wrapper.findAll("[data-testid='direct-query-card']")).toHaveLength(
			1,
		);

		await standingsLeaf.trigger("click");
		await flushPromises();

		expect(wrapper.findAll("[data-testid='direct-query-card']")).toHaveLength(
			1,
		);
		expect(wrapper.text()).toContain("2025 S3 / 3.5 / Standings");
		expect(wrapper.text()).toContain("Drop Shotters");
	});

	it("loads the dedicated data browser table in a single full-result request", async () => {
		const query = vi.fn().mockResolvedValue(
			buildQueryResponse({
				page: 1,
				pageSize: 10_000,
				totalRows: 237,
				totalPages: 1,
				payload: {
					columns: [
						{ key: "ranking", label: "Rank" },
						{ key: "playerName", label: "Player" },
					],
					rows: Array.from({ length: 237 }, (_, index) => ({
						ranking: index + 1,
						playerName: `Player ${index + 1}`,
					})),
				},
			}),
		);
		const { wrapper, client } = mountHarness(query);

		await flushPromises();
		await wrapper
			.get("[data-testid='data-browser-season-2025-3']")
			.trigger("click");
		await flushPromises();
		await wrapper
			.get(
				"[data-testid='data-browser-division-11111111-1111-4111-8111-111111111111']",
			)
			.trigger("click");
		await wrapper
			.get(
				"[data-testid='data-browser-leaf-division_players-11111111-1111-4111-8111-111111111111']",
			)
			.trigger("click");
		await flushPromises();

		expect(client.query).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				viewState: expect.objectContaining({
					page: 1,
					pageSize: 10_000,
				}),
			}),
		);
		expect(client.query).toHaveBeenCalledTimes(1);
		expect(
			wrapper.find("[data-testid='direct-query-load-more-sentinel']").exists(),
		).toBe(false);
		expect(wrapper.findAll("[data-testid='direct-query-card']")).toHaveLength(
			1,
		);
		expect(wrapper.text()).toContain("237 rows loaded");
		expect(wrapper.text()).toContain("Player 237");
	});

	it("clicking a team leaf replaces the active card with the team query result", async () => {
		const team = {
			teamId: "22222222-2222-4222-8222-222222222222",
			teamName: "Drop Shotters",
		};
		const { wrapper, client } = mountHarness(async () =>
			buildQueryResponse({
				queryType: "team_overview",
				layout: "summary",
				title: "Team Overview",
				breadcrumb: ["2025 S3", "3.5", "Drop Shotters", "Overview"],
				payload: {
					teamName: "Drop Shotters",
					matchRecord: {
						wins: 8,
						losses: 2,
						draws: 0,
						record: "8-2-0",
						homeRecord: "4-1",
						awayRecord: "4-1",
					},
					totalPoints: {
						totalPointsWon: 1240,
						averagePerMatch: 124,
					},
					leagueRank: {
						rank: 3,
						teamCount: 16,
						podRank: 2,
					},
					winBreakdown: {
						overallWinPercentage: 80,
						menWinPercentage: 75,
						womenWinPercentage: 82,
						mixedWinPercentage: 85,
					},
					otherStats: {
						gameRecord: "24-12",
						totalPointsWon: 1240,
						averagePointsPerGame: 48.2,
						teamPointDiff: 125,
					},
				},
			}),
		);
		client.getTeams.mockResolvedValue({ teams: [team] });

		await flushPromises();
		await wrapper
			.get("[data-testid='data-browser-season-2025-3']")
			.trigger("click");
		await flushPromises();
		await wrapper
			.get(
				"[data-testid='data-browser-division-11111111-1111-4111-8111-111111111111']",
			)
			.trigger("click");
		await wrapper
			.get(
				"[data-testid='data-browser-leaf-division_players-11111111-1111-4111-8111-111111111111']",
			)
			.trigger("click");
		await flushPromises();
		expect(wrapper.findAll("[data-testid='direct-query-card']")).toHaveLength(
			1,
		);

		await wrapper
			.get(
				"[data-testid='data-browser-teams-branch-11111111-1111-4111-8111-111111111111']",
			)
			.trigger("click");
		await flushPromises();
		await wrapper
			.get(
				"[data-testid='data-browser-team-22222222-2222-4222-8222-222222222222']",
			)
			.trigger("click");
		await wrapper
			.get(
				"[data-testid='data-browser-leaf-team_overview-22222222-2222-4222-8222-222222222222']",
			)
			.trigger("click");
		await flushPromises();

		expect(client.query).toHaveBeenLastCalledWith(
			expect.objectContaining({
				queryType: "team_overview",
				scope: expect.objectContaining({
					divisionId: division.divisionId,
					teamId: team.teamId,
					teamName: team.teamName,
				}),
			}),
		);
		expect(wrapper.findAll("[data-testid='direct-query-card']")).toHaveLength(
			1,
		);
		expect(wrapper.text()).toContain(
			"2025 S3 / 3.5 / Drop Shotters / Overview",
		);
		expect(wrapper.find("[data-testid='team-overview-card']").exists()).toBe(
			true,
		);
		expect(wrapper.text()).toContain("MATCH RECORD");
		expect(wrapper.text()).toContain("TOTAL POINTS");
		expect(wrapper.text()).toContain("LEAGUE RANK");
		expect(wrapper.text()).toContain("WIN PERCENTAGE BREAKDOWN");
		expect(wrapper.text()).toContain("OTHER STATS");
		expect(wrapper.text()).toContain("Home Record: 4 - 1");
		expect(wrapper.text()).toContain("Away Record: 4 - 1");
		expect(wrapper.text()).toContain("1,240");
		expect(wrapper.text()).toContain("#03 / 16");
		expect(wrapper.text()).toContain("80.0%");
		expect(wrapper.text()).not.toContain("Result ready.");
	});

	it("clicking the team players leaf shows the player table filtered to the selected team", async () => {
		const team = {
			teamId: "22222222-2222-4222-8222-222222222222",
			teamName: "Drop Shotters",
		};
		const query = vi
			.fn()
			.mockResolvedValueOnce(buildQueryResponse())
			.mockResolvedValueOnce(
				buildQueryResponse({
					queryType: "team_players",
					title: "Team Players",
					breadcrumb: ["2025 S3", "3.5", "Drop Shotters", "Players"],
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
						],
					},
				}),
			);
		const { wrapper, client } = mountHarness(query);
		client.getTeams.mockResolvedValue({ teams: [team] });

		await flushPromises();
		await wrapper
			.get("[data-testid='data-browser-season-2025-3']")
			.trigger("click");
		await flushPromises();
		await wrapper
			.get(
				"[data-testid='data-browser-division-11111111-1111-4111-8111-111111111111']",
			)
			.trigger("click");
		await wrapper
			.get(
				"[data-testid='data-browser-leaf-division_players-11111111-1111-4111-8111-111111111111']",
			)
			.trigger("click");
		await flushPromises();

		await wrapper
			.get(
				"[data-testid='data-browser-teams-branch-11111111-1111-4111-8111-111111111111']",
			)
			.trigger("click");
		await flushPromises();
		await wrapper
			.get(
				"[data-testid='data-browser-team-22222222-2222-4222-8222-222222222222']",
			)
			.trigger("click");
		await wrapper
			.get(
				"[data-testid='data-browser-leaf-team_players-22222222-2222-4222-8222-222222222222']",
			)
			.trigger("click");
		await flushPromises();

		expect(client.query).toHaveBeenLastCalledWith(
			expect.objectContaining({
				queryType: "team_players",
				scope: expect.objectContaining({
					divisionId: division.divisionId,
					teamId: team.teamId,
					teamName: team.teamName,
				}),
			}),
		);
		expect(wrapper.findAll("[data-testid='direct-query-card']")).toHaveLength(
			1,
		);
		expect(wrapper.text()).toContain("2025 S3 / 3.5 / Drop Shotters / Players");
		expect(wrapper.text()).toContain("Jamie Fox");
		expect(wrapper.text()).toContain("Drop Shotters");
		expect(
			wrapper.find("[data-testid='direct-query-player-search']").exists(),
		).toBe(true);
	});

	it("clicking the team schedule leaf shows a loading table and then the schedule table", async () => {
		const team = {
			teamId: "22222222-2222-4222-8222-222222222222",
			teamName: "Drop Shotters",
		};
		let resolveQuery:
			| ((
					value:
						| DataBrowserQueryResponse
						| PromiseLike<DataBrowserQueryResponse>,
			  ) => void)
			| undefined;
		const queryPromise = new Promise<DataBrowserQueryResponse>((resolve) => {
			resolveQuery = resolve;
		});
		const { wrapper, client } = mountHarness(() => queryPromise);
		client.getTeams.mockResolvedValue({ teams: [team] });

		await flushPromises();
		await wrapper
			.get("[data-testid='data-browser-season-2025-3']")
			.trigger("click");
		await flushPromises();
		await wrapper
			.get(
				"[data-testid='data-browser-division-11111111-1111-4111-8111-111111111111']",
			)
			.trigger("click");
		await wrapper
			.get(
				"[data-testid='data-browser-teams-branch-11111111-1111-4111-8111-111111111111']",
			)
			.trigger("click");
		await flushPromises();
		await wrapper
			.get(
				"[data-testid='data-browser-team-22222222-2222-4222-8222-222222222222']",
			)
			.trigger("click");
		await wrapper
			.get(
				"[data-testid='data-browser-leaf-team_schedule-22222222-2222-4222-8222-222222222222']",
			)
			.trigger("click");
		await flushPromises();

		expect(wrapper.findAll("[data-testid='direct-query-card']")).toHaveLength(
			1,
		);
		expect(wrapper.text()).toContain(
			"2025 S3 / 3.5 / Drop Shotters / Schedule",
		);
		expect(wrapper.text()).toContain("Loading query results");

		resolveQuery?.(
			buildQueryResponse({
				queryType: "team_schedule",
				layout: "table",
				title: "Team Schedule",
				breadcrumb: ["2025 S3", "3.5", "Drop Shotters", "Schedule"],
				sortKey: "weekNumber",
				sortDirection: "asc",
				payload: {
					columns: [
						{ key: "weekNumber", label: "Week" },
						{ key: "matchDateTime", label: "Match Time" },
						{ key: "opponentTeamName", label: "Opponent" },
						{ key: "matchResult", label: "Result" },
						{ key: "score", label: "Score" },
					],
					rows: [
						{
							weekNumber: 4,
							matchDateTime: "Mar 08, 2026 06:00pm",
							opponentTeamName: "Kitchen Kings",
							matchResult: "Win",
							score: "21-16",
						},
					],
				},
			}),
		);
		await flushPromises();

		expect(wrapper.findAll("[data-testid='direct-query-card']")).toHaveLength(
			1,
		);
		expect(
			wrapper.find("[data-testid='direct-query-table-scroll-region']").exists(),
		).toBe(true);
		expect(wrapper.text()).toContain("Mar 08, 2026 06:00pm");
		expect(wrapper.text()).toContain("Kitchen Kings");
		expect(wrapper.text()).toContain("21-16");
		expect(wrapper.text()).not.toContain("Result ready.");
	});
});
