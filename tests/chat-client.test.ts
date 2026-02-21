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

	it("includes extended thinking option in request payload", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ reply: "ok", model: "gpt-5.1" }),
		});

		const client = createChatClient(
			fetchMock as unknown as typeof fetch,
			() => null,
		);
		await client.send([{ role: "user", content: "Show standings." }], {
			extendedThinking: true,
		});

		const requestBody = JSON.parse(
			(fetchMock.mock.calls[0]?.[1] as { body?: string })?.body ?? "{}",
		) as { options?: { extendedThinking?: boolean } };
		expect(requestBody.options?.extendedThinking).toBe(true);
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

		expect(response).toEqual({
			reply: "custom mock",
			model: "mock-model",
			extendedThinking: false,
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("fetches model config from backend", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				model: "gpt-5.1",
				defaultReasoningLevel: "medium",
			}),
		});
		const client = createChatClient(
			fetchMock as unknown as typeof fetch,
			() => null,
		);

		const config = await client.getConfig();

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/chat/config",
			expect.objectContaining({ method: "GET" }),
		);
		expect(config.model).toBe("gpt-5.1");
	});

});
