export interface ChatSendMessage {
	role: "user" | "assistant";
	content: string;
}

export interface ChatReply {
	reply: string;
}

export interface ChatClient {
	send(messages: ChatSendMessage[]): Promise<ChatReply>;
}

export type ChatBackendMode = "real" | "mock";

export interface ChatClientOptions {
	mode?: ChatBackendMode;
	mockReplies?: readonly string[];
}

const DEFAULT_MOCK_REPLIES = [
	"Mock scouting snapshot: home-side win rate is 62% over the last 10 games.",
	"Mock lineup check: rotate your secondary handler in earlier to stabilize possessions.",
	"Mock matchup note: target the right corner where opponents are allowing high-quality looks.",
];

const getLatestUserMessage = (messages: ChatSendMessage[]): string =>
	[...messages]
		.reverse()
		.find((message) => message.role === "user")
		?.content.toLowerCase() ?? "";

const pickMockReply = (
	messages: ChatSendMessage[],
	mockReplies: readonly string[],
): string => {
	if (mockReplies.length === 0) {
		return "Mock response is enabled, but no mock replies are configured.";
	}

	const latestUserMessage = getLatestUserMessage(messages);
	if (latestUserMessage.includes("win")) {
		return "Mock scouting snapshot: home-side win rate is 62% over the last 10 games.";
	}
	if (
		latestUserMessage.includes("lineup") ||
		latestUserMessage.includes("roster")
	) {
		return "Mock lineup check: rotate your secondary handler in earlier to stabilize possessions.";
	}

	return mockReplies[0];
};

export const createChatClient = (
	fetchImpl: typeof fetch,
	getAccessToken: () => string | null,
	options: ChatClientOptions = {},
): ChatClient => ({
	async send(messages) {
		if (options.mode === "mock") {
			return {
				reply: pickMockReply(
					messages,
					options.mockReplies ?? DEFAULT_MOCK_REPLIES,
				),
			};
		}

		const accessToken = getAccessToken();
		const response = await fetchImpl("/api/chat", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
			},
			body: JSON.stringify({ messages }),
		});

		if (!response.ok) {
			throw new Error("Chat request failed");
		}

		return (await response.json()) as ChatReply;
	},
});
