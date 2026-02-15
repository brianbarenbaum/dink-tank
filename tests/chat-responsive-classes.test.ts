import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ChatShell from "../src/features/chat/components/ChatShell.vue";

describe("chat responsive layout", () => {
  it("uses desktop two-column and mobile single-column behavior", () => {
    const wrapper = mount(ChatShell);
    const classList = wrapper.attributes("class") ?? "";

    expect(classList.includes("grid-cols-1")).toBe(true);
    expect(classList.includes("lg:grid-cols-[18rem_1fr]")).toBe(true);

    expect(wrapper.find("[data-testid='mobile-sidebar-toggle']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='mobile-top-bar']").classes()).toContain("lg:hidden");
    expect(wrapper.find("[data-testid='mobile-sidebar']").classes()).toContain("chat-sidebar-surface");
  });
});
