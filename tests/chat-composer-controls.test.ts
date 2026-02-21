import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ChatShell from "../src/features/chat/components/ChatShell.vue";

describe("chat composer controls", () => {
	it("renders model label and extended thinking state next to it", async () => {
		const wrapper = mount(ChatShell, {
			props: {
				modelLabel: "gpt-5.1",
				extendedThinking: true,
			},
		});

		expect(wrapper.get("[data-testid='chat-model-label']").text()).toContain(
			"gpt-5.1",
		);
		expect(wrapper.get("[data-testid='chat-model-label']").text()).toContain(
			"Extended thinking on",
		);
	});

	it("opens model menu and toggles extended thinking", async () => {
		const wrapper = mount(ChatShell, {
			props: {
				modelLabel: "gpt-5.1",
				extendedThinking: false,
			},
		});

		await wrapper.get("[data-testid='chat-model-label']").trigger("click");
		expect(wrapper.get("[data-testid='model-menu']").isVisible()).toBe(true);

		await wrapper
			.get("[data-testid='toggle-extended-thinking']")
			.trigger("click");
		expect(wrapper.emitted("update:extended-thinking")?.[0]).toEqual([true]);
	});

	it("shows a dropdown caret on the model control", () => {
		const wrapper = mount(ChatShell, {
			props: {
				modelLabel: "gpt-5.1",
			},
		});

		expect(wrapper.find("[data-testid='model-menu-caret']").exists()).toBe(true);
	});
});
