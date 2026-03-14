<script setup lang="ts">
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-vue-next";
import { computed, ref, watch } from "vue";

import DirectQueryCard from "./DirectQueryCard.vue";

import type { DirectQueryCardItem, DirectQueryTablePayload } from "../types";

interface PropsDirectQueryTableCard {
	card: DirectQueryCardItem;
	showPagination?: boolean;
}

const FALLBACK_LOADING_COLUMNS: Partial<
	Record<DirectQueryCardItem["queryType"], DirectQueryTablePayload["columns"]>
> = {
	division_players: [
		{ key: "ranking", label: "Rank" },
		{ key: "playerName", label: "Player" },
		{ key: "teamName", label: "Team" },
		{ key: "record", label: "Record" },
		{ key: "winRate", label: "Win %" },
		{ key: "dupr", label: "DUPR" },
	],
	division_standings: [
		{ key: "ranking", label: "Rank" },
		{ key: "teamName", label: "Team" },
		{ key: "record", label: "Record" },
		{ key: "winPercentage", label: "Win %" },
		{ key: "podName", label: "Pod" },
		{ key: "pointDiff", label: "Point Diff" },
	],
	team_players: [
		{ key: "ranking", label: "Rank" },
		{ key: "playerName", label: "Player" },
		{ key: "teamName", label: "Team" },
		{ key: "record", label: "Record" },
		{ key: "winRate", label: "Win %" },
		{ key: "dupr", label: "DUPR" },
	],
};

const DEFAULT_LOADING_COLUMNS: DirectQueryTablePayload["columns"] = [
	{ key: "primary", label: "Value" },
];

const SORTABLE_COLUMNS: Partial<
	Record<DirectQueryCardItem["queryType"], string[]>
> = {
	division_players: ["ranking", "playerName", "teamName"],
	team_players: ["ranking", "playerName", "teamName"],
	division_standings: ["ranking", "teamName", "winPercentage", "podName"],
};

const LOADING_CELL_WIDTH_CLASSES = [
	"w-10",
	"w-32",
	"w-24",
	"w-20",
	"w-16",
	"w-20",
] as const;

const props = withDefaults(defineProps<PropsDirectQueryTableCard>(), {
	showPagination: true,
});
const emit = defineEmits<{
	paginate: [page: number];
	sort: [sortKey: string];
}>();

const tablePayload = computed<DirectQueryTablePayload | null>(() => {
	const payload = props.card.payload;
	if (!payload || !("columns" in payload) || !("rows" in payload)) {
		return null;
	}

	if (!Array.isArray(payload.columns) || !Array.isArray(payload.rows)) {
		return null;
	}

	return payload as DirectQueryTablePayload;
});
const playerSearchQuery = ref("");

const loadingColumns = computed(() => {
	const columns = tablePayload.value?.columns;
	if (columns && columns.length > 0) {
		return columns;
	}

	return (
		FALLBACK_LOADING_COLUMNS[props.card.queryType] ?? DEFAULT_LOADING_COLUMNS
	);
});

const showsPlayerSearch = computed(
	() =>
		!props.showPagination &&
		(props.card.queryType === "division_players" ||
			props.card.queryType === "team_players"),
);

const normalizedPlayerSearchQuery = computed(() =>
	playerSearchQuery.value.trim().toLowerCase(),
);

const visibleRows = computed(() => {
	if (!tablePayload.value) {
		return [];
	}

	if (
		!showsPlayerSearch.value ||
		normalizedPlayerSearchQuery.value.length === 0
	) {
		return tablePayload.value.rows;
	}

	return tablePayload.value.rows.filter((row) =>
		String(row.playerName ?? "")
			.toLowerCase()
			.includes(normalizedPlayerSearchQuery.value),
	);
});

const isFilteringPlayers = computed(
	() => showsPlayerSearch.value && normalizedPlayerSearchQuery.value.length > 0,
);

const filteredRowsLabel = computed(() => {
	const rowCount = visibleRows.value.length;
	return rowCount === 1 ? "1 match" : `${rowCount} matches`;
});

const loadingRowIndexes = computed(() =>
	Array.from(
		{
			length: props.showPagination
				? props.card.pageSize > 0
					? props.card.pageSize
					: 10
				: 10,
		},
		(_, index) => index,
	),
);

const pageLabel = computed(() => {
	const totalPages = props.card.totalPages ?? 0;
	return `Page ${props.card.page} of ${totalPages}`;
});

const totalRowsLabel = computed(() => {
	const totalRows = props.card.totalRows ?? 0;
	return totalRows === 1 ? "1 row" : `${totalRows} rows`;
});

const loadedRowsLabel = computed(() => {
	const rowCount = tablePayload.value?.rows.length ?? 0;
	const totalRows = props.card.totalRows ?? rowCount;
	if (rowCount >= totalRows) {
		return totalRows === 1 ? "1 row loaded" : `${totalRows} rows loaded`;
	}
	return `${rowCount} of ${totalRows} rows loaded`;
});

watch(
	() => props.card.id,
	() => {
		playerSearchQuery.value = "";
	},
);

const canGoToPreviousPage = computed(
	() => props.card.status !== "loading" && props.card.page > 1,
);

const canGoToNextPage = computed(() => {
	const totalPages = props.card.totalPages ?? 1;
	return props.card.status !== "loading" && props.card.page < totalPages;
});

const sortableColumnKeys = computed(
	() => new Set(SORTABLE_COLUMNS[props.card.queryType] ?? []),
);

const isSortableColumn = (columnKey: string): boolean =>
	sortableColumnKeys.value.has(columnKey);

const isSortedColumn = (columnKey: string): boolean =>
	props.card.sortKey === columnKey;

const getNextSortDirection = (columnKey: string): "asc" | "desc" =>
	isSortedColumn(columnKey) && props.card.sortDirection === "asc"
		? "desc"
		: "asc";

const getAriaSort = (
	columnKey: string,
): "ascending" | "descending" | "none" | undefined => {
	if (!isSortableColumn(columnKey)) {
		return undefined;
	}
	if (!isSortedColumn(columnKey)) {
		return "none";
	}
	return props.card.sortDirection === "desc" ? "descending" : "ascending";
};

const getSortButtonAriaLabel = (
	columnLabel: string,
	columnKey: string,
): string => `Sort by ${columnLabel} ${getNextSortDirection(columnKey)}`;

const onPreviousPage = (): void => {
	if (!canGoToPreviousPage.value) {
		return;
	}
	emit("paginate", props.card.page - 1);
};

const onNextPage = (): void => {
	if (!canGoToNextPage.value) {
		return;
	}
	emit("paginate", props.card.page + 1);
};

const onSort = (columnKey: string): void => {
	if (!isSortableColumn(columnKey)) {
		return;
	}
	emit("sort", columnKey);
};

const getLoadingCellWidthClass = (columnIndex: number): string =>
	LOADING_CELL_WIDTH_CLASSES[columnIndex % LOADING_CELL_WIDTH_CLASSES.length] ??
	"w-24";
</script>

<template>
  <DirectQueryCard
    :card="props.card"
    :class="props.showPagination ? '' : 'min-h-0 flex-1'"
  >
    <template v-if="showsPlayerSearch" #header-extra>
      <div class="w-full">
        <label
          for="direct-query-player-search"
          class="sr-only"
        >
          Search player names
        </label>
        <input
          id="direct-query-player-search"
          v-model="playerSearchQuery"
          data-testid="direct-query-player-search"
          type="text"
          class="h-14 w-full max-w-sm rounded-md border px-4 text-sm focus-visible:outline-none focus-visible:ring-2"
          placeholder="Search player names..."
        />
      </div>
    </template>
    <div
      v-if="props.card.status === 'loading'"
      class="flex flex-col gap-3"
    >
      <p
        class="sr-only"
        aria-live="polite"
      >
        Loading query results...
      </p>
      <div class="overflow-x-auto">
        <table
          class="direct-query-table min-w-full border-collapse text-left text-sm"
          aria-hidden="true"
        >
          <thead>
            <tr class="border-b text-xs uppercase tracking-[0.16em] text-[var(--chat-muted)]">
              <th
                v-for="column in loadingColumns"
                :key="column.key"
                class="px-3 py-2 font-semibold"
                scope="col"
              >
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="rowIndex in loadingRowIndexes"
              :key="`${props.card.id}-loading-row-${rowIndex}`"
              data-testid="direct-query-loading-row"
              class="border-b last:border-b-0"
            >
              <td
                v-for="(column, columnIndex) in loadingColumns"
                :key="`${column.key}-loading-${rowIndex}`"
                class="px-3 py-2"
              >
                <div
                  class="direct-query-skeleton-bar h-4 animate-pulse rounded-sm"
                  :class="getLoadingCellWidthClass(columnIndex)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <p
      v-else-if="props.card.status === 'error'"
      class="text-sm text-[var(--chat-muted)]"
      aria-live="polite"
    >
      {{ props.card.errorMessage ?? "Unable to load direct query results." }}
    </p>
    <p
      v-else-if="props.card.status === 'empty' || !tablePayload || tablePayload.rows.length === 0"
      class="text-sm text-[var(--chat-muted)]"
      aria-live="polite"
    >
      No results found for this query.
    </p>
    <div
      v-else
      data-testid="direct-query-table-scroll-region"
      :class="
        props.showPagination
          ? 'overflow-x-auto'
          : 'chat-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-auto'
      "
    >
      <table class="direct-query-table min-w-full border-collapse text-left text-sm">
        <thead
          data-testid="direct-query-table-header"
          :class="props.showPagination ? '' : 'sticky top-0 z-10'"
        >
          <tr class="border-b text-xs uppercase tracking-[0.16em] text-[var(--chat-muted)]">
            <th
              v-for="column in tablePayload.columns"
              :key="column.key"
              class="px-3 py-2 font-semibold"
              scope="col"
              :aria-sort="getAriaSort(column.key)"
            >
              <button
                v-if="isSortableColumn(column.key)"
                type="button"
                :data-testid="`direct-query-sort-${column.key}`"
                class="inline-flex cursor-pointer items-center gap-1 rounded-sm py-1 text-left transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1"
                :class="isSortedColumn(column.key) ? 'opacity-100' : 'opacity-70'"
                :aria-label="getSortButtonAriaLabel(column.label, column.key)"
                @click="onSort(column.key)"
              >
                <span>{{ column.label }}</span>
                <ChevronUp
                  v-if="isSortedColumn(column.key) && props.card.sortDirection !== 'desc'"
                  class="h-3.5 w-3.5 shrink-0"
                />
                <ChevronDown
                  v-else-if="isSortedColumn(column.key)"
                  class="h-3.5 w-3.5 shrink-0"
                />
                <ArrowUpDown
                  v-else
                  class="h-3.5 w-3.5 shrink-0"
                />
              </button>
              <span v-else>{{ column.label }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIndex) in visibleRows"
            :key="`${props.card.id}-row-${rowIndex}`"
            class="border-b last:border-b-0"
          >
            <td
              v-for="column in tablePayload.columns"
              :key="`${column.key}-${rowIndex}`"
              class="px-3 py-2 text-[var(--chat-text)]"
            >
              {{ row[column.key] ?? "—" }}
            </td>
          </tr>
          <tr
            v-if="visibleRows.length === 0"
            data-testid="direct-query-no-filtered-rows"
            class="border-b last:border-b-0"
          >
            <td
              :colspan="tablePayload.columns.length"
              class="px-3 py-4 text-sm text-[var(--chat-muted)]"
            >
              No players match this search.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <template #footer>
      <footer
        class="direct-query-pagination flex flex-col gap-3 pt-3 text-xs text-[var(--chat-muted)] sm:flex-row sm:items-center sm:justify-between"
      >
        <div
          v-if="props.showPagination"
          class="flex items-center gap-2"
        >
          <button
            type="button"
            data-testid="direct-query-previous-page"
            class="h-9 cursor-pointer rounded-md border px-3 text-[10px] font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canGoToPreviousPage"
            aria-label="Previous page"
            @click="onPreviousPage"
          >
            Previous
          </button>
          <button
            type="button"
            data-testid="direct-query-next-page"
            class="h-9 cursor-pointer rounded-md border px-3 text-[10px] font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canGoToNextPage"
            aria-label="Next page"
            @click="onNextPage"
          >
            Next
          </button>
        </div>
        <div class="flex items-center justify-between gap-3 sm:justify-end">
          <span v-if="props.showPagination">{{ pageLabel }}</span>
          <span v-else-if="isFilteringPlayers">{{ filteredRowsLabel }}</span>
          <span v-else>{{ loadedRowsLabel }}</span>
          <span>{{ totalRowsLabel }}</span>
        </div>
      </footer>
    </template>
  </DirectQueryCard>
</template>
