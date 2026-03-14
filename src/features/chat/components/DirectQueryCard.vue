<script setup lang="ts">
import { computed } from "vue";

import type { DirectQueryCardItem } from "../types";

interface PropsDirectQueryCard {
	card: DirectQueryCardItem;
}

const props = defineProps<PropsDirectQueryCard>();

const LAST_UPDATED_FORMATTER = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "2-digit",
	year: "numeric",
	timeZone: "UTC",
});

const fetchedAtLabel = computed(() => {
	if (!props.card.fetchedAt) {
		return "Fetching...";
	}

	const parsed = new Date(props.card.fetchedAt);
	if (Number.isNaN(parsed.getTime())) {
		return props.card.fetchedAt;
	}

	return `Last Updated ${LAST_UPDATED_FORMATTER.format(parsed)}`;
});
</script>

<template>
  <article
    data-testid="direct-query-card"
    class="direct-query-card-surface chat-divider-border flex flex-col gap-4 rounded-xl border p-4"
  >
    <header class="flex flex-col gap-3">
      <div class="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
        <div class="flex min-w-0 flex-col gap-1">
          <p class="text-sm font-semibold text-[var(--chat-text)]">
            {{ props.card.breadcrumb.join(" / ") }}
          </p>
        </div>
        <p class="text-xs text-[var(--chat-muted)]">
          {{ fetchedAtLabel }}
        </p>
      </div>
      <slot name="header-extra" />
    </header>
    <slot />
    <slot name="footer" />
  </article>
</template>
