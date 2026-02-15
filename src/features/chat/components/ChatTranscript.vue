<script setup lang="ts">
import ChatMessageBubble from "./ChatMessageBubble.vue";

import type { ChatMessage } from "../types";

interface ChatTranscriptProps {
  messages: ChatMessage[];
}

defineProps<ChatTranscriptProps>();
</script>

<template>
  <section
    data-testid="chat-transcript"
    class="chat-scanline relative flex min-h-[420px] flex-1 flex-col gap-4 overflow-y-auto rounded-lg border p-4 md:p-6"
    aria-label="Chat transcript"
  >
    <ChatMessageBubble
      v-for="message in messages"
      :key="message.id"
      :message="message"
    />
  </section>
</template>
