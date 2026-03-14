import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { computed, nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/features/chat/useChatController", () => ({
	useChatController: () => ({
		messages: ref([
			{
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
			},
		]),
		isSending: ref(false),
		errorMessage: ref(null),
		modelLabel: ref("mock-model"),
		extendedThinking: ref(false),
		submit: vi.fn(),
		appendDirectQueryCard: vi.fn(),
		updateDirectQueryCard: vi.fn(),
	}),
}));

vi.mock("../src/features/chat/data-browser/useDataBrowserController", () => ({
	useDataBrowserController: () => ({
		seasons: ref([]),
		divisionsBySeasonKey: ref({}),
		teamsByDivisionKey: ref({}),
		expandedSeasonKeys: ref(new Set<string>()),
		expandedDivisionKeys: ref(new Set<string>()),
		expandedTeamKeys: ref(new Set<string>()),
		activeCard: ref(null),
		hasSelectedLeaf: ref(false),
		isLoadingNextPage: ref(false),
		canLoadNextPage: computed(() => false),
		isInitializing: ref(false),
		initializationError: ref<string | null>(null),
		isLoadingDivisionsBySeasonKey: ref<Record<string, boolean>>({}),
		divisionErrorBySeasonKey: ref<Record<string, string | null>>({}),
		isLoadingTeamsByDivisionKey: ref<Record<string, boolean>>({}),
		teamErrorByDivisionKey: ref<Record<string, string | null>>({}),
		initializationPromise: Promise.resolve(),
		toggleSeason: vi.fn(),
		toggleDivision: vi.fn(),
		toggleTeamsBranch: vi.fn(),
		toggleTeam: vi.fn(),
		executeDivisionLeafQuery: vi.fn(),
		executeTeamLeafQuery: vi.fn(),
		loadNextPage: vi.fn(),
		goToDirectQueryPage: vi.fn(),
		goToDirectQuerySort: vi.fn(),
	}),
}));

vi.mock("../src/features/lineup-lab/useLineupLabController", () => ({
	useLineupLabController: () => ({
		lineupDivisions: ref([]),
		lineupTeams: ref([]),
		lineupMatchups: ref([]),
		lineupRosterPlayers: ref([]),
		opponentRosterPlayers: computed(() => []),
		selectedDivisionId: ref(null),
		selectedTeamId: ref(null),
		selectedMatchupId: ref(null),
		selectedAvailablePlayerIds: ref([]),
		mode: ref("blind"),
		opponentAssignments: ref({}),
		recommendationResult: ref(null),
		isLoadingDivisions: ref(false),
		isLoadingTeams: ref(false),
		isLoadingMatchups: ref(false),
		isCalculating: ref(false),
		canCalculate: computed(() => false),
		knownOpponentCompletionError: computed(() => null),
		errorMessage: ref(null),
		selectLineupDivision: vi.fn(),
		selectLineupTeam: vi.fn(),
		selectLineupMatchup: vi.fn(),
		selectLineupPlayerAvailability: vi.fn(),
		setMode: vi.fn(),
		setOpponentSlotAssignment: vi.fn(),
		calculate: vi.fn(),
	}),
}));

import App from "../src/App.vue";
import { createAppRouter } from "../src/router";
import { useAuthStore } from "../src/stores/auth";

const createSessionFixture = () => ({
	expiresAt: Math.floor(Date.now() / 1000) + 60 * 30,
	user: {
		id: "user-123",
		email: "user@example.com",
	},
});

const mountRoutedApp = async (path: string) => {
	const pinia = createPinia();
	setActivePinia(pinia);
	const authStore = useAuthStore(pinia);
	authStore.status = "authenticated";
	authStore.session = createSessionFixture();
	vi.spyOn(authStore, "bootstrap").mockResolvedValue();

	const router = createAppRouter(pinia);
	await router.push(path);
	await router.isReady();

	const wrapper = mount(App, {
		global: {
			plugins: [pinia, router],
		},
	});

	return { wrapper, router };
};

describe("app tabs", () => {
	it("renders the routed protected shell with chat, data browser, and lineup lab tabs", async () => {
		const { wrapper, router } = await mountRoutedApp("/chat");

		expect(wrapper.find("[data-testid='top-tab-chat']").exists()).toBe(true);
		expect(wrapper.find("[data-testid='top-tab-data-browser']").exists()).toBe(
			true,
		);
		expect(wrapper.find("[data-testid='top-tab-lineup-lab']").exists()).toBe(
			true,
		);
		expect(wrapper.find("[data-testid='chat-shell']").exists()).toBe(true);
		expect(wrapper.find("[data-testid='data-browser-root']").exists()).toBe(
			false,
		);
		expect(wrapper.find("[data-testid='lineup-lab-root']").exists()).toBe(
			false,
		);

		await wrapper.get("[data-testid='top-tab-data-browser']").trigger("click");
		await vi.waitFor(() => {
			expect(router.currentRoute.value.path).toBe("/data-browser");
		});
		await nextTick();
		await vi.waitFor(() => {
			expect(wrapper.find("[data-testid='chat-shell']").exists()).toBe(false);
			expect(wrapper.find("[data-testid='data-browser-root']").exists()).toBe(
				true,
			);
			expect(wrapper.find("[data-testid='lineup-lab-root']").exists()).toBe(
				false,
			);
		});

		await wrapper.get("[data-testid='top-tab-lineup-lab']").trigger("click");
		await vi.waitFor(() => {
			expect(router.currentRoute.value.path).toBe("/lineup-lab");
		});
		await nextTick();
		await vi.waitFor(() => {
			expect(wrapper.find("[data-testid='data-browser-root']").exists()).toBe(
				false,
			);
			expect(wrapper.find("[data-testid='lineup-lab-root']").exists()).toBe(
				true,
			);
		});
	});

	it("defaults the protected shell to the chat route", async () => {
		const { router } = await mountRoutedApp("/");

		expect(router.currentRoute.value.path).toBe("/chat");
	});
});
