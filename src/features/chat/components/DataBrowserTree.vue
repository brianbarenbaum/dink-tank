<script setup lang="ts">
import { ChevronDown, Database, FolderTree } from "lucide-vue-next";

import type {
	DataBrowserController,
	DataBrowserDivisionBranchInput,
	DataBrowserTeamBranchInput,
} from "../data-browser/useDataBrowserController";
import type {
	DataBrowserDivisionOption,
	DataBrowserSeasonOption,
	DataBrowserTeamOption,
} from "../data-browser/types";

interface PropsDataBrowserTree {
	controller: DataBrowserController;
}

const props = defineProps<PropsDataBrowserTree>();

const DIVISION_LEAVES = [
	{ kind: "division_players", label: "Players" },
	{ kind: "division_standings", label: "Standings" },
] as const;

const TEAM_LEAVES = [
	{ kind: "team_overview", label: "Overview" },
	{ kind: "team_players", label: "Players" },
	{ kind: "team_schedule", label: "Schedule" },
] as const;

const getSeasonKey = (season: DataBrowserSeasonOption): string =>
	`${season.seasonYear}:${season.seasonNumber}`;

const getDivisionKey = (input: DataBrowserDivisionBranchInput): string =>
	`${input.seasonKey}:${input.divisionId}`;

const getTeamsBranchKey = (input: DataBrowserDivisionBranchInput): string =>
	`${getDivisionKey(input)}:teams`;

const getTeamKey = (input: DataBrowserTeamBranchInput): string =>
	`${getDivisionKey(input)}:team:${input.teamId}`;

const getDivisionsForSeason = (
	season: DataBrowserSeasonOption,
): DataBrowserDivisionOption[] =>
	props.controller.divisionsBySeasonKey.value[getSeasonKey(season)] ?? [];

const getTeamsForDivision = (
	seasonKey: string,
	divisionId: string,
): DataBrowserTeamOption[] =>
	props.controller.teamsByDivisionKey.value[`${seasonKey}:${divisionId}`] ?? [];

const isSeasonExpanded = (season: DataBrowserSeasonOption): boolean =>
	props.controller.expandedSeasonKeys.value.has(getSeasonKey(season));

const isDivisionExpanded = (
	seasonKey: string,
	division: DataBrowserDivisionOption,
): boolean =>
	props.controller.expandedDivisionKeys.value.has(
		getDivisionKey({
			seasonKey,
			divisionId: division.divisionId,
		}),
	);

const isTeamsBranchExpanded = (
	seasonKey: string,
	divisionId: string,
): boolean =>
	props.controller.expandedTeamKeys.value.has(
		getTeamsBranchKey({
			seasonKey,
			divisionId,
		}),
	);

const isTeamExpanded = (
	seasonKey: string,
	divisionId: string,
	teamId: string,
): boolean =>
	props.controller.expandedTeamKeys.value.has(
		getTeamKey({
			seasonKey,
			divisionId,
			teamId,
		}),
	);

const getTreeChevronClass = (isExpanded: boolean): string =>
	isExpanded ? "-rotate-45" : "-rotate-90";

const onTeamLeafClick = async (input: {
	leafKind: "team_overview" | "team_players" | "team_schedule";
	season: DataBrowserSeasonOption;
	division: DataBrowserDivisionOption;
	team: DataBrowserTeamOption;
}): Promise<void> => {
	await props.controller.executeTeamLeafQuery(input);
};
</script>

<template>
  <div
    class="flex flex-col gap-2"
    data-testid="data-browser-tree"
  >
    <p
      v-if="props.controller.isInitializing.value"
      class="px-3 py-2 text-xs text-[var(--chat-muted)]"
    >
      Loading data browser tree...
    </p>
    <p
      v-else-if="props.controller.initializationError.value"
      class="px-3 py-2 text-xs text-[var(--chat-muted)]"
    >
      {{ props.controller.initializationError.value }}
    </p>
    <p
      v-else-if="props.controller.seasons.value.length === 0"
      class="px-3 py-2 text-xs text-[var(--chat-muted)]"
    >
      No seasons available.
    </p>
    <ul
      v-else
      class="flex flex-col gap-1"
    >
      <li
        v-for="season in props.controller.seasons.value"
        :key="getSeasonKey(season)"
        class="flex flex-col gap-1"
      >
        <button
          :data-testid="`data-browser-season-${season.seasonYear}-${season.seasonNumber}`"
          :aria-expanded="isSeasonExpanded(season)"
          type="button"
          class="flex min-h-10 items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium cursor-pointer transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"
          @click="void props.controller.toggleSeason(getSeasonKey(season))"
        >
          <ChevronDown
            class="h-4 w-4 shrink-0 transition-transform duration-150"
            :class="getTreeChevronClass(isSeasonExpanded(season))"
          />
          <FolderTree class="h-4 w-4 shrink-0 text-[var(--chat-muted)]" />
          <span>{{ season.label }}</span>
        </button>

        <div
          v-if="isSeasonExpanded(season)"
          class="ml-4 flex flex-col gap-1 border-l pl-3"
        >
          <p
            v-if="props.controller.isLoadingDivisionsBySeasonKey.value[getSeasonKey(season)]"
            class="px-2 py-2 text-xs text-[var(--chat-muted)]"
          >
            Loading divisions...
          </p>
          <p
            v-else-if="props.controller.divisionErrorBySeasonKey.value[getSeasonKey(season)]"
            class="px-2 py-2 text-xs text-[var(--chat-muted)]"
          >
            {{ props.controller.divisionErrorBySeasonKey.value[getSeasonKey(season)] }}
          </p>
          <p
            v-else-if="getDivisionsForSeason(season).length === 0"
            class="px-2 py-2 text-xs text-[var(--chat-muted)]"
          >
            No divisions available.
          </p>
          <ul
            v-else
            class="flex flex-col gap-1"
          >
            <li
              v-for="division in getDivisionsForSeason(season)"
              :key="division.divisionId"
              class="flex flex-col gap-1"
            >
              <button
                :data-testid="`data-browser-division-${division.divisionId}`"
                :aria-expanded="isDivisionExpanded(getSeasonKey(season), division)"
                type="button"
                class="flex min-h-10 items-center gap-2 rounded-md px-2 py-2 text-left text-sm cursor-pointer transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"
                @click="
                  void props.controller.toggleDivision({
                    seasonKey: getSeasonKey(season),
                    divisionId: division.divisionId,
                  })
                "
              >
                <ChevronDown
                  class="h-4 w-4 shrink-0 transition-transform duration-150"
                  :class="getTreeChevronClass(isDivisionExpanded(getSeasonKey(season), division))"
                />
                <span>{{ division.divisionName }}</span>
              </button>

              <div
                v-if="isDivisionExpanded(getSeasonKey(season), division)"
                class="ml-4 flex flex-col gap-1 border-l pl-3"
              >
                <button
                  v-for="leaf in DIVISION_LEAVES"
                  :key="leaf.kind"
                  :data-testid="`data-browser-leaf-${leaf.kind}-${division.divisionId}`"
                  type="button"
                  class="flex min-h-10 items-center gap-2 rounded-md px-2 py-2 text-left text-sm cursor-pointer transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"
                  @click="
                    void props.controller.executeDivisionLeafQuery({
                      leafKind: leaf.kind,
                      season,
                      division,
                    })
                  "
                >
                  <Database class="h-4 w-4 shrink-0 text-[var(--chat-muted)]" />
                  <span>{{ leaf.label }}</span>
                </button>

                <button
                  :data-testid="`data-browser-teams-branch-${division.divisionId}`"
                  :aria-expanded="
                    isTeamsBranchExpanded(getSeasonKey(season), division.divisionId)
                  "
                  type="button"
                  class="flex min-h-10 items-center gap-2 rounded-md px-2 py-2 text-left text-sm cursor-pointer transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"
                  @click="
                    void props.controller.toggleTeamsBranch({
                      seasonKey: getSeasonKey(season),
                      divisionId: division.divisionId,
                    })
                  "
                >
                  <ChevronDown
                    class="h-4 w-4 shrink-0 transition-transform duration-150"
                    :class="
                      getTreeChevronClass(
                        isTeamsBranchExpanded(getSeasonKey(season), division.divisionId),
                      )
                    "
                  />
                  <span>Teams</span>
                </button>

                <div
                  v-if="isTeamsBranchExpanded(getSeasonKey(season), division.divisionId)"
                  class="ml-4 flex flex-col gap-1 border-l pl-3"
                >
                  <p
                    v-if="
                      props.controller.isLoadingTeamsByDivisionKey.value[
                        `${getSeasonKey(season)}:${division.divisionId}`
                      ]
                    "
                    class="px-2 py-2 text-xs text-[var(--chat-muted)]"
                  >
                    Loading teams...
                  </p>
                  <p
                    v-else-if="
                      props.controller.teamErrorByDivisionKey.value[
                        `${getSeasonKey(season)}:${division.divisionId}`
                      ]
                    "
                    class="px-2 py-2 text-xs text-[var(--chat-muted)]"
                  >
                    {{
                      props.controller.teamErrorByDivisionKey.value[
                        `${getSeasonKey(season)}:${division.divisionId}`
                      ]
                    }}
                  </p>
                  <p
                    v-else-if="
                      getTeamsForDivision(getSeasonKey(season), division.divisionId)
                        .length === 0
                    "
                    class="px-2 py-2 text-xs text-[var(--chat-muted)]"
                  >
                    No teams available.
                  </p>
                  <ul
                    v-else
                    class="flex flex-col gap-1"
                  >
                    <li
                      v-for="team in getTeamsForDivision(
                        getSeasonKey(season),
                        division.divisionId,
                      )"
                      :key="team.teamId"
                      class="flex flex-col gap-1"
                    >
                      <button
                        :data-testid="`data-browser-team-${team.teamId}`"
                        :aria-expanded="
                          isTeamExpanded(
                            getSeasonKey(season),
                            division.divisionId,
                            team.teamId,
                          )
                        "
                        type="button"
                        class="flex min-h-10 items-center gap-2 rounded-md px-2 py-2 text-left text-sm cursor-pointer transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"
                        @click="
                          props.controller.toggleTeam({
                            seasonKey: getSeasonKey(season),
                            divisionId: division.divisionId,
                            teamId: team.teamId,
                          })
                        "
                      >
                        <ChevronDown
                          class="h-4 w-4 shrink-0 transition-transform duration-150"
                          :class="
                            getTreeChevronClass(
                              isTeamExpanded(
                                getSeasonKey(season),
                                division.divisionId,
                                team.teamId,
                              ),
                            )
                          "
                        />
                        <span>{{ team.teamName }}</span>
                      </button>

                      <div
                        v-if="
                          isTeamExpanded(
                            getSeasonKey(season),
                            division.divisionId,
                            team.teamId,
                          )
                        "
                        class="ml-4 flex flex-col gap-1 border-l pl-3"
                      >
                        <button
                          v-for="leaf in TEAM_LEAVES"
                          :key="leaf.kind"
                          :data-testid="`data-browser-leaf-${leaf.kind}-${team.teamId}`"
                          type="button"
                          class="flex min-h-10 items-center gap-2 rounded-md px-2 py-2 text-left text-sm cursor-pointer transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"
                          @click="
                            void onTeamLeafClick({
                              leafKind: leaf.kind,
                              season,
                              division,
                              team,
                            })
                          "
                        >
                          <Database
                            class="h-4 w-4 shrink-0 text-[var(--chat-muted)]"
                          />
                          <span>{{ leaf.label }}</span>
                        </button>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </li>
    </ul>
  </div>
</template>
