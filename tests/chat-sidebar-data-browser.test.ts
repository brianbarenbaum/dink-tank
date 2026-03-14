import { mount } from "@vue/test-utils";
import { computed, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import ChatSidebarContent from "../src/features/chat/components/ChatSidebarContent.vue";
import DataBrowserSidebarContent from "../src/features/data-browser/components/DataBrowserSidebarContent.vue";

const createControllerDouble = () => {
	const seasons = ref([
		{ seasonYear: 2025, seasonNumber: 3, label: "2025 S3" },
		{ seasonYear: 2024, seasonNumber: 2, label: "2024 S2" },
	]);
	const divisionsBySeasonKey = ref({
		"2025:3": [
			{
				divisionId: "11111111-1111-4111-8111-111111111111",
				divisionName: "3.5",
				seasonYear: 2025,
				seasonNumber: 3,
				location: "NJ / PA",
			},
		],
		"2024:2": [
			{
				divisionId: "33333333-3333-4333-8333-333333333333",
				divisionName: "4.0",
				seasonYear: 2024,
				seasonNumber: 2,
				location: "NJ / PA",
			},
		],
	});
	const teamsByDivisionKey = ref({
		"2025:3:11111111-1111-4111-8111-111111111111": [
			{
				teamId: "22222222-2222-4222-8222-222222222222",
				teamName: "Drop Shotters",
			},
		],
	});
	const expandedSeasonKeys = ref(new Set<string>());
	const expandedDivisionKeys = ref(new Set<string>());
	const expandedTeamKeys = ref(new Set<string>());

	const toggleSetKey = (
		target: typeof expandedSeasonKeys.value,
		key: string,
	) => {
		const next = new Set(target);
		if (next.has(key)) {
			next.delete(key);
		} else {
			next.add(key);
		}
		return next;
	};

	return {
		seasons,
		divisionsBySeasonKey,
		teamsByDivisionKey,
		expandedSeasonKeys,
		expandedDivisionKeys,
		expandedTeamKeys,
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
		toggleSeason: vi.fn(async (seasonKey: string) => {
			expandedSeasonKeys.value = toggleSetKey(
				expandedSeasonKeys.value,
				seasonKey,
			);
		}),
		toggleDivision: vi.fn(
			async (input: { seasonKey: string; divisionId: string }) => {
				const key = `${input.seasonKey}:${input.divisionId}`;
				expandedDivisionKeys.value = toggleSetKey(
					expandedDivisionKeys.value,
					key,
				);
			},
		),
		toggleTeamsBranch: vi.fn(
			async (input: { seasonKey: string; divisionId: string }) => {
				const key = `${input.seasonKey}:${input.divisionId}:teams`;
				expandedTeamKeys.value = toggleSetKey(expandedTeamKeys.value, key);
			},
		),
		toggleTeam: vi.fn(
			(input: { seasonKey: string; divisionId: string; teamId: string }) => {
				const key = `${input.seasonKey}:${input.divisionId}:team:${input.teamId}`;
				expandedTeamKeys.value = toggleSetKey(expandedTeamKeys.value, key);
			},
		),
		executeDivisionLeafQuery: vi.fn(),
		executeTeamLeafQuery: vi.fn(),
		loadNextPage: vi.fn(),
		goToDirectQueryPage: vi.fn(),
		goToDirectQuerySort: vi.fn(),
	};
};

describe("chat and data browser sidebars", () => {
	it("keeps the chat sidebar chat-only", () => {
		const wrapper = mount(ChatSidebarContent);

		expect(wrapper.find("[data-testid='desktop-new-chat']").exists()).toBe(
			true,
		);
		expect(wrapper.find("[data-testid='toggle-data-browser']").exists()).toBe(
			false,
		);
		expect(wrapper.find("[data-testid='data-browser-tree']").exists()).toBe(
			false,
		);
	});

	it("rotates tree carets from right when closed to down-right when open", async () => {
		const controller = createControllerDouble();
		const wrapper = mount(DataBrowserSidebarContent, {
			props: {
				controller,
			},
		});

		const seasonButton = wrapper.get(
			"[data-testid='data-browser-season-2025-3']",
		);
		const seasonChevron = seasonButton.get(".lucide-chevron-down");

		expect(seasonChevron.classes()).toEqual(
			expect.arrayContaining(["-rotate-90"]),
		);
		expect(seasonChevron.classes()).not.toEqual(
			expect.arrayContaining(["-rotate-45"]),
		);

		await seasonButton.trigger("click");

		expect(seasonChevron.classes()).toEqual(
			expect.arrayContaining(["-rotate-45"]),
		);
		expect(seasonChevron.classes()).not.toEqual(
			expect.arrayContaining(["-rotate-90"]),
		);
	});

	it("renders the dedicated data browser tree in an independently scrollable region", () => {
		const controller = createControllerDouble();
		const wrapper = mount(DataBrowserSidebarContent, {
			props: {
				controller,
			},
		});

		expect(
			wrapper.get("[data-testid='data-browser-sidebar-content']").classes(),
		).toEqual(
			expect.arrayContaining(["flex", "min-h-0", "flex-1", "overflow-hidden"]),
		);
		expect(
			wrapper
				.get("[data-testid='data-browser-sidebar-scroll-region']")
				.classes(),
		).toEqual(
			expect.arrayContaining([
				"chat-scrollbar",
				"min-h-0",
				"flex-1",
				"overflow-y-auto",
			]),
		);
		expect(wrapper.find("[data-testid='toggle-data-browser']").exists()).toBe(
			false,
		);
	});

	it("renders the real data browser tree hierarchy", async () => {
		const controller = createControllerDouble();
		const wrapper = mount(DataBrowserSidebarContent, {
			props: {
				controller,
			},
		});

		expect(
			wrapper.find("[data-testid='data-browser-season-2025-3']").exists(),
		).toBe(true);

		await wrapper
			.get("[data-testid='data-browser-season-2025-3']")
			.trigger("click");
		expect(
			wrapper
				.find(
					"[data-testid='data-browser-division-11111111-1111-4111-8111-111111111111']",
				)
				.exists(),
		).toBe(true);

		await wrapper
			.get(
				"[data-testid='data-browser-division-11111111-1111-4111-8111-111111111111']",
			)
			.trigger("click");

		expect(
			wrapper
				.find(
					"[data-testid='data-browser-leaf-division_players-11111111-1111-4111-8111-111111111111']",
				)
				.exists(),
		).toBe(true);
		expect(
			wrapper
				.find(
					"[data-testid='data-browser-leaf-division_standings-11111111-1111-4111-8111-111111111111']",
				)
				.exists(),
		).toBe(true);
		expect(
			wrapper
				.find(
					"[data-testid='data-browser-teams-branch-11111111-1111-4111-8111-111111111111']",
				)
				.exists(),
		).toBe(true);

		await wrapper
			.get(
				"[data-testid='data-browser-teams-branch-11111111-1111-4111-8111-111111111111']",
			)
			.trigger("click");
		expect(
			wrapper
				.find(
					"[data-testid='data-browser-team-22222222-2222-4222-8222-222222222222']",
				)
				.exists(),
		).toBe(true);

		await wrapper
			.get(
				"[data-testid='data-browser-team-22222222-2222-4222-8222-222222222222']",
			)
			.trigger("click");

		expect(
			wrapper
				.find(
					"[data-testid='data-browser-leaf-team_overview-22222222-2222-4222-8222-222222222222']",
				)
				.exists(),
		).toBe(true);
		expect(
			wrapper
				.find(
					"[data-testid='data-browser-leaf-team_players-22222222-2222-4222-8222-222222222222']",
				)
				.exists(),
		).toBe(true);
		expect(
			wrapper
				.find(
					"[data-testid='data-browser-leaf-team_schedule-22222222-2222-4222-8222-222222222222']",
				)
				.exists(),
		).toBe(true);
	});
});
