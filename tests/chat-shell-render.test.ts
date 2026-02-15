import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ChatShell from "../src/features/chat/components/ChatShell.vue";

describe("ChatShell", () => {
  it("renders sidebar, transcript, and composer landmarks", () => {
    const wrapper = mount(ChatShell);

    expect(wrapper.find("[data-testid='chat-sidebar']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='chat-transcript']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='chat-composer']").exists()).toBe(true);
  });
});
