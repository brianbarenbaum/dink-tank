import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { computed, nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/features/chat/useChatController", () => ({
	useChatController: () => ({
		messages: ref([]),
		isSending: ref(false),
		errorMessage: ref(null),
		modelLabel: ref("mock-model"),
		extendedThinking: ref(false),
		submit: vi.fn(),
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
	it("renders the routed protected shell and switches tabs via router navigation", async () => {
		const { wrapper, router } = await mountRoutedApp("/chat");

		expect(wrapper.find("[data-testid='top-tab-chat']").exists()).toBe(true);
		expect(wrapper.find("[data-testid='top-tab-lineup-lab']").exists()).toBe(
			true,
		);
		expect(wrapper.find("[data-testid='chat-shell']").exists()).toBe(true);
		expect(wrapper.find("[data-testid='lineup-lab-root']").exists()).toBe(
			false,
		);

		await wrapper.get("[data-testid='top-tab-lineup-lab']").trigger("click");
		await vi.waitFor(() => {
			expect(router.currentRoute.value.path).toBe("/lineup-lab");
		});
		await nextTick();
		await vi.waitFor(() => {
			expect(wrapper.find("[data-testid='chat-shell']").exists()).toBe(false);
			expect(wrapper.find("[data-testid='lineup-lab-root']").exists()).toBe(
				true,
			);
		});
	});
});
