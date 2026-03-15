<script setup lang="ts">
import { BarChart3, Shield, Trophy } from "lucide-vue-next";
import { computed } from "vue";

import DirectQueryCard from "../../chat/components/DirectQueryCard.vue";
import type { DirectQueryCardItem, DirectQueryPayload } from "../../chat/types";

interface TeamOverviewPayload {
	teamName: string | null;
	matchRecord: {
		wins: number;
		losses: number;
		draws: number;
		record: string | null;
		homeRecord: string | null;
		awayRecord: string | null;
	};
	totalPoints: {
		totalPointsWon: number | null;
		averagePerMatch: number | null;
	};
	leagueRank: {
		rank: number | null;
		teamCount: number | null;
		podRank: number | null;
	};
	winBreakdown: {
		overallWinPercentage: number | null;
		menWinPercentage: number | null;
		womenWinPercentage: number | null;
		mixedWinPercentage: number | null;
	};
	otherStats: {
		gameRecord: string | null;
		totalPointsWon: number | null;
		averagePointsPerGame: number | null;
		teamPointDiff: number | null;
	};
}

type TeamOverviewPayloadRecord = TeamOverviewPayload & Record<string, unknown>;

interface PropsTeamOverviewCard {
	card: DirectQueryCardItem;
}

interface WinBreakdownItem {
	key: string;
	label: string;
	value: number | null;
}

interface StatItem {
	label: string;
	value: string;
}

const props = defineProps<PropsTeamOverviewCard>();

const INTEGER_FORMATTER = new Intl.NumberFormat("en-US");
const DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isTeamOverviewPayload = (
	payload: DirectQueryPayload,
): payload is TeamOverviewPayloadRecord => {
	if (!isObjectRecord(payload)) {
		return false;
	}

	return (
		isObjectRecord(payload.matchRecord) &&
		isObjectRecord(payload.totalPoints) &&
		isObjectRecord(payload.leagueRank) &&
		isObjectRecord(payload.winBreakdown) &&
		isObjectRecord(payload.otherStats)
	);
};

const overview = computed(() =>
	isTeamOverviewPayload(props.card.payload) ? props.card.payload : null,
);

const formatInteger = (
	value: number | null,
	options?: { minimumIntegerDigits?: number },
): string => {
	if (value === null) {
		return "--";
	}

	return new Intl.NumberFormat("en-US", {
		minimumIntegerDigits: options?.minimumIntegerDigits ?? 1,
	}).format(value);
};

const formatDecimal = (value: number | null): string =>
	value === null ? "--" : DECIMAL_FORMATTER.format(value);

const formatPercent = (value: number | null): string =>
	value === null ? "--" : `${DECIMAL_FORMATTER.format(value)}%`;

const formatRecord = (value: string | null): string =>
	value ? value.replaceAll("-", " - ") : "--";

const formatSignedInteger = (value: number | null): string => {
	if (value === null) {
		return "--";
	}

	const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
	return `${prefix}${INTEGER_FORMATTER.format(Math.abs(value))}`;
};

const winBreakdownItems = computed<WinBreakdownItem[]>(() => {
	if (!overview.value) {
		return [];
	}

	return [
		{
			key: "total",
			label: "TOTAL WIN %",
			value: overview.value.winBreakdown.overallWinPercentage,
		},
		{
			key: "men",
			label: "MEN'S WIN %",
			value: overview.value.winBreakdown.menWinPercentage,
		},
		{
			key: "women",
			label: "WOMEN'S WIN %",
			value: overview.value.winBreakdown.womenWinPercentage,
		},
		{
			key: "mixed",
			label: "MIXED WIN %",
			value: overview.value.winBreakdown.mixedWinPercentage,
		},
	];
});

const otherStatsItems = computed<StatItem[]>(() => {
	if (!overview.value) {
		return [];
	}

	return [
		{
			label: "GAME RECORD",
			value: overview.value.otherStats.gameRecord ?? "--",
		},
		{
			label: "TOTAL POINTS WON",
			value:
				overview.value.otherStats.totalPointsWon === null
					? "--"
					: INTEGER_FORMATTER.format(overview.value.otherStats.totalPointsWon),
		},
		{
			label: "AVERAGE PPG",
			value: formatDecimal(overview.value.otherStats.averagePointsPerGame),
		},
		{
			label: "TEAM POINT DIFF",
			value: formatSignedInteger(overview.value.otherStats.teamPointDiff),
		},
	];
});

const recordSummary = computed(() => {
	if (!overview.value) {
		return {
			wins: "--",
			losses: "--",
			draws: null,
		};
	}

	return {
		wins: formatInteger(overview.value.matchRecord.wins),
		losses: formatInteger(overview.value.matchRecord.losses),
		draws:
			overview.value.matchRecord.draws > 0
				? formatInteger(overview.value.matchRecord.draws)
				: null,
	};
});
</script>

<template>
  <DirectQueryCard :card="props.card">
    <div
      data-testid="team-overview-card"
      class="grid gap-4 font-mono"
    >
      <template v-if="props.card.status === 'loading'">
        <div class="grid gap-3 xl:grid-cols-3">
          <div
            v-for="index in 3"
            :key="index"
            class="team-overview-segment min-h-[106px] animate-pulse px-4 py-4"
          >
            <div class="direct-query-skeleton-bar h-3 w-24 rounded-full" />
            <div class="direct-query-skeleton-bar mt-6 h-12 w-full rounded-lg" />
            <div class="direct-query-skeleton-bar mt-4 h-3 w-32 rounded-full" />
          </div>
        </div>
        <div class="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
          <div class="team-overview-segment min-h-[188px] animate-pulse px-4 py-4">
            <div class="direct-query-skeleton-bar h-3 w-44 rounded-full" />
            <div class="direct-query-skeleton-bar mt-6 ml-auto h-10 w-24 rounded-lg" />
            <div class="space-y-4 pt-8">
              <div
                v-for="index in 4"
                :key="index"
                class="space-y-2"
              >
                <div class="direct-query-skeleton-bar h-3 w-full rounded-full" />
                <div class="direct-query-skeleton-bar h-2 w-full rounded-full" />
              </div>
            </div>
          </div>
          <div class="team-overview-segment min-h-[188px] animate-pulse px-4 py-4">
            <div class="direct-query-skeleton-bar h-3 w-28 rounded-full" />
            <div class="space-y-4 pt-8">
              <div
                v-for="index in 4"
                :key="index"
                class="direct-query-skeleton-bar h-5 w-full rounded-full"
              />
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="overview">
        <div class="grid gap-3 xl:grid-cols-3">
          <section class="team-overview-segment flex min-h-[106px] flex-col px-4 py-4">
            <div class="flex items-start justify-between gap-3">
              <p class="team-overview-kicker">
                MATCH RECORD
              </p>
              <Shield class="team-overview-icon h-4 w-4" />
            </div>
            <div class="mt-4 flex items-end gap-3">
              <span class="team-overview-hero text-[2.75rem] leading-none">{{ recordSummary.wins }}</span>
              <span class="pb-1 text-xl text-[var(--chat-muted)]">-</span>
              <span class="team-overview-hero text-[2.75rem] leading-none">{{ recordSummary.losses }}</span>
            </div>
            <p
              v-if="recordSummary.draws"
              class="mt-2 text-[11px] uppercase tracking-[0.16em] text-[var(--chat-muted)]"
            >
              Draws: {{ recordSummary.draws }}
            </p>
            <div class="mt-3 space-y-1 text-[11px] text-[var(--chat-muted)]">
              <p>Home Record: {{ formatRecord(overview.matchRecord.homeRecord) }}</p>
              <p>Away Record: {{ formatRecord(overview.matchRecord.awayRecord) }}</p>
            </div>
          </section>

          <section class="team-overview-segment flex min-h-[106px] flex-col px-4 py-4">
            <div class="flex items-start justify-between gap-3">
              <p class="team-overview-kicker">
                TOTAL POINTS
              </p>
              <BarChart3 class="team-overview-icon h-4 w-4" />
            </div>
            <div class="mt-4 flex items-end gap-2">
              <span class="team-overview-hero text-[2.35rem] leading-none">
                {{ overview.totalPoints.totalPointsWon === null ? '--' : INTEGER_FORMATTER.format(overview.totalPoints.totalPointsWon) }}
              </span>
              <span class="pb-1 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--chat-muted)]">PTS</span>
            </div>
            <p class="mt-4 text-[11px] uppercase tracking-[0.18em] text-[var(--chat-muted)]">
              Avg {{ formatDecimal(overview.totalPoints.averagePerMatch) }} / Match
            </p>
          </section>

          <section class="team-overview-segment flex min-h-[106px] flex-col px-4 py-4">
            <div class="flex items-start justify-between gap-3">
              <p class="team-overview-kicker">
                LEAGUE RANK
              </p>
              <Trophy class="team-overview-icon h-4 w-4" />
            </div>
            <div class="mt-4 flex items-end gap-2">
              <span class="team-overview-hero text-[2.35rem] leading-none">
                #{{ formatInteger(overview.leagueRank.rank, { minimumIntegerDigits: 2 }) }}
              </span>
              <span class="pb-1 text-sm text-[var(--chat-muted)]">
                / {{ formatInteger(overview.leagueRank.teamCount) }}
              </span>
            </div>
            <p class="mt-4 text-[11px] uppercase tracking-[0.18em] text-[var(--chat-muted)]">
              Pod Rank: #{{ formatInteger(overview.leagueRank.podRank, { minimumIntegerDigits: 2 }) }}
            </p>
          </section>
        </div>

        <div class="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
          <section class="team-overview-segment min-h-[188px] px-4 py-4">
            <div class="flex items-start justify-between gap-4">
              <p class="team-overview-kicker">
                WIN PERCENTAGE BREAKDOWN
              </p>
              <p class="team-overview-hero text-[2rem] leading-none">
                {{ formatPercent(overview.winBreakdown.overallWinPercentage) }}
              </p>
            </div>
            <div class="space-y-4 pt-7">
              <div
                v-for="item in winBreakdownItems"
                :key="item.key"
                class="space-y-2"
              >
                <div class="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-[var(--chat-muted)]">
                  <span>{{ item.label }}</span>
                  <span>{{ formatPercent(item.value) }}</span>
                </div>
                <div
                  :data-testid="`team-overview-win-bar-${item.key}`"
                  class="team-overview-track"
                >
                  <div
                    class="team-overview-fill"
                    :style="{
                      width: `${Math.max(0, Math.min(100, item.value ?? 0))}%`,
                    }"
                  />
                </div>
              </div>
            </div>
          </section>

          <section class="team-overview-segment min-h-[188px] px-4 py-4">
            <div class="flex items-center gap-2">
              <span class="team-overview-bullet" />
              <p class="team-overview-kicker">
                OTHER STATS
              </p>
            </div>
            <div class="space-y-4 pt-7">
              <div
                v-for="item in otherStatsItems"
                :key="item.label"
                class="flex items-center justify-between gap-4 border-b border-[color:color-mix(in_oklab,var(--chat-line),black_28%)] pb-2 last:border-b-0 last:pb-0"
              >
                <span class="text-[10px] uppercase tracking-[0.18em] text-[var(--chat-muted)]">
                  {{ item.label }}
                </span>
                <span class="team-overview-hero text-sm leading-none">
                  {{ item.value }}
                </span>
              </div>
            </div>
          </section>
        </div>
      </template>

      <p
        v-else
        class="text-sm text-[var(--chat-muted)]"
      >
        {{ props.card.errorMessage ?? "Overview unavailable." }}
      </p>
    </div>
  </DirectQueryCard>
</template>

<style scoped>
.team-overview-segment {
	border: 1px solid color-mix(in oklab, var(--chat-line), black 14%);
	border-radius: 0.85rem;
	background:
		linear-gradient(180deg, rgb(11 234 55 / 7%) 0%, transparent 34%),
		linear-gradient(
			180deg,
			color-mix(in oklab, var(--chat-panel), black 2%) 0%,
			color-mix(in oklab, var(--chat-bg), var(--chat-panel) 14%) 100%
		);
	box-shadow:
		inset 0 1px 0 rgb(11 234 55 / 18%),
		inset 0 0 0 1px rgb(11 234 55 / 3%);
}

.team-overview-kicker {
	font-size: 0.63rem;
	font-weight: 700;
	letter-spacing: 0.24em;
	text-transform: uppercase;
	color: color-mix(in oklab, var(--chat-muted), white 10%);
}

.team-overview-hero {
	color: color-mix(in oklab, var(--chat-text), white 14%);
	text-shadow: 0 0 18px rgb(11 234 55 / 10%);
}

.team-overview-icon {
	color: color-mix(in oklab, var(--chat-line), var(--chat-text) 36%);
	opacity: 0.9;
}

.team-overview-track {
	height: 0.42rem;
	overflow: hidden;
	border-radius: 9999px;
	border: 1px solid color-mix(in oklab, var(--chat-line), black 18%);
	background: color-mix(in oklab, var(--chat-panel), black 18%);
	box-shadow: inset 0 1px 2px rgb(0 0 0 / 35%);
}

.team-overview-fill {
	height: 100%;
	border-radius: 9999px;
	background: linear-gradient(
		90deg,
		color-mix(in oklab, var(--chat-glow), white 10%) 0%,
		color-mix(in oklab, var(--chat-glow), white 28%) 100%
	);
	box-shadow: 0 0 12px rgb(11 234 55 / 18%);
}

.team-overview-bullet {
	height: 0.45rem;
	width: 0.45rem;
	border-radius: 0.1rem;
	border: 1px solid color-mix(in oklab, var(--chat-glow), black 8%);
	background: rgb(11 234 55 / 12%);
	box-shadow: 0 0 10px rgb(11 234 55 / 14%);
}
</style>
