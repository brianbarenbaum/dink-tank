import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import App from "../src/App.vue";

describe("starter smoke", () => {
	it("renders starter headline", () => {
		const wrapper = mount(App);
		expect(wrapper.get("h1").text()).toBe("Codex Vue Starter");
	});
});
