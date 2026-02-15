import { ref, type Ref } from "vue";

import { createChatClient, type ChatSendMessage } from "./chatClient";
import type { ChatMessage } from "./types";

export interface ChatController {
  messages: Ref<ChatMessage[]>;
  isSending: Ref<boolean>;
  errorMessage: Ref<string | null>;
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
  send: (messages: ChatSendMessage[]) => Promise<{ reply: string }>,
): ChatController {
  const messages = ref<ChatMessage[]>([...seedMessages]);
  const isSending = ref(false);
  const errorMessage = ref<string | null>(null);

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
      const response = await send(payload);

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

  return {
    messages,
    isSending,
    errorMessage,
    submit,
  };
}

export function useChatController(): ChatController {
  const client = createChatClient(fetch, () => null);
  return createChatController(client.send);
}
