<script setup lang="ts">
import type { LineupRosterPlayer } from "../types";

interface TeamRosterPanelProps {
	players: LineupRosterPlayer[];
	selectedAvailablePlayerIds: string[];
}

const props = defineProps<TeamRosterPanelProps>();

const emit = defineEmits<{
	"select-availability": [playerId: string, isAvailable: boolean];
}>();

const onAvailabilityChange = (event: Event) => {
	const target = event.target as HTMLInputElement;
	emit("select-availability", target.value, target.checked);
};

const toDisplayName = (player: LineupRosterPlayer): string =>
	[player.firstName, player.lastName].filter(Boolean).join(" ") || player.playerId;
</script>

<template>
  <section
    data-testid="team-roster-panel"
    class="rounded-lg border p-3"
  >
    <header class="mb-3 flex items-center justify-between gap-2">
      <h2 class="text-xs font-semibold uppercase tracking-[0.2em]">Team Roster</h2>
      <span class="text-[10px] uppercase tracking-[0.14em] text-[var(--chat-muted)]">Availability</span>
    </header>
    <ul class="chat-scrollbar max-h-72 space-y-2 overflow-y-auto pr-1 text-xs">
      <li
        v-for="player in props.players"
        :key="player.playerId"
        class="flex items-center justify-between gap-2 rounded-md border px-2 py-2"
      >
        <label class="flex min-w-0 items-center gap-2">
          <input
            :data-testid="`lineup-availability-${player.playerId}`"
            class="h-4 w-4"
            type="checkbox"
            :value="player.playerId"
            :checked="props.selectedAvailablePlayerIds.includes(player.playerId)"
            @change="onAvailabilityChange"
          >
          <span class="truncate">{{ toDisplayName(player) }}</span>
        </label>
        <span class="text-[10px] uppercase tracking-[0.1em] text-[var(--chat-muted)]">
          {{ player.gender ?? 'n/a' }}{{ player.isSub ? ' · sub' : '' }}
        </span>
      </li>
    </ul>
  </section>
</template>
