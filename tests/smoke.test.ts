import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { computed, ref } from "vue";
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

const mountAppAt = async (path: string, authenticated: boolean) => {
	const pinia = createPinia();
	setActivePinia(pinia);
	const authStore = useAuthStore(pinia);
	vi.spyOn(authStore, "bootstrap").mockResolvedValue();

	if (authenticated) {
		authStore.status = "authenticated";
		authStore.session = createSessionFixture();
	} else {
		authStore.status = "unauthenticated";
		authStore.session = null;
	}

	const router = createAppRouter(pinia);
	await router.push(path);
	await router.isReady();

	return mount(App, {
		global: {
			plugins: [pinia, router],
		},
	});
};

describe("starter smoke", () => {
	it("renders the protected chat route landmarks for authenticated users", async () => {
		const wrapper = await mountAppAt("/chat", true);

		expect(wrapper.find("[data-testid='chat-shell']").exists()).toBe(true);
		expect(wrapper.find("[data-testid='chat-transcript']").exists()).toBe(true);
		expect(wrapper.find("[data-testid='chat-composer']").exists()).toBe(true);
	});

	it("redirects unauthenticated users to the login route", async () => {
		const wrapper = await mountAppAt("/chat", false);

		expect(wrapper.find("[data-testid='auth-email-input']").exists()).toBe(
			true,
		);
		expect(wrapper.find("[data-testid='chat-shell']").exists()).toBe(false);
	});
});
