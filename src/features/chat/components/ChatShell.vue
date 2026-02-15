<script setup lang="ts">
import ChatComposer from "./ChatComposer.vue";
import ChatSidebar from "./ChatSidebar.vue";
import ChatTranscript from "./ChatTranscript.vue";

import type { ChatMessage } from "../types";

const messages: ChatMessage[] = [
  {
    id: "seed-assistant",
    role: "assistant",
    content: "Welcome back, Coach. Database synced. Match results from the weekend tournament processed.",
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "seed-user",
    role: "user",
    content: "Show me the pickleball win/loss ratios for Team A.",
    createdAt: new Date(0).toISOString(),
  },
];
</script>

<template>
  <main
    data-testid="chat-shell"
    class="chat-root grid min-h-screen grid-cols-1 lg:grid-cols-[18rem_1fr]"
  >
    <ChatSidebar />

    <section class="flex min-h-screen flex-col gap-4 p-3 md:p-4 lg:p-6">
      <header class="flex items-center justify-between rounded-lg border px-4 py-3">
        <p class="text-xs font-semibold uppercase tracking-[0.22em]">Dink Tank AI</p>
        <p class="text-xs uppercase tracking-[0.18em] text-[var(--chat-muted)]">Today</p>
      </header>

      <ChatTranscript :messages="messages" />
      <ChatComposer />
    </section>
  </main>
</template>
