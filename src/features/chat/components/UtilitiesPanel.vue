<script setup lang="ts">
import type { LineupRecommendationPayload } from "../../lineup-lab/types";

interface UtilitiesPanelProps {
	payload: LineupRecommendationPayload | null;
	mobile?: boolean;
	open?: boolean;
}

withDefaults(defineProps<UtilitiesPanelProps>(), {
	mobile: false,
	open: false,
});

defineEmits<{
	close: [];
}>();
</script>

<template>
  <aside
    v-if="open"
    data-testid="utilities-panel"
    :class="
      mobile
        ? 'fixed inset-x-0 bottom-0 z-50 rounded-t-xl border bg-[var(--chat-surface)] p-4 shadow-2xl lg:hidden'
        : 'hidden w-80 border-l bg-[var(--chat-surface)] p-4 lg:block'
    "
  >
    <header class="mb-4 flex items-center justify-between gap-2">
      <h2 class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--chat-muted)]">Utilities</h2>
      <button
        type="button"
        class="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
        @click="$emit('close')"
      >
        Close
      </button>
    </header>

    <div v-if="payload" class="space-y-4 text-sm">
      <section class="rounded border p-3">
        <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--chat-muted)]">Objective</p>
        <p class="mt-1 font-semibold">{{ payload.objective }}</p>
      </section>

      <section class="rounded border p-3">
        <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--chat-muted)]">Scenario Count</p>
        <p class="mt-1 font-semibold">{{ payload.scenarioSummary.scenarioCount }}</p>
      </section>

      <section class="rounded border p-3">
        <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--chat-muted)]">Generated</p>
        <p class="mt-1 font-semibold">{{ new Date(payload.generatedAt).toLocaleString() }}</p>
      </section>
    </div>

    <p v-else class="text-sm text-[var(--chat-muted)]">Select a recommendation card to view utilities.</p>
  </aside>
</template>
