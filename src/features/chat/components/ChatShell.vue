<script setup lang="ts">
import { ref } from "vue";

import ChatComposer from "./ChatComposer.vue";
import ChatSidebar from "./ChatSidebar.vue";
import ChatTranscript from "./ChatTranscript.vue";

import type { ChatMessage } from "../types";

interface ChatShellProps {
  messages?: ChatMessage[];
  isSending?: boolean;
}

const props = withDefaults(defineProps<ChatShellProps>(), {
  messages: () => [
    {
      id: "seed-assistant",
      role: "assistant",
      content:
        "Welcome back, Coach. Database synced. Match results from the weekend tournament processed.",
      createdAt: new Date(0).toISOString(),
    },
    {
      id: "seed-user",
      role: "user",
      content: "Show me the pickleball win/loss ratios for Team A.",
      createdAt: new Date(0).toISOString(),
    },
  ],
  isSending: false,
});

const emit = defineEmits<{
  submit: [value: string];
}>();

const mobileSidebarOpen = ref(false);
</script>

<template>
  <main
    data-testid="chat-shell"
    class="chat-root grid min-h-screen grid-cols-1 lg:grid-cols-[18rem_1fr]"
  >
    <ChatSidebar />

    <div
      v-if="mobileSidebarOpen"
      class="fixed inset-0 z-30 bg-black/50 lg:hidden"
      @click="mobileSidebarOpen = false"
    />
    <ChatSidebar
      mobile
      :open="mobileSidebarOpen"
      @close="mobileSidebarOpen = false"
    />

    <section class="flex min-h-screen flex-col gap-4 p-3 md:p-4 lg:p-6">
      <header class="flex items-center justify-between rounded-lg border px-4 py-3">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="h-11 rounded-md border px-3 text-xs font-semibold uppercase tracking-wide lg:hidden"
            data-testid="mobile-sidebar-toggle"
            aria-label="Open sidebar"
            @click="mobileSidebarOpen = true"
          >
            Menu
          </button>
          <p class="text-xs font-semibold uppercase tracking-[0.22em]">Dink Tank AI</p>
        </div>
        <p class="text-xs uppercase tracking-[0.18em] text-[var(--chat-muted)]">Today</p>
      </header>

      <ChatTranscript :messages="props.messages" />
      <ChatComposer :is-sending="props.isSending" @submit="emit('submit', $event)" />
    </section>
  </main>
</template>
