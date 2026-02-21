import { describe, expect, it, vi } from "vitest";

import { createChatController } from "../src/features/chat/useChatController";

describe("chat controller", () => {
	it("adds user message and assistant reply from api", async () => {
		const send = vi.fn().mockResolvedValue({
			reply: "Try neutralizing from mid-court.",
			model: "gpt-5.1",
		});
		const controller = createChatController(send);

		await controller.submit("How to counter bangers?");

		expect(controller.messages.value.at(-2)?.role).toBe("user");
		expect(controller.messages.value.at(-1)?.role).toBe("assistant");
		expect(controller.modelLabel.value).toBe("gpt-5.1");
	});

	it("sends extended thinking option when enabled", async () => {
		const send = vi.fn().mockResolvedValue({ reply: "done", model: "gpt-5.1" });
		const controller = createChatController(send);
		controller.extendedThinking.value = true;

		await controller.submit("What are our playoff odds?");

		expect(send).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({ extendedThinking: true }),
		);
	});

	it("loads model label from backend config on init", async () => {
		const send = vi.fn().mockResolvedValue({ reply: "done", model: "gpt-5.1" });
		const getConfig = vi.fn().mockResolvedValue({ model: "gpt-5.1" });
		const controller = createChatController(send, getConfig);

		await Promise.resolve();

		expect(controller.modelLabel.value).toBe("gpt-5.1");
	});
});
