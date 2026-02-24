<script setup lang="ts">
import { ChevronDown, Pencil } from "lucide-vue-next";
import { ref } from "vue";

const dataBrowserExpanded = ref(false);
</script>

<template>
  <div class="flex flex-col gap-6">
    <section class="space-y-3">
      <button
        type="button"
        data-testid="desktop-new-chat"
        class="inline-flex h-12 items-center gap-2 rounded-md px-1 text-left text-sm font-semibold tracking-wide cursor-pointer"
        title="New chat"
      >
        <Pencil class="h-4 w-4" />
        New Chat
      </button>
    </section>

    <nav class="space-y-5" aria-label="Explorer shortcuts">
      <section class="space-y-2">
        <h2>
          <button
            type="button"
            data-testid="toggle-data-browser"
            class="flex w-full cursor-pointer items-center justify-between rounded-md px-1 py-1 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--chat-muted)]"
            :aria-expanded="dataBrowserExpanded"
            @click="dataBrowserExpanded = !dataBrowserExpanded"
          >
            <span>Data Browser</span>
            <ChevronDown
              class="h-3.5 w-3.5 shrink-0 transition-transform duration-150"
              :class="dataBrowserExpanded ? 'rotate-180' : 'rotate-0'"
            />
          </button>
        </h2>
        <p v-if="dataBrowserExpanded" class="px-3 py-2 text-xs text-[var(--chat-muted)]">Coming soon</p>
      </section>
    </nav>
  </div>
</template>
