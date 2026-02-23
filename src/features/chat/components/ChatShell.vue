<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronRight, Pencil } from "lucide-vue-next";

import ChatComposer from "./ChatComposer.vue";
import ChatSidebar from "./ChatSidebar.vue";
import ChatTranscript from "./ChatTranscript.vue";
import UtilitiesPanel from "./UtilitiesPanel.vue";

import type { ChatMessage } from "../types";

interface ChatShellProps {
	messages?: ChatMessage[];
	isSending?: boolean;
	modelLabel?: string;
	extendedThinking?: boolean;
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
	isLoadingTeams?: boolean;
	isLoadingMatchups?: boolean;
}

const props = withDefaults(defineProps<ChatShellProps>(), {
	messages: () => [
		{
			id: "seed-assistant",
			role: "assistant",
			content: "Welcome back, Captain.  What do you need help with today?",
			createdAt: new Date(0).toISOString(),
		},
		{
			id: "seed-user",
			role: "user",
			content: "Show me the pickleball win/loss ratios for Team A.",
			createdAt: new Date(0).toISOString(),
		},
	],
	isSending: false,
	modelLabel: "Unknown model",
	extendedThinking: false,
	lineupDivisions: () => [],
	lineupTeams: () => [],
	lineupMatchups: () => [],
	lineupRosterPlayers: () => [],
	selectedDivisionId: null,
	selectedTeamId: null,
	selectedMatchupId: null,
	selectedAvailablePlayerIds: () => [],
	isLoadingTeams: false,
	isLoadingMatchups: false,
});

const emit = defineEmits<{
	submit: [value: string];
	"update:extended-thinking": [value: boolean];
	"run-lineup-lab-recommend": [];
	"select-lineup-division": [divisionId: string];
	"select-lineup-team": [teamId: string];
	"select-lineup-matchup": [matchupId: string];
	"select-lineup-player-availability": [playerId: string, isAvailable: boolean];
}>();

const mobileSidebarOpen = ref(false);
const desktopSidebarOpen = ref(true);
const utilitiesOpen = ref(false);
const selectedRecommendationId = ref<string | null>(null);

const selectedRecommendation = computed(() => {
	if (!selectedRecommendationId.value) {
		return null;
	}
	const message = props.messages.find(
		(candidate) => candidate.id === selectedRecommendationId.value,
	);
	return message?.lineupRecommendation ?? null;
});

const onSelectExplorerItem = (item: "lineup-recommend") => {
	if (item !== "lineup-recommend") {
		return;
	}
	emit("run-lineup-lab-recommend");
	if (mobileSidebarOpen.value) {
		mobileSidebarOpen.value = false;
	}
};

const onSelectRecommendation = (messageId: string) => {
	selectedRecommendationId.value = messageId;
	utilitiesOpen.value = true;
};

const onInspectRecommendation = (messageId: string) => {
	selectedRecommendationId.value = messageId;
	utilitiesOpen.value = true;
};

const desktopGridClass = computed(() => {
	if (desktopSidebarOpen.value) {
		return utilitiesOpen.value
			? "lg:grid-cols-[18rem_minmax(0,1fr)_20rem]"
			: "lg:grid-cols-[18rem_1fr]";
	}
	return utilitiesOpen.value
		? "lg:grid-cols-[3rem_minmax(0,1fr)_20rem]"
		: "lg:grid-cols-[3rem_1fr]";
});
</script>

<template>
  <main
    data-testid="chat-shell"
    :class="[
      'chat-root grid min-h-screen grid-cols-1',
      desktopGridClass,
    ]"
  >
    <ChatSidebar
      v-if="desktopSidebarOpen"
      :lineup-divisions="props.lineupDivisions"
      :lineup-teams="props.lineupTeams"
      :lineup-matchups="props.lineupMatchups"
      :lineup-roster-players="props.lineupRosterPlayers"
      :selected-division-id="props.selectedDivisionId"
      :selected-team-id="props.selectedTeamId"
      :selected-matchup-id="props.selectedMatchupId"
      :selected-available-player-ids="props.selectedAvailablePlayerIds"
      :loading-teams="props.isLoadingTeams"
      :loading-matchups="props.isLoadingMatchups"
      @select-explorer-item="onSelectExplorerItem"
      @select-division="emit('select-lineup-division', $event)"
      @select-team="emit('select-lineup-team', $event)"
      @select-matchup="emit('select-lineup-matchup', $event)"
      @select-player-availability="(playerId, isAvailable) => emit('select-lineup-player-availability', playerId, isAvailable)"
      @toggle-desktop="desktopSidebarOpen = false"
    />
    <aside
      v-else
      data-testid="desktop-sidebar-rail"
      class="hidden border-r p-2 lg:flex lg:flex-col lg:items-center lg:justify-start"
      aria-label="Collapsed sidebar"
    >
      <button
        type="button"
        data-testid="desktop-sidebar-open-icon"
        class="mt-2 inline-flex h-9 w-9 items-center justify-center rounded-md border cursor-pointer"
        aria-label="Open sidebar"
        title="Expand sidebar"
        @click="desktopSidebarOpen = true"
      >
        <ChevronRight class="h-4 w-4" />
      </button>
      <button
        type="button"
        data-testid="desktop-rail-new-chat"
        class="mt-2 inline-flex h-9 w-9 items-center justify-center rounded-md border cursor-pointer"
        aria-label="New chat"
        title="New chat"
      >
        <Pencil class="h-4 w-4" />
      </button>
    </aside>

    <div
      v-if="mobileSidebarOpen"
      class="fixed inset-0 z-30 bg-black/50 lg:hidden"
      @click="mobileSidebarOpen = false"
    />
    <ChatSidebar
      mobile
      data-testid="mobile-sidebar"
      :open="mobileSidebarOpen"
      :lineup-divisions="props.lineupDivisions"
      :lineup-teams="props.lineupTeams"
      :lineup-matchups="props.lineupMatchups"
      :lineup-roster-players="props.lineupRosterPlayers"
      :selected-division-id="props.selectedDivisionId"
      :selected-team-id="props.selectedTeamId"
      :selected-matchup-id="props.selectedMatchupId"
      :selected-available-player-ids="props.selectedAvailablePlayerIds"
      :loading-teams="props.isLoadingTeams"
      :loading-matchups="props.isLoadingMatchups"
      @select-explorer-item="onSelectExplorerItem"
      @select-division="emit('select-lineup-division', $event)"
      @select-team="emit('select-lineup-team', $event)"
      @select-matchup="emit('select-lineup-matchup', $event)"
      @select-player-availability="(playerId, isAvailable) => emit('select-lineup-player-availability', playerId, isAvailable)"
      @close="mobileSidebarOpen = false"
    />

    <section
      data-testid="chat-main"
      class="relative flex h-screen min-h-0 flex-col gap-4 overflow-hidden p-3 md:p-4 lg:p-6"
    >
      <header
        data-testid="mobile-top-bar"
        class="flex items-center justify-between rounded-lg border px-4 py-3 lg:hidden"
      >
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="h-11 rounded-md border px-3 text-xs font-semibold uppercase tracking-wide cursor-pointer lg:hidden"
            data-testid="mobile-sidebar-toggle"
            aria-label="Open sidebar"
            @click="mobileSidebarOpen = true"
          >
            Menu
          </button>
          <p class="text-xs font-semibold uppercase tracking-[0.22em]">Dink Tank AI</p>
        </div>
        <p class="text-xs uppercase tracking-[0.18em] text-[var(--chat-muted)]">Today</p>
      </header>

      <ChatTranscript
        :messages="props.messages"
        :is-sending="props.isSending"
        :selected-recommendation-id="selectedRecommendationId"
        @select-recommendation="onSelectRecommendation"
        @inspect-recommendation="onInspectRecommendation"
      />
      <ChatComposer
        :is-sending="props.isSending"
        :model-label="props.modelLabel"
        :extended-thinking="props.extendedThinking"
        @submit="emit('submit', $event)"
        @update:extended-thinking="emit('update:extended-thinking', $event)"
      />
    </section>
    <UtilitiesPanel
      :open="utilitiesOpen"
      :payload="selectedRecommendation"
      @close="utilitiesOpen = false"
    />
    <UtilitiesPanel
      mobile
      :open="utilitiesOpen"
      :payload="selectedRecommendation"
      @close="utilitiesOpen = false"
    />
  </main>
</template>
