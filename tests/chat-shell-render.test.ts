import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ChatShell from "../src/features/chat/components/ChatShell.vue";

describe("ChatShell", () => {
	it("renders sidebar, transcript, and composer landmarks", async () => {
		const wrapper = mount(ChatShell);

		expect(wrapper.find("[data-testid='chat-sidebar']").exists()).toBe(true);
		expect(wrapper.find("[data-testid='chat-transcript']").exists()).toBe(true);
		expect(wrapper.find("[data-testid='chat-composer']").exists()).toBe(true);
		expect(wrapper.get("button[type='submit']").classes()).toContain(
			"cursor-pointer",
		);
		const lineupLabToggle = wrapper.get("[data-testid='toggle-lineup-lab']");
		expect(lineupLabToggle.attributes("aria-expanded")).toBe("false");
		expect(
			wrapper.find("[data-testid='explorer-calculate-pairings']").exists(),
		).toBe(false);
		expect(wrapper.find("[data-testid='toggle-data-browser']").exists()).toBe(
			true,
		);
		expect(wrapper.text()).not.toContain("What-If Simulator");
		expect(wrapper.text()).not.toContain("Historical Analysis");
		expect(wrapper.text()).not.toContain("Scout Opponent");
		await lineupLabToggle.trigger("click");
		expect(lineupLabToggle.attributes("aria-expanded")).toBe("true");
		expect(
			wrapper.find("[data-testid='explorer-calculate-pairings']").exists(),
		).toBe(true);
		expect(
			wrapper.get("[data-testid='explorer-calculate-pairings']").classes(),
		).not.toContain("w-full");
		expect(wrapper.text()).not.toContain("Your Chats");
	});

	it("shows lineup loading spinners while team and matchup options are loading", async () => {
		const wrapper = mount(ChatShell, {
			props: {
				isLoadingTeams: true,
				isLoadingMatchups: true,
			},
		});

		const lineupLabToggle = wrapper.get("[data-testid='toggle-lineup-lab']");
		await lineupLabToggle.trigger("click");

		expect(
			wrapper.find("[data-testid='lineup-team-loading-spinner']").exists(),
		).toBe(true);
		expect(
			wrapper.find("[data-testid='lineup-matchup-loading-spinner']").exists(),
		).toBe(true);
	});

	it("keeps transcript scrollable while composer stays visible", () => {
		const wrapper = mount(ChatShell);

		expect(wrapper.get("[data-testid='chat-main']").classes()).toContain(
			"overflow-hidden",
		);
		expect(wrapper.get("[data-testid='chat-transcript']").classes()).toContain(
			"overflow-y-auto",
		);
		expect(wrapper.get("[data-testid='chat-transcript']").classes()).toContain(
			"chat-scrollbar",
		);
		expect(wrapper.get("[data-testid='chat-transcript']").classes()).toContain(
			"min-h-0",
		);
		expect(wrapper.get("[data-testid='chat-composer']").classes()).toContain(
			"sticky",
		);
	});

	it("shows a pulsing assistant indicator while waiting for a reply", () => {
		const wrapper = mount(ChatShell, {
			props: {
				isSending: true,
			},
		});

		expect(
			wrapper.find("[data-testid='assistant-loading-indicator']").exists(),
		).toBe(true);
		expect(
			wrapper.get("[data-testid='assistant-loading-indicator']").classes(),
		).toContain("chat-loading-dot");
	});
});
