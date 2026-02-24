import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import ChatShell from "../src/features/chat/components/ChatShell.vue";

describe("chat responsive layout", () => {
	it("uses desktop two-column and mobile single-column behavior", () => {
		const wrapper = mount(ChatShell);
		const classList = wrapper.attributes("class") ?? "";

		expect(classList.includes("grid-cols-1")).toBe(true);
		expect(classList.includes("lg:grid-cols-[18rem_1fr]")).toBe(true);

		expect(wrapper.find("[data-testid='mobile-sidebar-toggle']").exists()).toBe(
			true,
		);
		expect(wrapper.find("[data-testid='mobile-top-bar']").classes()).toContain(
			"lg:hidden",
		);
		expect(wrapper.find("[data-testid='mobile-sidebar']").classes()).toContain(
			"chat-sidebar-surface",
		);
		expect(wrapper.find("[data-testid='mobile-new-chat']").exists()).toBe(true);
		expect(wrapper.find("[data-testid='mobile-close-sidebar']").exists()).toBe(
			true,
		);
	});

	it("allows desktop sidebar collapse and reopen", async () => {
		const wrapper = mount(ChatShell);

		expect(wrapper.attributes("class")).toContain("lg:grid-cols-[18rem_1fr]");
		expect(
			wrapper.find("[data-testid='desktop-sidebar-close-icon']").exists(),
		).toBe(true);
		expect(
			wrapper
				.get("[data-testid='desktop-sidebar-close-icon']")
				.attributes("title"),
		).toBe("Collapse sidebar");
		expect(
			wrapper.get("[data-testid='desktop-sidebar-close-icon']").classes(),
		).toContain("cursor-pointer");

		await wrapper
			.get("[data-testid='desktop-sidebar-close-icon']")
			.trigger("click");
		await nextTick();

		expect(wrapper.attributes("class")).toContain("lg:grid-cols-[3rem_1fr]");
		expect(wrapper.find("[data-testid='desktop-sidebar-rail']").exists()).toBe(
			true,
		);
		expect(
			wrapper.find("[data-testid='desktop-sidebar-open-icon']").exists(),
		).toBe(true);
		expect(wrapper.find("[data-testid='desktop-rail-new-chat']").exists()).toBe(
			true,
		);
		expect(
			wrapper
				.get("[data-testid='desktop-sidebar-open-icon']")
				.attributes("title"),
		).toBe("Expand sidebar");
		expect(
			wrapper.get("[data-testid='desktop-rail-new-chat']").attributes("title"),
		).toBe("New chat");

		await wrapper
			.get("[data-testid='desktop-sidebar-open-icon']")
			.trigger("click");
		await nextTick();

		expect(wrapper.attributes("class")).toContain("lg:grid-cols-[18rem_1fr]");
	});
});
