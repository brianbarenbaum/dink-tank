<script setup lang="ts">
import { CircleHelp } from "lucide-vue-next";
import { computed, onMounted, onUnmounted, ref } from "vue";

import type { LineupRecommendationPayload } from "../types";

interface LineupRecommendationCardProps {
	payload: LineupRecommendationPayload;
	selected?: boolean;
}

const props = withDefaults(defineProps<LineupRecommendationCardProps>(), {
	selected: false,
});

const emit = defineEmits<{
	inspect: [];
}>();

const expectedWinsTooltip =
	"Average wins we expect this lineup to get across many simulations.";
const conservativeWinsTooltip =
	"A safer lower-end estimate. In tougher outcomes, this is a typical wins level.";

const primaryRecommendation = computed(
	() => props.payload.recommendations[0] ?? null,
);

const expectedHelpEl = ref<HTMLElement | null>(null);
const conservativeHelpEl = ref<HTMLElement | null>(null);
const expectedTooltipOpen = ref(false);
const conservativeTooltipOpen = ref(false);

const getPlayerName = (playerId: string): string =>
	props.payload.playerDirectory?.[playerId] ?? playerId;

const formatWinProbability = (winProbability: number): string =>
	`${Math.round(winProbability * 100)}%`;

const formatMatchupWinProbability = (value: number | undefined): string =>
	`${Math.round((value ?? 0.5) * 100)}%`;

const toggleExpectedTooltip = () => {
	expectedTooltipOpen.value = !expectedTooltipOpen.value;
	if (expectedTooltipOpen.value) {
		conservativeTooltipOpen.value = false;
	}
};

const toggleConservativeTooltip = () => {
	conservativeTooltipOpen.value = !conservativeTooltipOpen.value;
	if (conservativeTooltipOpen.value) {
		expectedTooltipOpen.value = false;
	}
};

const closeAllTooltips = () => {
	expectedTooltipOpen.value = false;
	conservativeTooltipOpen.value = false;
};

const onDocumentClick = (event: MouseEvent) => {
	const target = event.target as Node | null;
	const clickedExpected =
		expectedHelpEl.value?.contains(target ?? null) ?? false;
	const clickedConservative =
		conservativeHelpEl.value?.contains(target ?? null) ?? false;
	if (!clickedExpected && !clickedConservative) {
		closeAllTooltips();
	}
};

const onDocumentKeydown = (event: KeyboardEvent) => {
	if (event.key === "Escape") {
		closeAllTooltips();
	}
};

onMounted(() => {
	document.addEventListener("click", onDocumentClick);
	document.addEventListener("keydown", onDocumentKeydown);
});

onUnmounted(() => {
	document.removeEventListener("click", onDocumentClick);
	document.removeEventListener("keydown", onDocumentKeydown);
});
</script>

<template>
  <article
    data-testid="lineup-recommendation-card"
    :class="[
      'rounded-lg border p-4 transition-colors',
      selected ? 'border-[var(--chat-text)] bg-[color:color-mix(in_srgb,var(--chat-surface)_70%,var(--chat-text)_8%)]' : '',
    ]"
  >
    <header class="mb-3 flex items-center justify-between gap-3">
      <span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--chat-muted)]">Explorer Query</span>
      <button
        type="button"
        data-testid="lineup-advanced-options-button"
        class="cursor-pointer rounded border bg-[color:color-mix(in_srgb,var(--chat-surface)_75%,var(--chat-text)_8%)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] hover:border-[var(--chat-text)]"
        @click.stop="$emit('inspect')"
      >
        Show Advanced Options
      </button>
    </header>

    <div class="grid grid-cols-2 gap-2 pt-1 text-xs text-[var(--chat-muted)] sm:grid-cols-5">
      <div>
        <p class="flex items-center gap-1 uppercase tracking-[0.14em]">
          Expected Wins
          <span ref="expectedHelpEl" class="relative inline-flex">
            <button
              type="button"
              data-testid="expected-wins-help-button"
              class="inline-flex cursor-pointer items-center"
              aria-label="Explain expected wins"
              :aria-expanded="expectedTooltipOpen"
              @click.stop="toggleExpectedTooltip"
            >
              <CircleHelp
                data-testid="expected-wins-help"
                class="h-3.5 w-3.5"
              />
            </button>
            <span
              v-if="expectedTooltipOpen"
              data-testid="expected-wins-tooltip"
              class="absolute top-5 left-0 z-20 w-52 rounded border bg-[var(--chat-bg)] p-2 text-[10px] normal-case tracking-normal text-[var(--chat-text)] shadow-lg"
            >
              {{ expectedWinsTooltip }}
            </span>
          </span>
        </p>
        <p class="text-sm font-semibold text-[var(--chat-text)]">{{ primaryRecommendation?.expectedWins ?? 0 }}</p>
      </div>
      <div>
        <p class="flex items-center gap-1 uppercase tracking-[0.14em]">
          Conservative Wins
          <span ref="conservativeHelpEl" class="relative inline-flex">
            <button
              type="button"
              data-testid="conservative-wins-help-button"
              class="inline-flex cursor-pointer items-center"
              aria-label="Explain conservative wins"
              :aria-expanded="conservativeTooltipOpen"
              @click.stop="toggleConservativeTooltip"
            >
              <CircleHelp
                data-testid="conservative-wins-help"
                class="h-3.5 w-3.5"
              />
            </button>
            <span
              v-if="conservativeTooltipOpen"
              data-testid="conservative-wins-tooltip"
              class="absolute top-5 left-0 z-20 w-52 rounded border bg-[var(--chat-bg)] p-2 text-[10px] normal-case tracking-normal text-[var(--chat-text)] shadow-lg"
            >
              {{ conservativeWinsTooltip }}
            </span>
          </span>
        </p>
        <p class="text-sm font-semibold text-[var(--chat-text)]">{{ primaryRecommendation?.floorWinsQ20 ?? 0 }}</p>
      </div>
      <div>
        <p class="uppercase tracking-[0.14em]">Matchup Win %</p>
        <p class="text-sm font-semibold text-[var(--chat-text)]">{{ formatMatchupWinProbability(primaryRecommendation?.matchupWinProbability) }}</p>
      </div>
      <div>
        <p class="uppercase tracking-[0.14em]">Game Confidence</p>
        <p class="text-sm font-semibold text-[var(--chat-text)]">{{ primaryRecommendation?.gameConfidence ?? primaryRecommendation?.confidence ?? 'LOW' }}</p>
      </div>
      <div>
        <p class="uppercase tracking-[0.14em]">Matchup Confidence</p>
        <p class="text-sm font-semibold text-[var(--chat-text)]">{{ primaryRecommendation?.matchupConfidence ?? primaryRecommendation?.confidence ?? 'LOW' }}</p>
      </div>
    </div>

    <section class="mt-3 space-y-2 rounded border p-3 text-xs">
      <div class="flex items-center justify-between gap-2">
        <p class="font-semibold uppercase tracking-[0.14em] text-[var(--chat-muted)]">Round Schedule</p>
        <p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--chat-muted)]">Win Probability</p>
      </div>
      <div
        v-for="round in primaryRecommendation?.rounds ?? []"
        :key="`round-${round.roundNumber}`"
        class="space-y-1 border-t pt-2 first:border-t-0 first:pt-0"
      >
        <p class="font-semibold">Round {{ round.roundNumber }}</p>
        <ul class="space-y-1 text-[var(--chat-muted)]">
          <li
            v-for="game in round.games"
            :key="`g-${game.roundNumber}-${game.slotNumber}`"
            class="flex items-center justify-between gap-2"
          >
            <span>
              {{ game.matchType }}:
              {{ getPlayerName(game.playerAId) }} / {{ getPlayerName(game.playerBId) }}
            </span>
            <span>{{ formatWinProbability(game.winProbability) }}</span>
          </li>
        </ul>
      </div>
    </section>
  </article>
</template>
