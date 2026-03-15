<script setup lang="ts">
import { computed } from "vue";

import DirectQueryCard from "../../chat/components/DirectQueryCard.vue";
import DirectQueryTableCard from "../../chat/components/DirectQueryTableCard.vue";
import type { DataBrowserController } from "../../chat/data-browser/useDataBrowserController";
import type { DirectQueryCardItem } from "../../chat/types";
import TeamOverviewCard from "./TeamOverviewCard.vue";

interface PropsDataBrowserTabShell {
	controller: DataBrowserController;
}

const props = defineProps<PropsDataBrowserTabShell>();

const activeCard = computed(() => props.controller.activeCard.value);

const resultsRegionClass = computed(() =>
	activeCard.value?.layout === "table"
		? "flex min-h-0 flex-1 flex-col overflow-hidden"
		: "chat-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pr-1",
);

const onSortChange = async (
	card: DirectQueryCardItem,
	sortKey: string,
): Promise<void> => {
	await props.controller.goToDirectQuerySort({
		cardId: card.id,
		card,
		sortKey,
	});
};

const onActiveCardSortChange = async (sortKey: string): Promise<void> => {
	const card = activeCard.value;
	if (!card) {
		return;
	}

	await onSortChange(card, sortKey);
};
</script>

<template>
  <div
    data-testid="data-browser-root"
    class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
  >
    <section
      v-if="!props.controller.hasSelectedLeaf.value || !activeCard"
      class="flex min-h-0 flex-1 items-center justify-center rounded-lg border p-6 text-center"
      aria-label="Data browser workspace"
    >
      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--chat-muted)]">
          Data Browser
        </p>
        <p class="text-sm text-[var(--chat-muted)]">
          Select a leaf from the sidebar to view data.
        </p>
      </div>
    </section>

    <section
      v-else
      data-testid="data-browser-results-scroll-region"
      :class="resultsRegionClass"
      aria-label="Data browser results"
    >
      <DirectQueryTableCard
        v-if="activeCard.layout === 'table'"
        :card="activeCard"
        :show-pagination="false"
        @sort="(sortKey) => void onActiveCardSortChange(sortKey)"
      />
      <TeamOverviewCard
        v-else-if="activeCard.queryType === 'team_overview'"
        :card="activeCard"
      />
      <DirectQueryCard
        v-else
        :card="activeCard"
      >
        <p class="text-sm text-[var(--chat-muted)]">
          Result ready.
        </p>
      </DirectQueryCard>
    </section>
  </div>
</template>
