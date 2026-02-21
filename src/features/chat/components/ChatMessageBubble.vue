<script setup lang="ts">
import { computed } from "vue";

import { formatChatMessageContent } from "../formatMessageContent";
import type { ChatMessage } from "../types";

interface ChatMessageBubbleProps {
	message: ChatMessage;
}

const props = defineProps<ChatMessageBubbleProps>();

const isUser = computed(() => props.message.role === "user");
const label = computed(() => (isUser.value ? "You" : "Dink Tank"));
const renderedContent = computed(() =>
	formatChatMessageContent(props.message.content),
);
</script>

<template>
  <article
    class="chat-message-bubble flex max-w-2xl flex-col gap-2 rounded-lg border p-4"
    :class="isUser ? 'ml-auto chat-user-bubble' : 'chat-assistant-bubble'"
  >
    <header class="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--chat-muted)]">
      {{ label }}
    </header>
    <div
      class="chat-markdown text-sm leading-relaxed text-[var(--chat-text)]"
      v-html="renderedContent"
    />
  </article>
</template>
