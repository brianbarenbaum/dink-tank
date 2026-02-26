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

export interface ChatClientAuthOptions {
	ensureAccessToken?: () => Promise<string | null>;
	refreshAfterUnauthorized?: () => Promise<boolean>;
	onAuthFailure?: () => void;
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
	authOptions?: ChatClientAuthOptions,
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

		const buildHeaders = async () => {
			const accessToken =
				(await authOptions?.ensureAccessToken?.()) ?? getAccessToken();
			return {
				"content-type": "application/json",
				...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
			};
		};
		const initialResponse = await fetchImpl("/api/chat", {
			method: "POST",
			headers: await buildHeaders(),
			body: JSON.stringify({ messages, options }),
		});
		const response =
			initialResponse.status === 401 && authOptions?.refreshAfterUnauthorized
				? (await authOptions.refreshAfterUnauthorized())
					? await fetchImpl("/api/chat", {
							method: "POST",
							headers: await buildHeaders(),
							body: JSON.stringify({ messages, options }),
						})
					: initialResponse
				: initialResponse;

		if (!response.ok) {
			if (response.status === 401) {
				authOptions?.onAuthFailure?.();
			}
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

		const buildHeaders = async () => {
			const accessToken =
				(await authOptions?.ensureAccessToken?.()) ?? getAccessToken();
			return {
				"content-type": "application/json",
				...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
			};
		};
		const initialResponse = await fetchImpl("/api/chat/config", {
			method: "GET",
			headers: await buildHeaders(),
		});
		const response =
			initialResponse.status === 401 && authOptions?.refreshAfterUnauthorized
				? (await authOptions.refreshAfterUnauthorized())
					? await fetchImpl("/api/chat/config", {
							method: "GET",
							headers: await buildHeaders(),
						})
					: initialResponse
				: initialResponse;

		if (!response.ok) {
			if (response.status === 401) {
				authOptions?.onAuthFailure?.();
			}
			throw new Error("Chat config request failed");
		}

		return (await response.json()) as ChatConfig;
	},
});
