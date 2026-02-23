<script setup lang="ts">
import {
	ChevronDown,
	ChevronLeft,
	LoaderCircle,
	Pencil,
	Send,
} from "lucide-vue-next";
import { ref } from "vue";

interface ChatSidebarProps {
	mobile?: boolean;
	open?: boolean;
	lineupDivisions?: Array<{
		divisionId: string;
		divisionName: string;
		seasonYear: number;
		seasonNumber: number;
		location: string;
	}>;
	lineupTeams?: Array<{ teamId: string; teamName: string }>;
	lineupMatchups?: Array<{
		matchupId: string;
		weekNumber: number | null;
		scheduledTime: string | null;
		teamId: string;
		oppTeamId: string;
		teamName: string;
		oppTeamName: string;
	}>;
	lineupRosterPlayers?: Array<{
		playerId: string;
		firstName: string | null;
		lastName: string | null;
		gender: string | null;
		isSub: boolean;
		suggested: boolean;
	}>;
	selectedDivisionId?: string | null;
	selectedTeamId?: string | null;
	selectedMatchupId?: string | null;
	selectedAvailablePlayerIds?: string[];
	loadingTeams?: boolean;
	loadingMatchups?: boolean;
}

withDefaults(defineProps<ChatSidebarProps>(), {
	mobile: false,
	open: false,
	lineupDivisions: () => [],
	lineupTeams: () => [],
	lineupMatchups: () => [],
	lineupRosterPlayers: () => [],
	selectedDivisionId: null,
	selectedTeamId: null,
	selectedMatchupId: null,
	selectedAvailablePlayerIds: () => [],
	loadingTeams: false,
	loadingMatchups: false,
});

const emit = defineEmits<{
	close: [];
	toggleDesktop: [];
	selectExplorerItem: [item: "lineup-recommend"];
	selectDivision: [divisionId: string];
	selectTeam: [teamId: string];
	selectMatchup: [matchupId: string];
	selectPlayerAvailability: [playerId: string, isAvailable: boolean];
}>();

const lineupLabExpanded = ref(false);
const dataBrowserExpanded = ref(false);

const onDivisionChange = (event: Event) => {
	const divisionId = (event.target as HTMLSelectElement).value;
	if (!divisionId) {
		return;
	}
	emit("selectDivision", divisionId);
};

const onTeamChange = (event: Event) => {
	const teamId = (event.target as HTMLSelectElement).value;
	if (!teamId) {
		return;
	}
	emit("selectTeam", teamId);
};

const onMatchupChange = (event: Event) => {
	const matchupId = (event.target as HTMLSelectElement).value;
	if (!matchupId) {
		return;
	}
	emit("selectMatchup", matchupId);
};

const onPlayerAvailabilityChange = (event: Event) => {
	const target = event.target as HTMLInputElement;
	const playerId = target.value;
	if (!playerId) {
		return;
	}
	emit("selectPlayerAvailability", playerId, target.checked);
};
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

    <nav class="space-y-5" aria-label="Explorer shortcuts">
      <section class="space-y-2">
        <h2>
          <button
            type="button"
            data-testid="toggle-lineup-lab"
            class="flex w-full cursor-pointer items-center justify-between rounded-md px-1 py-1 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--chat-muted)]"
            :aria-expanded="lineupLabExpanded"
            @click="lineupLabExpanded = !lineupLabExpanded"
          >
            <span>Lineup Lab</span>
            <ChevronDown
              class="h-3.5 w-3.5 shrink-0 transition-transform duration-150"
              :class="lineupLabExpanded ? 'rotate-180' : 'rotate-0'"
            />
          </button>
        </h2>
        <ul v-if="lineupLabExpanded" class="space-y-2 text-sm">
          <li class="space-y-1">
            <label class="text-[10px] uppercase tracking-[0.14em] text-[var(--chat-muted)]">Division</label>
            <select
              data-testid="lineup-division-select"
              class="w-full rounded-md border px-2 py-1 text-xs"
              :value="selectedDivisionId ?? ''"
              @change="onDivisionChange"
            >
              <option disabled value="">Select division</option>
              <option
                v-for="division in lineupDivisions"
                :key="division.divisionId"
                :value="division.divisionId"
              >
                {{ division.divisionName }} (S{{ division.seasonNumber }} {{ division.seasonYear }} - {{ division.location }})
              </option>
            </select>
          </li>
          <li class="space-y-1">
            <label class="text-[10px] uppercase tracking-[0.14em] text-[var(--chat-muted)]">Team</label>
            <div class="relative">
              <select
                data-testid="lineup-team-select"
                class="w-full rounded-md border px-2 py-1 pr-8 text-xs"
                :value="selectedTeamId ?? ''"
                :disabled="loadingTeams || lineupTeams.length === 0"
                @change="onTeamChange"
              >
                <option disabled value="">{{ loadingTeams ? "Loading teams..." : "Select team" }}</option>
                <option
                  v-for="team in lineupTeams"
                  :key="team.teamId"
                  :value="team.teamId"
                >
                  {{ team.teamName }}
                </option>
              </select>
              <LoaderCircle
                v-if="loadingTeams"
                data-testid="lineup-team-loading-spinner"
                class="pointer-events-none absolute top-1/2 right-7 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[var(--chat-muted)]"
              />
            </div>
          </li>
          <li class="space-y-1">
            <label class="text-[10px] uppercase tracking-[0.14em] text-[var(--chat-muted)]">Matchup</label>
            <div class="relative">
              <select
                data-testid="lineup-matchup-select"
                class="w-full rounded-md border px-2 py-1 pr-8 text-xs"
                :value="selectedMatchupId ?? ''"
                :disabled="loadingMatchups || lineupMatchups.length === 0"
                @change="onMatchupChange"
              >
                <option disabled value="">{{ loadingMatchups ? "Loading matchups..." : "Select matchup" }}</option>
                <option
                  v-for="matchup in lineupMatchups"
                  :key="matchup.matchupId"
                  :value="matchup.matchupId"
                >
                  W{{ matchup.weekNumber ?? '?' }} vs {{ matchup.oppTeamName }}
                </option>
              </select>
              <LoaderCircle
                v-if="loadingMatchups"
                data-testid="lineup-matchup-loading-spinner"
                class="pointer-events-none absolute top-1/2 right-7 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[var(--chat-muted)]"
              />
            </div>
          </li>
          <li>
            <div
              v-if="lineupRosterPlayers.length > 0"
              class="space-y-2 rounded-md border p-2"
              data-testid="lineup-player-availability-panel"
            >
              <p class="text-[10px] uppercase tracking-[0.14em] text-[var(--chat-muted)]">Player Availability</p>
              <ul class="max-h-44 space-y-1 overflow-y-auto pr-1 text-xs">
                <li
                  v-for="player in lineupRosterPlayers"
                  :key="player.playerId"
                  class="flex items-center justify-between gap-2"
                >
                  <label class="flex min-w-0 items-center gap-2">
                    <input
                      :data-testid="`lineup-availability-${player.playerId}`"
                      class="h-3.5 w-3.5"
                      type="checkbox"
                      :value="player.playerId"
                      :checked="selectedAvailablePlayerIds.includes(player.playerId)"
                      @change="onPlayerAvailabilityChange"
                    >
                    <span class="truncate">
                      {{ [player.firstName, player.lastName].filter(Boolean).join(' ') || player.playerId }}
                    </span>
                  </label>
                  <span class="text-[10px] uppercase tracking-[0.1em] text-[var(--chat-muted)]">
                    {{ player.gender ?? 'n/a' }}{{ player.isSub ? ' · sub' : '' }}
                  </span>
                </li>
              </ul>
            </div>
          </li>
          <li>
            <button
              type="button"
              data-testid="explorer-calculate-pairings"
              class="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-left font-semibold text-[var(--chat-text)] disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!selectedMatchupId || selectedAvailablePlayerIds.length < 8 || selectedAvailablePlayerIds.length % 2 !== 0"
              @click="$emit('selectExplorerItem', 'lineup-recommend')"
            >
              <span>Calculate Pairings</span>
              <Send class="h-4 w-4 shrink-0" />
            </button>
          </li>
        </ul>
      </section>

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
  </aside>
</template>
