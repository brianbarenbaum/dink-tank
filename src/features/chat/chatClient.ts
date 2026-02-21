export interface ChatSendMessage {
	role: "user" | "assistant";
	content: string;
}

export interface ChatSendOptions {
	extendedThinking?: boolean;
}

export interface ChatReply {
	reply: string;
	model: string;
	extendedThinking: boolean;
}

export interface ChatConfig {
	model: string;
	defaultReasoningLevel: "low" | "medium" | "high";
}

export interface ChatClient {
	send(
		messages: ChatSendMessage[],
		options?: ChatSendOptions,
	): Promise<ChatReply>;
	getConfig(): Promise<ChatConfig>;
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
	clientOptions: ChatClientOptions = {},
): ChatClient => ({
	async send(messages, options) {
		if (clientOptions.mode === "mock") {
			return {
				reply: pickMockReply(
					messages,
					clientOptions.mockReplies ?? DEFAULT_MOCK_REPLIES,
				),
				model: "mock-model",
				extendedThinking: Boolean(options?.extendedThinking),
			};
		}

		const accessToken = getAccessToken();
		const response = await fetchImpl("/api/chat", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
			},
			body: JSON.stringify({ messages, options }),
		});

		if (!response.ok) {
			throw new Error("Chat request failed");
		}

		return (await response.json()) as ChatReply;
	},
	async getConfig() {
		if (clientOptions.mode === "mock") {
			return {
				model: "mock-model",
				defaultReasoningLevel: "medium",
			};
		}

		const accessToken = getAccessToken();
		const response = await fetchImpl("/api/chat/config", {
			method: "GET",
			headers: {
				"content-type": "application/json",
				...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
			},
		});

		if (!response.ok) {
			throw new Error("Chat config request failed");
		}

		return (await response.json()) as ChatConfig;
	},
});
