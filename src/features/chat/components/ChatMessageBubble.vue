<script setup lang="ts">
import { computed } from "vue";

import LineupRecommendationCard from "./LineupRecommendationCard.vue";
import { formatChatMessageContent } from "../formatMessageContent";
import type { ChatMessage } from "../types";

interface ChatMessageBubbleProps {
	message: ChatMessage;
	selected?: boolean;
}

const props = defineProps<ChatMessageBubbleProps>();
defineEmits<{
	selectRecommendation: [messageId: string];
	inspectRecommendation: [messageId: string];
}>();

const isUser = computed(() => props.message.role === "user");
const label = computed(() => (isUser.value ? "You" : "Dink Tank"));
const renderedContent = computed(() =>
	formatChatMessageContent(props.message.content),
);
const isRecommendation = computed(
	() =>
		props.message.kind === "lineup_recommendation" &&
		Boolean(props.message.lineupRecommendation),
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
    <p
      v-if="props.message.explorer?.pathLabel"
      class="text-[10px] uppercase tracking-[0.16em] text-[var(--chat-muted)]"
    >
      {{ props.message.explorer.pathLabel }}
    </p>
    <LineupRecommendationCard
      v-if="isRecommendation && props.message.lineupRecommendation"
      :payload="props.message.lineupRecommendation"
      :selected="Boolean(props.selected)"
      @select="$emit('selectRecommendation', props.message.id)"
      @inspect="$emit('inspectRecommendation', props.message.id)"
    />
    <div
      v-else
      class="chat-markdown text-sm leading-relaxed text-[var(--chat-text)]"
      v-html="renderedContent"
    />
  </article>
</template>
