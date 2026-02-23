<script setup lang="ts">
import ChatShell from "./features/chat/components/ChatShell.vue";
import { useChatController } from "./features/chat/useChatController";

const controller = useChatController();
const {
	messages,
	isSending,
	submit,
	runLineupLabRecommend,
	lineupDivisions,
	lineupTeams,
	lineupMatchups,
	lineupRosterPlayers,
	selectedDivisionId,
	selectedTeamId,
	selectedMatchupId,
	selectedAvailablePlayerIds,
	isLoadingTeams,
	isLoadingMatchups,
	selectLineupDivision,
	selectLineupTeam,
	selectLineupMatchup,
	selectLineupPlayerAvailability,
	modelLabel,
	extendedThinking,
} =
	controller;
const onExtendedThinkingUpdate = (value: boolean) => {
	extendedThinking.value = value;
};
</script>

<template>
  <ChatShell
    :messages="messages"
    :is-sending="isSending"
    :model-label="modelLabel"
    :extended-thinking="extendedThinking"
    :lineup-divisions="lineupDivisions"
    :lineup-teams="lineupTeams"
    :lineup-matchups="lineupMatchups"
    :lineup-roster-players="lineupRosterPlayers"
    :selected-division-id="selectedDivisionId"
    :selected-team-id="selectedTeamId"
    :selected-matchup-id="selectedMatchupId"
    :selected-available-player-ids="selectedAvailablePlayerIds"
    :is-loading-teams="isLoadingTeams"
    :is-loading-matchups="isLoadingMatchups"
    @update:extended-thinking="onExtendedThinkingUpdate"
    @select-lineup-division="selectLineupDivision"
    @select-lineup-team="selectLineupTeam"
    @select-lineup-matchup="selectLineupMatchup"
    @select-lineup-player-availability="selectLineupPlayerAvailability"
    @submit="submit"
    @run-lineup-lab-recommend="runLineupLabRecommend"
  />
</template>
