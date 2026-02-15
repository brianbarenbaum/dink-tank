import { describe, expect, it, vi } from "vitest";

import { createChatClient } from "../src/features/chat/chatClient";

describe("chatClient", () => {
	it("posts to /api/chat with messages body", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ reply: "Team A has 62% win rate." }),
		});

		const client = createChatClient(
			fetchMock as unknown as typeof fetch,
			() => "token-123",
		);
		await client.send([{ role: "user", content: "Show win rate." }]);

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/chat",
			expect.objectContaining({ method: "POST" }),
		);
	});
});
