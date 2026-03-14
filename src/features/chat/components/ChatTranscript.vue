<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

import DirectQueryCard from "./DirectQueryCard.vue";
import DirectQueryTableCard from "./DirectQueryTableCard.vue";
import ChatMessageBubble from "./ChatMessageBubble.vue";

import type { ChatTranscriptItem, DirectQueryCardItem } from "../types";

interface ChatTranscriptProps {
	messages: ChatTranscriptItem[];
	isSending?: boolean;
	onDirectQueryPageChange?: (
		card: DirectQueryCardItem,
		page: number,
	) => Promise<void> | void;
	onDirectQuerySortChange?: (
		card: DirectQueryCardItem,
		sortKey: string,
	) => Promise<void> | void;
}

const props = withDefaults(defineProps<ChatTranscriptProps>(), {
	isSending: false,
});

const transcriptEl = ref<HTMLElement | null>(null);

const isDirectQueryCardItem = (
	message: ChatTranscriptItem,
): message is DirectQueryCardItem => "kind" in message;

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
    <template
      v-for="message in messages"
      :key="message.id"
    >
      <DirectQueryTableCard
        v-if="isDirectQueryCardItem(message) && message.layout === 'table'"
        :card="message"
        @paginate="(page) => void props.onDirectQueryPageChange?.(message, page)"
        @sort="(sortKey) => void props.onDirectQuerySortChange?.(message, sortKey)"
      />
      <DirectQueryCard
        v-else-if="isDirectQueryCardItem(message)"
        :card="message"
      >
        <p class="text-sm text-[var(--chat-muted)]">
          Result ready.
        </p>
      </DirectQueryCard>
      <ChatMessageBubble
        v-else
        :message="message"
      />
    </template>
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
