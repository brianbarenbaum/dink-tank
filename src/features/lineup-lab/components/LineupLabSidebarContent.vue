<script setup lang="ts">
import { ChevronDown, LoaderCircle } from "lucide-vue-next";

import type {
	LineupLabDivisionOption,
	LineupLabMatchupOption,
	LineupLabMode,
	LineupLabTeamOption,
} from "../types";

interface LineupLabSidebarContentProps {
	lineupDivisions: LineupLabDivisionOption[];
	lineupTeams: LineupLabTeamOption[];
	lineupMatchups: LineupLabMatchupOption[];
	selectedDivisionId: string | null;
	selectedTeamId: string | null;
	selectedMatchupId: string | null;
	mode: LineupLabMode;
	isLoadingDivisions: boolean;
	isLoadingTeams: boolean;
	isLoadingMatchups: boolean;
	isCalculating: boolean;
	canCalculate: boolean;
	knownOpponentCompletionError: string | null;
	errorMessage: string | null;
}

const props = defineProps<LineupLabSidebarContentProps>();

const emit = defineEmits<{
	"select-division": [divisionId: string];
	"select-team": [teamId: string];
	"select-matchup": [matchupId: string];
	"set-mode": [mode: LineupLabMode];
	calculate: [];
}>();

const onDivisionChange = (event: Event) => {
	const divisionId = (event.target as HTMLSelectElement).value;
	if (!divisionId) return;
	emit("select-division", divisionId);
};

const onTeamChange = (event: Event) => {
	const teamId = (event.target as HTMLSelectElement).value;
	if (!teamId) return;
	emit("select-team", teamId);
};

const onMatchupChange = (event: Event) => {
	const matchupId = (event.target as HTMLSelectElement).value;
	if (!matchupId) return;
	emit("select-matchup", matchupId);
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <section class="space-y-3">
      <div class="space-y-1">
        <label class="text-[10px] uppercase tracking-[0.14em] text-[var(--chat-muted)]">Division</label>
        <div class="relative">
          <select
            data-testid="lineup-division-select"
            class="lineup-select h-11 w-full rounded-md border px-2 pr-8 text-xs"
            :value="props.selectedDivisionId ?? ''"
            :disabled="props.isLoadingDivisions || props.lineupDivisions.length === 0"
            @change="onDivisionChange"
          >
            <option disabled value="">{{ props.isLoadingDivisions ? "Loading divisions..." : "Select a Division" }}</option>
            <option
              v-for="division in props.lineupDivisions"
              :key="division.divisionId"
              :value="division.divisionId"
            >
              {{ division.divisionName }} (S{{ division.seasonNumber }} {{ division.seasonYear }} - {{ division.location }})
            </option>
          </select>
          <ChevronDown
            v-show="!props.isLoadingDivisions"
            class="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-[var(--chat-muted)]"
            aria-hidden="true"
          />
          <LoaderCircle
            v-if="props.isLoadingDivisions"
            data-testid="lineup-division-loading-spinner"
            class="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[var(--chat-muted)]"
          />
        </div>
      </div>

      <div class="space-y-1">
        <label class="text-[10px] uppercase tracking-[0.14em] text-[var(--chat-muted)]">Team</label>
        <div class="relative">
          <select
            data-testid="lineup-team-select"
            class="lineup-select h-11 w-full rounded-md border px-2 pr-8 text-xs"
            :value="props.selectedTeamId ?? ''"
            :disabled="props.isLoadingTeams || props.lineupTeams.length === 0"
            @change="onTeamChange"
          >
            <option disabled value="">{{ props.isLoadingTeams ? "Loading teams..." : "Select a Team" }}</option>
            <option
              v-for="team in props.lineupTeams"
              :key="team.teamId"
              :value="team.teamId"
            >
              {{ team.teamName }}
            </option>
          </select>
          <ChevronDown
            v-show="!props.isLoadingTeams"
            class="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-[var(--chat-muted)]"
            aria-hidden="true"
          />
          <LoaderCircle
            v-if="props.isLoadingTeams"
            data-testid="lineup-team-loading-spinner"
            class="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[var(--chat-muted)]"
          />
        </div>
      </div>

      <div class="space-y-1">
        <label class="text-[10px] uppercase tracking-[0.14em] text-[var(--chat-muted)]">Matchup</label>
        <div class="relative">
          <select
            data-testid="lineup-matchup-select"
            class="lineup-select h-11 w-full rounded-md border px-2 pr-8 text-xs"
            :value="props.selectedMatchupId ?? ''"
            :disabled="props.isLoadingMatchups || props.lineupMatchups.length === 0"
            @change="onMatchupChange"
          >
            <option disabled value="">{{ props.isLoadingMatchups ? "Loading matchups..." : "Select a Matchup" }}</option>
            <option
              v-for="matchup in props.lineupMatchups"
              :key="matchup.matchupId"
              :value="matchup.matchupId"
            >
              W{{ matchup.weekNumber ?? '?' }} vs {{ matchup.oppTeamName }}
            </option>
          </select>
          <ChevronDown
            v-show="!props.isLoadingMatchups"
            class="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-[var(--chat-muted)]"
            aria-hidden="true"
          />
          <LoaderCircle
            v-if="props.isLoadingMatchups"
            data-testid="lineup-matchup-loading-spinner"
            class="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[var(--chat-muted)]"
          />
        </div>
      </div>
    </section>

    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--chat-muted)]">Matchup Mode</p>
      <div class="grid grid-cols-1 gap-2">
        <button
          type="button"
          data-testid="lineup-mode-toggle-blind"
          class="lineup-mode-btn h-11 rounded-md border px-3 text-left text-xs font-semibold uppercase tracking-[0.12em] cursor-pointer"
          :class="props.mode === 'blind' ? 'lineup-mode-btn--active' : ''"
          @click="emit('set-mode', 'blind')"
        >
          Blind
        </button>
        <button
          type="button"
          data-testid="lineup-mode-toggle-known-opponent"
          class="lineup-mode-btn h-11 rounded-md border px-3 text-left text-xs font-semibold uppercase tracking-[0.12em] cursor-pointer"
          :class="props.mode === 'known_opponent' ? 'lineup-mode-btn--active' : ''"
          @click="emit('set-mode', 'known_opponent')"
        >
          Response to Opponent
        </button>
      </div>
    </section>

    <p
      v-if="props.mode === 'known_opponent' && props.knownOpponentCompletionError"
      data-testid="known-opponent-completion-error"
      class="rounded-md border px-2 py-2 text-xs text-amber-300"
    >
      {{ props.knownOpponentCompletionError }}
    </p>
    <p
      v-if="props.errorMessage"
      class="rounded-md border px-2 py-2 text-xs text-red-300"
    >
      {{ props.errorMessage }}
    </p>

    <button
      type="button"
      data-testid="lineup-calculate-button"
      class="h-12 w-full rounded-md border px-3 text-sm font-semibold uppercase tracking-[0.12em] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="!props.canCalculate || props.isCalculating"
      @click="emit('calculate')"
    >
      {{ props.isCalculating ? 'Calculating...' : 'Calculate' }}
    </button>
  </div>
</template>
