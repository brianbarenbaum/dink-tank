<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

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

const formatApplied = (value: boolean | undefined): string => {
	if (value === true) return "Applied";
	if (value === false) return "Not applied";
	return "-";
};

const formatCoverage = (value: number | undefined): string =>
	typeof value === "number"
		? `${Math.max(0, Math.min(4, Math.round(value)))}/4`
		: "-";

type MetricInfoKey =
	| "expected-wins"
	| "conservative-wins"
	| "win-pct"
	| "game-conf"
	| "matchup-conf";

const openInfoKey = ref<MetricInfoKey | null>(null);

const toggleInfo = (key: MetricInfoKey) => {
	openInfoKey.value = openInfoKey.value === key ? null : key;
};

const modelSignalSummary = computed(() => {
	return "Baseline historical pair/matchup performance and point-differential blending are always applied. Additional adjustment signals: DUPR, Team strength.";
});

const gameConfidenceReason = computed(() => {
	const confidence = recommendation.value?.gameConfidence;
	if (confidence === "HIGH") {
		return "Game confidence is HIGH because matchup-level historical signal coverage is strong for most slots.";
	}
	if (confidence === "MEDIUM") {
		return "Game confidence is MEDIUM because historical signal coverage is mixed across slots.";
	}
	if (confidence === "LOW") {
		return "Game confidence is LOW because historical signal coverage is sparse, so predictions lean more on conservative fallbacks.";
	}
	return "Game confidence is unavailable for this recommendation.";
});

const matchupConfidenceReason = computed(() => {
	const confidence = recommendation.value?.matchupConfidence;
	if (confidence === "HIGH") {
		return "Matchup confidence is HIGH because game-level coverage, expected decisiveness, and scenario diversity align strongly.";
	}
	if (confidence === "MEDIUM") {
		return "Matchup confidence is MEDIUM because coverage/decisiveness/scenario diversity are reasonable but not dominant.";
	}
	if (confidence === "LOW") {
		return "Matchup confidence is LOW because one or more of coverage, decisiveness, or scenario diversity is weak.";
	}
	return "Matchup confidence is unavailable for this recommendation.";
});

const closeInfoIfOutside = (event: MouseEvent) => {
	const target = event.target as HTMLElement | null;
	if (!target?.closest("[data-metric-info]")) {
		openInfoKey.value = null;
	}
};

const closeInfoOnEscape = (event: KeyboardEvent) => {
	if (event.key === "Escape") {
		openInfoKey.value = null;
	}
};

onMounted(() => {
	document.addEventListener("click", closeInfoIfOutside);
	document.addEventListener("keydown", closeInfoOnEscape);
});

onUnmounted(() => {
	document.removeEventListener("click", closeInfoIfOutside);
	document.removeEventListener("keydown", closeInfoOnEscape);
});
</script>

<template>
  <section
    data-testid="schedule-metadata-header"
    class="grid grid-cols-2 gap-2 rounded-lg border p-3 text-xs md:grid-cols-5"
  >
    <article>
      <p class="flex items-center gap-1 uppercase tracking-[0.12em] text-[var(--chat-muted)]">
        Expected Wins
        <span data-metric-info class="relative inline-flex">
          <button
            type="button"
            data-testid="metric-info-button-expected-wins"
            class="inline-flex cursor-pointer items-center"
            aria-label="Explain expected wins"
            :aria-expanded="openInfoKey === 'expected-wins'"
            @click.stop="toggleInfo('expected-wins')"
          >
            <span class="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[10px] font-semibold normal-case leading-none">i</span>
          </button>
          <span
            v-if="openInfoKey === 'expected-wins'"
            data-testid="metric-info-popover-expected-wins"
            class="absolute top-5 left-0 z-20 w-64 rounded border bg-[var(--chat-bg)] p-2 text-xs normal-case tracking-normal text-[var(--chat-text)] shadow-lg"
          >
            Expected Wins is the average number of games this lineup is projected to win across the full matchup.
            It combines baseline pair matchup rates, point-differential signal blending, team-strength adjustment, and DUPR blending when full four-player DUPR coverage exists.
            {{ modelSignalSummary }}
          </span>
        </span>
      </p>
      <p data-testid="schedule-expected-wins" class="text-sm font-semibold">
        {{ recommendation?.expectedWins ?? "-" }}
      </p>
    </article>
    <article>
      <p class="flex items-center gap-1 uppercase tracking-[0.12em] text-[var(--chat-muted)]">
        Conservative Wins
        <span data-metric-info class="relative inline-flex">
          <button
            type="button"
            data-testid="metric-info-button-conservative-wins"
            class="inline-flex cursor-pointer items-center"
            aria-label="Explain conservative wins"
            :aria-expanded="openInfoKey === 'conservative-wins'"
            @click.stop="toggleInfo('conservative-wins')"
          >
            <span class="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[10px] font-semibold normal-case leading-none">i</span>
          </button>
          <span
            v-if="openInfoKey === 'conservative-wins'"
            data-testid="metric-info-popover-conservative-wins"
            class="absolute top-5 left-0 z-20 w-64 rounded border bg-[var(--chat-bg)] p-2 text-xs normal-case tracking-normal text-[var(--chat-text)] shadow-lg"
          >
            Conservative Wins is the downside estimate (20th-percentile wins) from the matchup win distribution.
            It uses the same per-game model inputs as Expected Wins, but reports a safer lower-end outcome instead of the average.
            {{ modelSignalSummary }}
          </span>
        </span>
      </p>
      <p data-testid="schedule-conservative-wins" class="text-sm font-semibold">
        {{ recommendation?.floorWinsQ20 ?? "-" }}
      </p>
    </article>
    <article>
      <p class="flex items-center gap-1 uppercase tracking-[0.12em] text-[var(--chat-muted)]">
        Win %
        <span data-metric-info class="relative inline-flex">
          <button
            type="button"
            data-testid="metric-info-button-win-pct"
            class="inline-flex cursor-pointer items-center"
            aria-label="Explain matchup win percentage"
            :aria-expanded="openInfoKey === 'win-pct'"
            @click.stop="toggleInfo('win-pct')"
          >
            <span class="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[10px] font-semibold normal-case leading-none">i</span>
          </button>
          <span
            v-if="openInfoKey === 'win-pct'"
            data-testid="metric-info-popover-win-pct"
            class="absolute top-5 left-0 z-20 w-64 rounded border bg-[var(--chat-bg)] p-2 text-xs normal-case tracking-normal text-[var(--chat-text)] shadow-lg"
          >
            Win % is the probability of winning the overall matchup (more game wins than losses, with exact ties treated as 50/50).
            It is derived from the distribution of all per-game win probabilities using the same model signals.
            {{ modelSignalSummary }}
          </span>
        </span>
      </p>
      <p data-testid="schedule-matchup-win-probability" class="text-sm font-semibold">
        {{ formatPercent(recommendation?.matchupWinProbability) }}
      </p>
    </article>
    <article>
      <p class="flex items-center gap-1 uppercase tracking-[0.12em] text-[var(--chat-muted)]">
        Game Conf
        <span data-metric-info class="relative inline-flex">
          <button
            type="button"
            data-testid="metric-info-button-game-conf"
            class="inline-flex cursor-pointer items-center"
            aria-label="Explain game confidence"
            :aria-expanded="openInfoKey === 'game-conf'"
            @click.stop="toggleInfo('game-conf')"
          >
            <span class="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[10px] font-semibold normal-case leading-none">i</span>
          </button>
          <span
            v-if="openInfoKey === 'game-conf'"
            data-testid="metric-info-popover-game-conf"
            class="absolute top-5 left-0 z-20 w-64 rounded border bg-[var(--chat-bg)] p-2 text-xs normal-case tracking-normal text-[var(--chat-text)] shadow-lg"
          >
            Game Confidence summarizes the strength of game-level historical support behind slot-level probabilities.
            {{ gameConfidenceReason }}
          </span>
        </span>
      </p>
      <p data-testid="schedule-game-confidence" class="text-sm font-semibold">
        {{ recommendation?.gameConfidence ?? "-" }}
      </p>
    </article>
    <article>
      <p class="flex items-center gap-1 uppercase tracking-[0.12em] text-[var(--chat-muted)]">
        Matchup Conf
        <span data-metric-info class="relative inline-flex">
          <button
            type="button"
            data-testid="metric-info-button-matchup-conf"
            class="inline-flex cursor-pointer items-center"
            aria-label="Explain matchup confidence"
            :aria-expanded="openInfoKey === 'matchup-conf'"
            @click.stop="toggleInfo('matchup-conf')"
          >
            <span class="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[10px] font-semibold normal-case leading-none">i</span>
          </button>
          <span
            v-if="openInfoKey === 'matchup-conf'"
            data-testid="metric-info-popover-matchup-conf"
            class="absolute top-5 right-0 z-20 w-64 rounded border bg-[var(--chat-bg)] p-2 text-xs normal-case tracking-normal text-[var(--chat-text)] shadow-lg"
          >
            Matchup Confidence estimates how trustworthy the overall matchup forecast is.
            It reflects game-level coverage, expected decisiveness, and scenario diversity.
            {{ matchupConfidenceReason }}
          </span>
        </span>
      </p>
      <p data-testid="schedule-matchup-confidence" class="text-sm font-semibold">
        {{ recommendation?.matchupConfidence ?? "-" }}
      </p>
    </article>
  </section>
</template>
