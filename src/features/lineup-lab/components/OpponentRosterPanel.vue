<script setup lang="ts">
import type { LineupLabMode, OpponentRosterPlayer } from "../types";

interface OpponentRosterPanelProps {
	players: OpponentRosterPlayer[];
	mode: LineupLabMode;
	teamName: string;
}

const props = defineProps<OpponentRosterPanelProps>();

const toDisplayName = (player: OpponentRosterPlayer): string =>
	[player.firstName, player.lastName].filter(Boolean).join(" ") || player.playerId;
</script>

<template>
  <section
    data-testid="opponent-roster-panel"
    class="rounded-lg border p-3"
  >
    <header class="mb-3 flex items-center justify-between gap-2">
      <h2 class="text-xs font-semibold uppercase tracking-[0.2em]">Opponent Roster</h2>
      <span class="text-[10px] uppercase tracking-[0.14em] text-[var(--chat-muted)]">{{ props.teamName || 'Opponent' }}</span>
    </header>

    <ul class="chat-scrollbar max-h-72 space-y-2 overflow-y-auto pr-1 text-xs">
      <li
        v-for="player in props.players"
        :key="player.playerId"
        :data-testid="`opponent-roster-item-${player.playerId}`"
        class="flex items-center justify-between gap-2 rounded-md border px-2 py-2"
      >
        <span class="truncate">{{ toDisplayName(player) }}</span>
        <span class="text-[10px] uppercase tracking-[0.1em] text-[var(--chat-muted)]">
          {{ player.gender ?? 'n/a' }}
        </span>
      </li>
    </ul>
  </section>
</template>
