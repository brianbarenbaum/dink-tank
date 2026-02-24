<script setup lang="ts">
import { ChevronDown } from "lucide-vue-next";

import type { OpponentRosterPlayer } from "../types";

interface OpponentLineupInputProps {
	roundNumber: number;
	slotNumber: number;
	matchType: "mixed" | "female" | "male";
	playersForA: OpponentRosterPlayer[];
	playersForB: OpponentRosterPlayer[];
	playerAId: string | null;
	playerBId: string | null;
	emptyMessageForA?: string | null;
	emptyMessageForB?: string | null;
	disabled?: boolean;
}

const props = withDefaults(defineProps<OpponentLineupInputProps>(), {
	emptyMessageForA: null,
	emptyMessageForB: null,
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

const placeholderA =
	props.matchType === "mixed" ? "Opponent player A (male)" : "Opponent player A";
const placeholderB =
	props.matchType === "mixed" ? "Opponent player B (female)" : "Opponent player B";

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
    <div class="relative">
      <select
        class="lineup-select h-11 w-full rounded-md border px-2 pr-8 text-xs"
        :value="props.playerAId ?? ''"
        :disabled="props.disabled"
        @change="onPlayerAChange"
      >
        <option value="">{{ placeholderA }}</option>
        <option
          v-for="player in props.playersForA"
          :key="`a-${player.playerId}`"
          :value="player.playerId"
        >
          {{ toDisplayName(player) }}
        </option>
      </select>
      <ChevronDown
        class="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-[var(--chat-muted)]"
        aria-hidden="true"
      />
    </div>
    <p v-if="props.emptyMessageForA" class="text-[10px] text-amber-600">
      {{ props.emptyMessageForA }}
    </p>
    <div class="relative">
      <select
        class="lineup-select h-11 w-full rounded-md border px-2 pr-8 text-xs"
        :value="props.playerBId ?? ''"
        :disabled="props.disabled"
        @change="onPlayerBChange"
      >
        <option value="">{{ placeholderB }}</option>
        <option
          v-for="player in props.playersForB"
          :key="`b-${player.playerId}`"
          :value="player.playerId"
        >
          {{ toDisplayName(player) }}
        </option>
      </select>
      <ChevronDown
        class="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-[var(--chat-muted)]"
        aria-hidden="true"
      />
    </div>
    <p v-if="props.emptyMessageForB" class="text-[10px] text-amber-600">
      {{ props.emptyMessageForB }}
    </p>
  </div>
</template>
