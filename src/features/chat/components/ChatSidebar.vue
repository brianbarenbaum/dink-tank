<script setup lang="ts">
import { ChevronLeft, Pencil } from "lucide-vue-next";

interface ChatSidebarProps {
	mobile?: boolean;
	open?: boolean;
}

withDefaults(defineProps<ChatSidebarProps>(), {
	mobile: false,
	open: false,
});

defineEmits<{
	close: [];
	toggleDesktop: [];
}>();
</script>

<template>
  <aside
    data-testid="chat-sidebar"
    :class="
      mobile
        ? [
            'chat-sidebar-surface fixed inset-y-0 left-0 z-40 flex w-72 flex-col gap-6 border-r p-4 transition-transform duration-150 ease-out lg:hidden',
            open ? 'translate-x-0' : '-translate-x-full',
          ]
        : 'hidden border-r p-4 lg:flex lg:flex-col lg:gap-6'
    "
    aria-label="Session sidebar"
  >
    <section class="space-y-3">
      <div v-if="!mobile" class="flex items-center justify-between gap-3">
        <h1 class="text-lg font-semibold uppercase tracking-[0.24em]">Dink Tank</h1>
        <button
          type="button"
          data-testid="desktop-sidebar-close-icon"
          class="inline-flex h-9 w-9 items-center justify-center rounded-md border cursor-pointer"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          @click="$emit('toggleDesktop')"
        >
          <ChevronLeft class="h-4 w-4" />
        </button>
      </div>
      <div v-if="mobile" class="flex items-center gap-3">
        <button
          type="button"
          data-testid="mobile-new-chat"
          class="inline-flex h-12 flex-1 items-center gap-2 rounded-md px-4 text-left text-sm font-semibold tracking-wide cursor-pointer"
          title="New chat"
        >
          <Pencil class="h-4 w-4" />
          New Chat
        </button>
        <button
          type="button"
          data-testid="mobile-close-sidebar"
          class="h-12 rounded-md border px-4 text-xs font-semibold uppercase tracking-wide cursor-pointer"
          aria-label="Close sidebar"
          title="Close sidebar"
          @click="$emit('close')"
        >
          Close
        </button>
      </div>
      <button
        v-else
        type="button"
        data-testid="desktop-new-chat"
        class="inline-flex h-12 items-center gap-2 rounded-md px-1 text-left text-sm font-semibold tracking-wide cursor-pointer"
        title="New chat"
      >
        <Pencil class="h-4 w-4" />
        New Chat
      </button>
    </section>

    <section class="space-y-2">
      <h2 class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--chat-muted)]">Your Chats</h2>
      <ul class="space-y-2 text-sm text-[var(--chat-muted)]">
        <li>Team A vs Team B</li>
        <li>Q3 Performance Review</li>
        <li>Player Efficiency: John</li>
      </ul>
    </section>

    <section class="grid grid-cols-2 gap-3">
      <button type="button" class="h-24 rounded-md border text-xs font-semibold uppercase tracking-wide">League Rank</button>
      <button type="button" class="h-24 rounded-md border text-xs font-semibold uppercase tracking-wide">Win Rate</button>
      <button type="button" class="h-24 rounded-md border text-xs font-semibold uppercase tracking-wide">Rosters</button>
      <button type="button" class="h-24 rounded-md border text-xs font-semibold uppercase tracking-wide">History</button>
    </section>
  </aside>
</template>
