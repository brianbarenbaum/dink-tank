import { ref, type Ref } from "vue";

import {
	createChatClient,
	type ChatBackendMode,
	type ChatSendMessage,
	type ChatSendOptions,
} from "./chatClient";
import type { ChatMessage } from "./types";

export interface ChatController {
	messages: Ref<ChatMessage[]>;
	isSending: Ref<boolean>;
	errorMessage: Ref<string | null>;
	modelLabel: Ref<string>;
	extendedThinking: Ref<boolean>;
	submit: (value: string) => Promise<void>;
}

const seedMessages: ChatMessage[] = [
	{
		id: "seed-assistant",
		role: "assistant",
		content: "Welcome back, Captain.  What do you need help with today?",
		createdAt: new Date(0).toISOString(),
	},
];

export function createChatController(
	send: (
		messages: ChatSendMessage[],
		options?: ChatSendOptions,
	) => Promise<{ reply: string; model: string }>,
	getConfig?: () => Promise<{ model: string }>,
): ChatController {
	const messages = ref<ChatMessage[]>([...seedMessages]);
	const isSending = ref(false);
	const errorMessage = ref<string | null>(null);
	const modelLabel = ref("Unknown model");
	const extendedThinking = ref(false);

	const submit = async (value: string) => {
		const content = value.trim();
		if (!content || isSending.value) {
			return;
		}

		const userMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: "user",
			content,
			createdAt: new Date().toISOString(),
		};

		messages.value.push(userMessage);
		isSending.value = true;
		errorMessage.value = null;

		try {
			const payload = messages.value
				.filter(
					(message): message is ChatMessage & { role: "assistant" | "user" } =>
						message.role === "assistant" || message.role === "user",
				)
				.map((message) => ({ role: message.role, content: message.content }));
			const requestOptions = {
				extendedThinking: extendedThinking.value,
			};
			const response = await send(payload, requestOptions);
			modelLabel.value = response.model;

			const assistantMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: "assistant",
				content: response.reply,
				createdAt: new Date().toISOString(),
			};
			messages.value.push(assistantMessage);
		} catch {
			errorMessage.value = "Unable to reach the chat service. Try again.";
		} finally {
			isSending.value = false;
		}
	};

	void getConfig?.()
		.then((config) => {
			modelLabel.value = config.model;
		})
		.catch(() => {});

	return {
		messages,
		isSending,
		errorMessage,
		modelLabel,
		extendedThinking,
		submit,
	};
}

export function useChatController(): ChatController {
	const backendMode: ChatBackendMode =
		import.meta.env.VITE_CHAT_BACKEND_MODE === "mock" ? "mock" : "real";
	const client = createChatClient(fetch, () => null, { mode: backendMode });
	return createChatController(client.send, client.getConfig);
}
