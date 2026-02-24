import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import App from "../src/App.vue";

describe("app tabs", () => {
	it("defaults to chat and switches to lineup lab", async () => {
		const wrapper = mount(App);

		expect(wrapper.find("[data-testid='top-tab-chat']").exists()).toBe(true);
		expect(wrapper.find("[data-testid='top-tab-lineup-lab']").exists()).toBe(
			true,
		);
		expect(wrapper.find("[data-testid='chat-shell']").exists()).toBe(true);
		expect(wrapper.find("[data-testid='lineup-lab-root']").exists()).toBe(false);

		await wrapper.get("[data-testid='top-tab-lineup-lab']").trigger("click");

		expect(wrapper.find("[data-testid='chat-shell']").exists()).toBe(false);
		expect(wrapper.find("[data-testid='lineup-lab-root']").exists()).toBe(true);
	});
});
