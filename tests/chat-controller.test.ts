import { describe, expect, it, vi } from "vitest";

import { createChatController } from "../src/features/chat/useChatController";

describe("chat controller", () => {
  it("adds user message and assistant reply from api", async () => {
    const send = vi.fn().mockResolvedValue({ reply: "Try neutralizing from mid-court." });
    const controller = createChatController(send);

    await controller.submit("How to counter bangers?");

    expect(controller.messages.value.at(-2)?.role).toBe("user");
    expect(controller.messages.value.at(-1)?.role).toBe("assistant");
  });
});
