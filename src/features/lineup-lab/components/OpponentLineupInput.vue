<script setup lang="ts">
import type { OpponentRosterPlayer } from "../types";

interface OpponentLineupInputProps {
	roundNumber: number;
	slotNumber: number;
	matchType: "mixed" | "female" | "male";
	players: OpponentRosterPlayer[];
	playerAId: string | null;
	playerBId: string | null;
	disabled?: boolean;
}

const props = withDefaults(defineProps<OpponentLineupInputProps>(), {
	disabled: false,
});

const emit = defineEmits<{
	update: [
		roundNumber: number,
		slotNumber: number,
		playerAId: string | null,
		playerBId: string | null,
	];
}>();

const onPlayerAChange = (event: Event) => {
	const nextValue = (event.target as HTMLSelectElement).value || null;
	emit("update", props.roundNumber, props.slotNumber, nextValue, props.playerBId);
};

const onPlayerBChange = (event: Event) => {
	const nextValue = (event.target as HTMLSelectElement).value || null;
	emit("update", props.roundNumber, props.slotNumber, props.playerAId, nextValue);
};

const toDisplayName = (player: OpponentRosterPlayer): string =>
	[player.firstName, player.lastName].filter(Boolean).join(" ") || player.playerId;
</script>

<template>
  <div
    :data-testid="`round-slot-${props.roundNumber}-${props.slotNumber}-opponent-input`"
    class="space-y-1 rounded-md border p-2"
  >
    <p class="text-[10px] uppercase tracking-[0.14em] text-[var(--chat-muted)]">
      {{ props.matchType }} slot {{ props.slotNumber }}
    </p>
    <select
      class="h-11 w-full rounded-md border px-2 text-xs"
      :value="props.playerAId ?? ''"
      :disabled="props.disabled"
      @change="onPlayerAChange"
    >
      <option value="">Opponent player A</option>
      <option
        v-for="player in props.players"
        :key="`a-${player.playerId}`"
        :value="player.playerId"
      >
        {{ toDisplayName(player) }}
      </option>
    </select>
    <select
      class="h-11 w-full rounded-md border px-2 text-xs"
      :value="props.playerBId ?? ''"
      :disabled="props.disabled"
      @change="onPlayerBChange"
    >
      <option value="">Opponent player B</option>
      <option
        v-for="player in props.players"
        :key="`b-${player.playerId}`"
        :value="player.playerId"
      >
        {{ toDisplayName(player) }}
      </option>
    </select>
  </div>
</template>
