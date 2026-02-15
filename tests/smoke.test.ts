import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import App from "../src/App.vue";

describe("starter smoke", () => {
	it("renders chat shell landmarks", () => {
		const wrapper = mount(App);
		expect(wrapper.find("[data-testid='chat-shell']").exists()).toBe(true);
		expect(wrapper.find("[data-testid='chat-transcript']").exists()).toBe(true);
		expect(wrapper.find("[data-testid='chat-composer']").exists()).toBe(true);
	});
});
