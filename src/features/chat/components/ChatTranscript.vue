<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

import ChatMessageBubble from "./ChatMessageBubble.vue";

import type { ChatMessage } from "../types";

interface ChatTranscriptProps {
	messages: ChatMessage[];
	isSending?: boolean;
	selectedRecommendationId?: string | null;
}

const props = withDefaults(defineProps<ChatTranscriptProps>(), {
	isSending: false,
	selectedRecommendationId: null,
});
defineEmits<{
	selectRecommendation: [messageId: string];
	inspectRecommendation: [messageId: string];
}>();

const transcriptEl = ref<HTMLElement | null>(null);

watch(
	() => [props.messages.length, props.isSending],
	async () => {
		await nextTick();
		if (!transcriptEl.value) {
			return;
		}

		transcriptEl.value.scrollTop = transcriptEl.value.scrollHeight;
	},
	{ immediate: true, flush: "post" },
);
</script>

<template>
  <section
    ref="transcriptEl"
    data-testid="chat-transcript"
    class="chat-scrollbar relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-lg border p-4 md:p-6"
    aria-label="Chat transcript"
  >
    <ChatMessageBubble
      v-for="message in messages"
      :key="message.id"
      :message="message"
      :selected="props.selectedRecommendationId === message.id"
      @select-recommendation="$emit('selectRecommendation', $event)"
      @inspect-recommendation="$emit('inspectRecommendation', $event)"
    />
    <article
      v-if="props.isSending"
      class="chat-message-bubble chat-assistant-bubble flex max-w-2xl items-center gap-3 rounded-lg border p-4"
      aria-live="polite"
      aria-label="Assistant is typing"
    >
      <header class="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--chat-muted)]">
        Dink Tank
      </header>
      <span
        data-testid="assistant-loading-indicator"
        class="chat-loading-dot h-3 w-3 rounded-full"
      />
    </article>
  </section>
</template>
