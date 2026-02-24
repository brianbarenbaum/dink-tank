import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ChatShell from "../src/features/chat/components/ChatShell.vue";

describe("ChatShell", () => {
	it("renders sidebar, transcript, and composer landmarks", () => {
		const wrapper = mount(ChatShell);

		expect(wrapper.find("[data-testid='chat-sidebar']").exists()).toBe(true);
		expect(wrapper.find("[data-testid='chat-transcript']").exists()).toBe(true);
		expect(wrapper.find("[data-testid='chat-composer']").exists()).toBe(true);
		expect(wrapper.get("button[type='submit']").classes()).toContain(
			"cursor-pointer",
		);
		expect(wrapper.find("[data-testid='toggle-data-browser']").exists()).toBe(
			true,
		);
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
