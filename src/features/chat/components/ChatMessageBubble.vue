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
    <div class="chat-markdown text-sm leading-relaxed text-[var(--chat-text)]">
      <template
        v-for="(block, blockIndex) in renderedContent"
        :key="`block-${blockIndex}`"
      >
        <p
          v-if="block.kind === 'paragraph'"
          class="chat-markdown__paragraph"
        >
          <template
            v-for="(line, lineIndex) in block.lines"
            :key="`line-${lineIndex}`"
          >
            <template
              v-for="(run, runIndex) in line"
              :key="`run-${lineIndex}-${runIndex}`"
            >
              <strong v-if="run.kind === 'strong'">{{ run.text }}</strong>
              <em v-else-if="run.kind === 'em'">{{ run.text }}</em>
              <code v-else-if="run.kind === 'code'">{{ run.text }}</code>
              <span v-else>{{ run.text }}</span>
            </template>
            <br v-if="lineIndex < block.lines.length - 1">
          </template>
        </p>
        <ul
          v-else
          class="chat-markdown__list"
        >
          <li
            v-for="(line, lineIndex) in block.lines"
            :key="`item-${lineIndex}`"
          >
            <template
              v-for="(run, runIndex) in line"
              :key="`item-run-${lineIndex}-${runIndex}`"
            >
              <strong v-if="run.kind === 'strong'">{{ run.text }}</strong>
              <em v-else-if="run.kind === 'em'">{{ run.text }}</em>
              <code v-else-if="run.kind === 'code'">{{ run.text }}</code>
              <span v-else>{{ run.text }}</span>
            </template>
          </li>
        </ul>
      </template>
    </div>
  </article>
</template>
