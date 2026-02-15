import { defineStore } from "pinia";

import type { ChatMessage } from "../features/chat/types";

const seedMessage: ChatMessage = {
  id: "seed-assistant",
  role: "assistant",
  content: "Welcome back, Captain. Ask for any stat or lineup insight.",
  createdAt: new Date(0).toISOString(),
};

export const useChatSessionStore = defineStore("chatSession", {
  state: () => ({
    messages: [seedMessage] as ChatMessage[],
    isSending: false,
  }),
  actions: {
    addUserMessage(content: string) {
      this.messages.push({
        id: crypto.randomUUID(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      });
    },
    addAssistantMessage(content: string) {
      this.messages.push({
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        createdAt: new Date().toISOString(),
      });
    },
    setSending(value: boolean) {
      this.isSending = value;
    },
  },
});
