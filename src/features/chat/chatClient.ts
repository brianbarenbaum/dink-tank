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

export const createChatClient = (
	fetchImpl: typeof fetch,
	getAccessToken: () => string | null,
): ChatClient => ({
	async send(messages) {
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
