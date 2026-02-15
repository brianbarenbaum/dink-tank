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

	it("returns a canned mock reply when mode is mock", async () => {
		const fetchMock = vi.fn();
		const client = createChatClient(
			fetchMock as unknown as typeof fetch,
			() => "token-123",
			{ mode: "mock" },
		);

		const response = await client.send([
			{ role: "user", content: "Show me win rate trends." },
		]);

		expect(response.reply).toContain("win rate");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("uses custom mock replies when provided", async () => {
		const fetchMock = vi.fn();
		const client = createChatClient(
			fetchMock as unknown as typeof fetch,
			() => null,
			{ mode: "mock", mockReplies: ["custom mock"] },
		);

		const response = await client.send([{ role: "user", content: "Anything" }]);

		expect(response).toEqual({ reply: "custom mock" });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
