<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ChevronLeft, ChevronRight, MessageSquareText, UserRound } from "lucide-vue-next";

import ChatShell from "../features/chat/components/ChatShell.vue";
import ChatSidebarContent from "../features/chat/components/ChatSidebarContent.vue";
import { useChatController } from "../features/chat/useChatController";
import LineupLabTabShell from "../features/lineup-lab/components/LineupLabTabShell.vue";
import LineupLabSidebarContent from "../features/lineup-lab/components/LineupLabSidebarContent.vue";
import { useLineupLabController } from "../features/lineup-lab/useLineupLabController";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const activeTab = computed<"chat" | "lineup_lab">(() =>
	route.path.startsWith("/lineup-lab") ? "lineup_lab" : "chat",
);
const desktopSidebarOpen = ref(true);
const mobileSidebarOpen = ref(false);

const desktopGridClass = computed(() =>
	desktopSidebarOpen.value ? "lg:grid-cols-[18rem_1fr]" : "lg:grid-cols-[3rem_1fr]",
);

const chatController = useChatController();
const { messages, isSending, submit, modelLabel, extendedThinking } = chatController;

const lineupLabController = useLineupLabController();
const {
	lineupDivisions,
	lineupTeams,
	lineupMatchups,
	lineupRosterPlayers,
	opponentRosterPlayers,
	selectedDivisionId,
	selectedTeamId,
	selectedMatchupId,
	selectedAvailablePlayerIds,
	mode,
	opponentAssignments,
	recommendationResult,
	isLoadingDivisions,
	isLoadingTeams,
	isLoadingMatchups,
	isCalculating,
	canCalculate,
	knownOpponentCompletionError,
	errorMessage,
	selectLineupDivision,
	selectLineupTeam,
	selectLineupMatchup,
	selectLineupPlayerAvailability,
	setMode,
	setOpponentSlotAssignment,
	calculate,
} = lineupLabController;

const onExtendedThinkingUpdate = (value: boolean) => {
	extendedThinking.value = value;
};

const selectTab = (tab: "chat" | "lineup_lab") => {
	mobileSidebarOpen.value = false;
	if (tab === "chat") {
		void router.push("/chat");
		return;
	}
	void router.push("/lineup-lab");
};

const signOut = async () => {
	await authStore.signOut();
	await router.replace("/auth/login");
};

watch(
	() => authStore.isAuthenticated,
	(isAuthenticated) => {
		if (isAuthenticated) {
			return;
		}
		void router.replace({
			path: "/auth/login",
			query: { redirect: route.fullPath },
		});
	},
);
</script>

<template>
  <div class="chat-root flex h-screen flex-col overflow-hidden">
    <header class="top-nav-shell shrink-0 px-3 md:px-4 lg:px-6">
      <div class="flex w-full items-stretch">
        <div class="top-nav-brand hidden md:flex">
          Dink Tank
        </div>
        <nav
          aria-label="Primary"
          class="top-nav-tablist ml-3 md:ml-4 lg:ml-6"
          role="tablist"
        >
          <button
            :aria-selected="activeTab === 'chat'"
            :class="[
              'top-nav-tab',
              activeTab === 'chat' ? 'top-nav-tab--active' : '',
            ]"
            aria-controls="chat-tab-panel"
            aria-label="Chat"
            data-testid="top-tab-chat"
            role="tab"
            type="button"
            @click="selectTab('chat')"
          >
            <span class="top-nav-tab__inner">
              <MessageSquareText
                :size="12"
                aria-hidden="true"
                class="top-nav-tab__icon"
              />
              <span>Chat</span>
            </span>
          </button>
          <button
            :aria-selected="activeTab === 'lineup_lab'"
            :class="[
              'top-nav-tab',
              activeTab === 'lineup_lab' ? 'top-nav-tab--active' : '',
            ]"
            aria-controls="lineup-lab-tab-panel"
            aria-label="Lineup Lab"
            data-testid="top-tab-lineup-lab"
            role="tab"
            type="button"
            @click="selectTab('lineup_lab')"
          >
            <span class="top-nav-tab__inner">
              <UserRound
                :size="12"
                aria-hidden="true"
                class="top-nav-tab__icon"
              />
              <span>Lineup Lab</span>
            </span>
          </button>
        </nav>
        <div class="ml-auto hidden items-center lg:flex">
          <button
            type="button"
            class="h-10 rounded-md border px-3 text-xs font-semibold uppercase tracking-[0.18em] cursor-pointer"
            data-testid="auth-signout-button"
            @click="signOut"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>

    <main
      :class="[
        'grid min-h-0 flex-1 grid-cols-1 grid-rows-[1fr]',
        desktopGridClass,
      ]"
    >
      <aside
        v-if="desktopSidebarOpen"
        data-testid="chat-sidebar"
        class="hidden border-r p-4 lg:flex lg:flex-col lg:gap-6 chat-sidebar-surface chat-divider-border"
        aria-label="Session sidebar"
      >
        <div class="flex items-center justify-end">
          <button
            type="button"
            data-testid="desktop-sidebar-close-icon"
            class="inline-flex h-9 w-9 items-center justify-center rounded-md border cursor-pointer"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            @click="desktopSidebarOpen = false"
          >
            <ChevronLeft class="h-4 w-4" />
          </button>
        </div>
        <ChatSidebarContent v-if="activeTab === 'chat'" />
        <LineupLabSidebarContent
          v-else
          :lineup-divisions="lineupDivisions"
          :lineup-teams="lineupTeams"
          :lineup-matchups="lineupMatchups"
          :selected-division-id="selectedDivisionId"
          :selected-team-id="selectedTeamId"
          :selected-matchup-id="selectedMatchupId"
          :mode="mode"
          :is-loading-divisions="isLoadingDivisions"
          :is-loading-teams="isLoadingTeams"
          :is-loading-matchups="isLoadingMatchups"
          :is-calculating="isCalculating"
          :can-calculate="canCalculate"
          :known-opponent-completion-error="knownOpponentCompletionError"
          :error-message="errorMessage"
          @select-division="selectLineupDivision"
          @select-team="selectLineupTeam"
          @select-matchup="selectLineupMatchup"
          @set-mode="setMode"
          @calculate="calculate"
        />
      </aside>

      <aside
        v-else
        data-testid="desktop-sidebar-rail"
        class="hidden border-r p-2 lg:flex lg:flex-col lg:items-center lg:justify-start chat-divider-border"
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
      </aside>

      <div
        v-if="mobileSidebarOpen"
        class="fixed inset-0 z-30 bg-black/50 lg:hidden"
        aria-hidden="true"
        @click="mobileSidebarOpen = false"
      />
      <aside
        v-if="mobileSidebarOpen"
        data-testid="mobile-sidebar"
        class="chat-sidebar-surface chat-divider-border fixed inset-y-0 left-0 z-40 flex w-72 flex-col gap-6 border-r p-4 transition-transform duration-150 ease-out lg:hidden"
        aria-label="Session sidebar"
      >
        <div class="flex items-center gap-3">
          <button
            type="button"
            data-testid="mobile-close-sidebar"
            class="h-12 rounded-md border px-4 text-xs font-semibold uppercase tracking-wide cursor-pointer"
            aria-label="Close sidebar"
            title="Close sidebar"
            @click="mobileSidebarOpen = false"
          >
            Close
          </button>
          <button
            type="button"
            class="h-12 rounded-md border px-4 text-xs font-semibold uppercase tracking-wide cursor-pointer"
            data-testid="mobile-signout-button"
            @click="signOut"
          >
            Sign Out
          </button>
        </div>
        <ChatSidebarContent v-if="activeTab === 'chat'" />
        <LineupLabSidebarContent
          v-else
          :lineup-divisions="lineupDivisions"
          :lineup-teams="lineupTeams"
          :lineup-matchups="lineupMatchups"
          :selected-division-id="selectedDivisionId"
          :selected-team-id="selectedTeamId"
          :selected-matchup-id="selectedMatchupId"
          :mode="mode"
          :is-loading-divisions="isLoadingDivisions"
          :is-loading-teams="isLoadingTeams"
          :is-loading-matchups="isLoadingMatchups"
          :is-calculating="isCalculating"
          :can-calculate="canCalculate"
          :known-opponent-completion-error="knownOpponentCompletionError"
          :error-message="errorMessage"
          @select-division="selectLineupDivision"
          @select-team="selectLineupTeam"
          @select-matchup="selectLineupMatchup"
          @set-mode="setMode"
          @calculate="calculate"
        />
      </aside>

      <section
        :id="activeTab === 'chat' ? 'chat-tab-panel' : 'lineup-lab-tab-panel'"
        :aria-labelledby="activeTab === 'chat' ? 'top-tab-chat' : 'top-tab-lineup-lab'"
        data-testid="app-main"
        class="relative flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-3 md:p-4 lg:p-6"
      >
        <header
          data-testid="mobile-top-bar"
          class="flex items-center justify-between rounded-lg border px-4 py-3 lg:hidden"
        >
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="h-11 rounded-md border px-3 text-xs font-semibold uppercase tracking-wide cursor-pointer"
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

        <ChatShell
          v-if="activeTab === 'chat'"
          embedded
          :messages="messages"
          :is-sending="isSending"
          :model-label="modelLabel"
          :extended-thinking="extendedThinking"
          @update:extended-thinking="onExtendedThinkingUpdate"
          @submit="submit"
        />

        <LineupLabTabShell
          v-else
          :lineup-divisions="lineupDivisions"
          :lineup-teams="lineupTeams"
          :lineup-matchups="lineupMatchups"
          :lineup-roster-players="lineupRosterPlayers"
          :opponent-roster-players="opponentRosterPlayers"
          :selected-division-id="selectedDivisionId"
          :selected-team-id="selectedTeamId"
          :selected-matchup-id="selectedMatchupId"
          :selected-available-player-ids="selectedAvailablePlayerIds"
          :mode="mode"
          :opponent-assignments="opponentAssignments"
          :recommendation-result="recommendationResult"
          :is-loading-teams="isLoadingTeams"
          :is-loading-matchups="isLoadingMatchups"
          :is-calculating="isCalculating"
          :can-calculate="canCalculate"
          :known-opponent-completion-error="knownOpponentCompletionError"
          :error-message="errorMessage"
          @select-division="selectLineupDivision"
          @select-team="selectLineupTeam"
          @select-matchup="selectLineupMatchup"
          @select-availability="selectLineupPlayerAvailability"
          @set-mode="setMode"
          @update-opponent-slot="setOpponentSlotAssignment"
          @calculate="calculate"
        />
      </section>
    </main>
  </div>
</template>
