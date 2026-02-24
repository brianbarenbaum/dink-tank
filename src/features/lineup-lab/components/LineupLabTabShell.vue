<script setup lang="ts">
import { ref } from "vue";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-vue-next";

import OpponentRosterPanel from "./OpponentRosterPanel.vue";
import ScheduleConfigurationBoard from "./ScheduleConfigurationBoard.vue";
import ScheduleMetadataHeader from "./ScheduleMetadataHeader.vue";
import TeamRosterPanel from "./TeamRosterPanel.vue";

import type {
	LineupLabDivisionOption,
	LineupLabMatchupOption,
	LineupLabMode,
	LineupLabTeamOption,
	LineupRecommendationPayload,
	LineupRosterPlayer,
	OpponentAssignmentsBySlot,
	OpponentRosterPlayer,
} from "../types";

interface LineupLabTabShellProps {
	lineupDivisions: LineupLabDivisionOption[];
	lineupTeams: LineupLabTeamOption[];
	lineupMatchups: LineupLabMatchupOption[];
	lineupRosterPlayers: LineupRosterPlayer[];
	opponentRosterPlayers: OpponentRosterPlayer[];
	selectedDivisionId: string | null;
	selectedTeamId: string | null;
	selectedMatchupId: string | null;
	selectedAvailablePlayerIds: string[];
	mode: LineupLabMode;
	opponentAssignments: OpponentAssignmentsBySlot;
	recommendationResult: LineupRecommendationPayload | null;
	isLoadingTeams: boolean;
	isLoadingMatchups: boolean;
	isCalculating: boolean;
	canCalculate: boolean;
	knownOpponentCompletionError: string | null;
	errorMessage: string | null;
}

const props = defineProps<LineupLabTabShellProps>();

const emit = defineEmits<{
	"select-division": [divisionId: string];
	"select-team": [teamId: string];
	"select-matchup": [matchupId: string];
	"select-availability": [playerId: string, isAvailable: boolean];
	"set-mode": [mode: LineupLabMode];
	"update-opponent-slot": [
		roundNumber: number,
		slotNumber: number,
		playerAId: string | null,
		playerBId: string | null,
	];
	calculate: [];
}>();

const desktopRosterSidebarOpen = ref(true);
const mobileRostersExpanded = ref(true);

const selectedMatchup = () =>
	props.lineupMatchups.find(
		(matchup) => matchup.matchupId === props.selectedMatchupId,
	) ?? null;

const onTeamAvailabilityUpdate = (playerId: string, isAvailable: boolean) => {
	emit("select-availability", playerId, isAvailable);
};

const onOpponentSlotUpdate = (
	roundNumber: number,
	slotNumber: number,
	playerAId: string | null,
	playerBId: string | null,
) => {
	emit("update-opponent-slot", roundNumber, slotNumber, playerAId, playerBId);
};
</script>

<template>
  <div
    data-testid="lineup-lab-root"
    class="flex min-h-0 flex-1 flex-col gap-4"
  >
    <!-- Desktop: two columns (schedule | right roster sidebar) -->
    <div class="hidden min-h-0 flex-1 lg:grid" :class="desktopRosterSidebarOpen ? 'lg:grid-cols-[1fr_18rem]' : 'lg:grid-cols-[1fr_3rem]'">
      <section
        class="chat-scrollbar min-h-0 min-w-0 space-y-4 overflow-y-auto"
        aria-label="Schedule configuration"
      >
        <ScheduleMetadataHeader
          :recommendation-result="props.recommendationResult"
        />
        <ScheduleConfigurationBoard
          :mode="props.mode"
          :recommendation-result="props.recommendationResult"
          :opponent-roster-players="props.opponentRosterPlayers"
          :opponent-assignments="props.opponentAssignments"
          @update-opponent-slot="onOpponentSlotUpdate"
        />
      </section>

      <template v-if="desktopRosterSidebarOpen">
        <aside
          data-testid="lineup-lab-roster-sidebar"
          class="flex min-h-full flex-col gap-4 border-l p-4 chat-divider-border"
          aria-label="Rosters"
        >
          <div class="flex items-center justify-start">
            <button
              type="button"
              data-testid="roster-sidebar-close-icon"
              class="inline-flex h-9 w-9 items-center justify-center rounded-md border cursor-pointer"
              aria-label="Collapse roster sidebar"
              title="Collapse roster sidebar"
              @click="desktopRosterSidebarOpen = false"
            >
              <ChevronRight class="h-4 w-4" />
            </button>
          </div>
          <div class="space-y-4 overflow-y-auto">
            <TeamRosterPanel
              :players="props.lineupRosterPlayers"
              :selected-available-player-ids="props.selectedAvailablePlayerIds"
              @select-availability="onTeamAvailabilityUpdate"
            />
            <OpponentRosterPanel
              :players="props.opponentRosterPlayers"
              :mode="props.mode"
              :team-name="selectedMatchup()?.oppTeamName ?? 'Opponent'"
            />
          </div>
        </aside>
      </template>
      <aside
        v-else
        data-testid="lineup-lab-roster-rail"
        class="hidden min-h-full flex-col items-center justify-start border-l p-2 lg:flex chat-divider-border"
        aria-label="Expand roster sidebar"
      >
        <button
          type="button"
          data-testid="roster-sidebar-open-icon"
          class="mt-2 inline-flex h-9 w-9 items-center justify-center rounded-md border cursor-pointer"
          aria-label="Open roster sidebar"
          title="Expand roster sidebar"
          @click="desktopRosterSidebarOpen = true"
        >
          <ChevronLeft class="h-4 w-4" />
        </button>
      </aside>
    </div>

    <!-- Mobile: single column, schedule first then collapsible Rosters -->
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto lg:hidden">
      <section class="space-y-4">
        <ScheduleMetadataHeader
          :recommendation-result="props.recommendationResult"
        />
        <ScheduleConfigurationBoard
          :mode="props.mode"
          :recommendation-result="props.recommendationResult"
          :opponent-roster-players="props.opponentRosterPlayers"
          :opponent-assignments="props.opponentAssignments"
          @update-opponent-slot="onOpponentSlotUpdate"
        />
      </section>

      <section class="rounded-lg border">
        <button
          type="button"
          data-testid="mobile-rosters-toggle"
          class="flex w-full cursor-pointer items-center justify-between rounded-t-lg border-b px-4 py-3 text-left"
          :aria-expanded="mobileRostersExpanded"
          @click="mobileRostersExpanded = !mobileRostersExpanded"
        >
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--chat-muted)]">Rosters</span>
          <ChevronDown
            class="h-4 w-4 shrink-0 transition-transform duration-150"
            :class="mobileRostersExpanded ? 'rotate-180' : 'rotate-0'"
          />
        </button>
        <div
          v-show="mobileRostersExpanded"
          class="space-y-4 p-4"
        >
          <TeamRosterPanel
            :players="props.lineupRosterPlayers"
            :selected-available-player-ids="props.selectedAvailablePlayerIds"
            @select-availability="onTeamAvailabilityUpdate"
          />
          <OpponentRosterPanel
            :players="props.opponentRosterPlayers"
            :mode="props.mode"
            :team-name="selectedMatchup()?.oppTeamName ?? 'Opponent'"
          />
        </div>
      </section>
    </div>
  </div>
</template>
