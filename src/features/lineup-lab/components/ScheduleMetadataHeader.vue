<script setup lang="ts">
import { computed } from "vue";

import type { LineupRecommendationPayload } from "../types";

interface ScheduleMetadataHeaderProps {
	recommendationResult: LineupRecommendationPayload | null;
}

const props = defineProps<ScheduleMetadataHeaderProps>();

const recommendation = computed(
	() => props.recommendationResult?.recommendations?.[0] ?? null,
);

const formatPercent = (value: number | undefined): string =>
	typeof value === "number" ? `${Math.round(value * 100)}%` : "-";
</script>

<template>
  <section
    data-testid="schedule-metadata-header"
    class="grid grid-cols-2 gap-2 rounded-lg border p-3 text-xs md:grid-cols-5"
  >
    <article>
      <p class="uppercase tracking-[0.12em] text-[var(--chat-muted)]">Expected Wins</p>
      <p data-testid="schedule-expected-wins" class="text-sm font-semibold">
        {{ recommendation?.expectedWins ?? "-" }}
      </p>
    </article>
    <article>
      <p class="uppercase tracking-[0.12em] text-[var(--chat-muted)]">Conservative Wins</p>
      <p data-testid="schedule-conservative-wins" class="text-sm font-semibold">
        {{ recommendation?.floorWinsQ20 ?? "-" }}
      </p>
    </article>
    <article>
      <p class="uppercase tracking-[0.12em] text-[var(--chat-muted)]">Win %</p>
      <p data-testid="schedule-matchup-win-probability" class="text-sm font-semibold">
        {{ formatPercent(recommendation?.matchupWinProbability) }}
      </p>
    </article>
    <article>
      <p class="uppercase tracking-[0.12em] text-[var(--chat-muted)]">Game Conf</p>
      <p data-testid="schedule-game-confidence" class="text-sm font-semibold">
        {{ recommendation?.gameConfidence ?? "-" }}
      </p>
    </article>
    <article>
      <p class="uppercase tracking-[0.12em] text-[var(--chat-muted)]">Matchup Conf</p>
      <p data-testid="schedule-matchup-confidence" class="text-sm font-semibold">
        {{ recommendation?.matchupConfidence ?? "-" }}
      </p>
    </article>
  </section>
</template>
