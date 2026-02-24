import { computed, ref, type ComputedRef, type Ref } from "vue";

import { createLineupLabClient, type LineupLabClient } from "./lineupLabClient";
import {
	SCHEDULE_SLOT_TEMPLATE,
	SCHEDULE_SLOTS,
	type SlotTemplateEntry,
} from "./schedule";
import type {
	LineupLabDivisionOption,
	LineupLabMatchupOption,
	LineupLabMode,
	LineupLabTeamOption,
	LineupRecommendationPayload,
	LineupRosterPlayer,
	OpponentAssignmentsBySlot,
	OpponentRosterPlayer,
} from "./types";

const MIN_PLAYERS = 8;

const slotKey = (roundNumber: number, slotNumber: number): string =>
	`${roundNumber}:${slotNumber}`;

const isAvailabilityValid = (availablePlayerIds: string[]): boolean =>
	availablePlayerIds.length >= MIN_PLAYERS && availablePlayerIds.length % 2 === 0;

const hasValidOpponentPair = (
	assignment: { playerAId: string | null; playerBId: string | null } | undefined,
	opponentPlayerIds: Set<string>,
): boolean => {
	if (!assignment?.playerAId || !assignment.playerBId) {
		return false;
	}
	if (assignment.playerAId === assignment.playerBId) {
		return false;
	}
	if (!opponentPlayerIds.has(assignment.playerAId)) {
		return false;
	}
	if (!opponentPlayerIds.has(assignment.playerBId)) {
		return false;
	}
	return true;
};

export interface LineupLabController {
	lineupDivisions: Ref<LineupLabDivisionOption[]>;
	lineupTeams: Ref<LineupLabTeamOption[]>;
	lineupMatchups: Ref<LineupLabMatchupOption[]>;
	lineupRosterPlayers: Ref<LineupRosterPlayer[]>;
	opponentRosterPlayers: ComputedRef<OpponentRosterPlayer[]>;
	selectedDivisionId: Ref<string | null>;
	selectedTeamId: Ref<string | null>;
	selectedMatchupId: Ref<string | null>;
	selectedAvailablePlayerIds: Ref<string[]>;
	mode: Ref<LineupLabMode>;
	opponentAssignments: Ref<OpponentAssignmentsBySlot>;
	recommendationResult: Ref<LineupRecommendationPayload | null>;
	isLoadingDivisions: Ref<boolean>;
	isLoadingTeams: Ref<boolean>;
	isLoadingMatchups: Ref<boolean>;
	isCalculating: Ref<boolean>;
	errorMessage: Ref<string | null>;
	knownOpponentCompletionError: ComputedRef<string | null>;
	canCalculate: ComputedRef<boolean>;
	selectLineupDivision: (divisionId: string) => Promise<void>;
	selectLineupTeam: (teamId: string) => Promise<void>;
	selectLineupMatchup: (matchupId: string) => void;
	selectLineupPlayerAvailability: (
		playerId: string,
		isAvailable: boolean,
	) => void;
	setMode: (mode: LineupLabMode) => void;
	setOpponentSlotAssignment: (
		roundNumber: number,
		slotNumber: number,
		playerAId: string | null,
		playerBId: string | null,
	) => void;
	calculate: () => Promise<void>;
}

export function createLineupLabController(client: LineupLabClient): LineupLabController {
	const lineupDivisions = ref<LineupLabDivisionOption[]>([]);
	const lineupTeams = ref<LineupLabTeamOption[]>([]);
	const lineupMatchups = ref<LineupLabMatchupOption[]>([]);
	const lineupRosterPlayers = ref<LineupRosterPlayer[]>([]);
	const selectedDivisionId = ref<string | null>(null);
	const selectedTeamId = ref<string | null>(null);
	const selectedMatchupId = ref<string | null>(null);
	const selectedAvailablePlayerIds = ref<string[]>([]);
	const mode = ref<LineupLabMode>("blind");
	const opponentAssignments = ref<OpponentAssignmentsBySlot>({});
	const recommendationResult = ref<LineupRecommendationPayload | null>(null);
	const isLoadingDivisions = ref(true);
	const isLoadingTeams = ref(false);
	const isLoadingMatchups = ref(false);
	const isCalculating = ref(false);
	const errorMessage = ref<string | null>(null);
	const availabilityOverrides = new Map<string, boolean>();
	let teamLoadRequestId = 0;
	let matchupLoadRequestId = 0;
	let initializationPromise: Promise<void> | null = null;

	const selectedMatchup = computed(() =>
		lineupMatchups.value.find(
			(matchup) => matchup.matchupId === selectedMatchupId.value,
		),
	);

	const opponentRosterPlayers = computed(
		() => selectedMatchup.value?.opponentRosterPlayers ?? [],
	);

	const knownOpponentCompletionError = computed(() => {
		if (mode.value !== "known_opponent") {
			return null;
		}
		const opponentPlayerIds = new Set(
			opponentRosterPlayers.value.map((player) => player.playerId),
		);
		if (opponentPlayerIds.size === 0) {
			return "Opponent roster is unavailable for this matchup.";
		}

		for (const slot of SCHEDULE_SLOTS) {
			const assignment = opponentAssignments.value[
				slotKey(slot.roundNumber, slot.slotNumber)
			];
			if (!hasValidOpponentPair(assignment, opponentPlayerIds)) {
				return "Complete all opponent assignments before calculating.";
			}
		}

		return null;
	});

	const canCalculate = computed(
		() =>
			Boolean(selectedDivisionId.value) &&
			Boolean(selectedTeamId.value) &&
			Boolean(selectedMatchupId.value) &&
			isAvailabilityValid(selectedAvailablePlayerIds.value) &&
			(mode.value !== "known_opponent" || knownOpponentCompletionError.value === null),
	);

	const resetRecommendation = () => {
		recommendationResult.value = null;
	};

	const resetOpponentAssignments = () => {
		opponentAssignments.value = Object.fromEntries(
			SCHEDULE_SLOTS.map((slot) => [
				slotKey(slot.roundNumber, slot.slotNumber),
				{ playerAId: null, playerBId: null },
			]),
		);
	};

	const selectLineupDivision = async (divisionId: string) => {
		if (!divisionId) {
			return;
		}
		errorMessage.value = null;
		resetRecommendation();
		resetOpponentAssignments();
		const requestId = ++teamLoadRequestId;
		selectedDivisionId.value = divisionId;
		selectedTeamId.value = null;
		selectedMatchupId.value = null;
		lineupTeams.value = [];
		lineupMatchups.value = [];
		lineupRosterPlayers.value = [];
		selectedAvailablePlayerIds.value = [];
		isLoadingTeams.value = true;
		isLoadingMatchups.value = false;

		try {
			const response = await client.getTeams(divisionId);
			if (requestId !== teamLoadRequestId) {
				return;
			}
			lineupTeams.value = response.teams;
		} catch {
			if (requestId === teamLoadRequestId) {
				errorMessage.value = "Unable to load teams for selected division.";
			}
		} finally {
			if (requestId === teamLoadRequestId) {
				isLoadingTeams.value = false;
			}
		}
	};

	const selectLineupTeam = async (teamId: string) => {
		if (!teamId) {
			return;
		}
		errorMessage.value = null;
		resetRecommendation();
		resetOpponentAssignments();
		const requestId = ++matchupLoadRequestId;
		selectedTeamId.value = teamId;
		selectedMatchupId.value = null;
		lineupMatchups.value = [];
		lineupRosterPlayers.value = [];
		selectedAvailablePlayerIds.value = [];
		isLoadingMatchups.value = true;

		const division = lineupDivisions.value.find(
			(item) => item.divisionId === selectedDivisionId.value,
		);
		if (!division) {
			isLoadingMatchups.value = false;
			return;
		}

		try {
			const response = await client.getMatchups({
				divisionId: division.divisionId,
				teamId,
				seasonYear: division.seasonYear,
				seasonNumber: division.seasonNumber,
			});
			if (requestId !== matchupLoadRequestId) {
				return;
			}
			lineupMatchups.value = response.matchups;
			lineupRosterPlayers.value = response.rosterPlayers;
			const seededSelection =
				response.suggestedAvailablePlayerIds.length > 0
					? response.suggestedAvailablePlayerIds
					: response.availablePlayerIds;
			const rosterIds = new Set(
				lineupRosterPlayers.value.map((player) => player.playerId),
			);
			const selected = new Set(seededSelection);
			for (const [playerId, isAvailable] of availabilityOverrides.entries()) {
				if (isAvailable) {
					selected.add(playerId);
				} else {
					selected.delete(playerId);
				}
			}
			selectedAvailablePlayerIds.value = [
				...lineupRosterPlayers.value
					.map((player) => player.playerId)
					.filter((playerId) => selected.has(playerId)),
				...seededSelection.filter(
					(playerId) => selected.has(playerId) && !rosterIds.has(playerId),
				),
			];
			selectedMatchupId.value = response.matchups[0]?.matchupId ?? null;
			resetOpponentAssignments();
		} catch {
			if (requestId === matchupLoadRequestId) {
				errorMessage.value = "Unable to load matchups for selected team.";
			}
		} finally {
			if (requestId === matchupLoadRequestId) {
				isLoadingMatchups.value = false;
			}
		}
	};

	const selectLineupMatchup = (matchupId: string) => {
		selectedMatchupId.value = matchupId;
		resetRecommendation();
		resetOpponentAssignments();
		errorMessage.value = null;
	};

	const selectLineupPlayerAvailability = (
		playerId: string,
		isAvailable: boolean,
	) => {
		if (isAvailable) {
			if (!selectedAvailablePlayerIds.value.includes(playerId)) {
				selectedAvailablePlayerIds.value = [
					...selectedAvailablePlayerIds.value,
					playerId,
				];
			}
		} else {
			selectedAvailablePlayerIds.value = selectedAvailablePlayerIds.value.filter(
				(candidateId) => candidateId !== playerId,
			);
		}
		availabilityOverrides.set(playerId, isAvailable);
		resetRecommendation();
	};

	const setMode = (nextMode: LineupLabMode) => {
		mode.value = nextMode;
		errorMessage.value = null;
		resetRecommendation();
	};

	const setOpponentSlotAssignment = (
		roundNumber: number,
		slotNumber: number,
		playerAId: string | null,
		playerBId: string | null,
	) => {
		opponentAssignments.value = {
			...opponentAssignments.value,
			[slotKey(roundNumber, slotNumber)]: {
				playerAId,
				playerBId,
			},
		};
		resetRecommendation();
	};

	const buildOpponentRounds = (): Array<{
		roundNumber: number;
		games: Array<{
			roundNumber: number;
			slotNumber: number;
			matchType: SlotTemplateEntry["matchType"];
			opponentPlayerAId: string;
			opponentPlayerBId: string;
		}>;
	}> =>
		SCHEDULE_SLOT_TEMPLATE.map((slotTypes, roundIndex) => {
			const roundNumber = roundIndex + 1;
			return {
				roundNumber,
				games: slotTypes.map((matchType, slotIndex) => {
					const slotNumber = slotIndex + 1;
					const assignment =
						opponentAssignments.value[slotKey(roundNumber, slotNumber)] ?? {
							playerAId: "",
							playerBId: "",
						};
					return {
						roundNumber,
						slotNumber,
						matchType,
						opponentPlayerAId: assignment.playerAId ?? "",
						opponentPlayerBId: assignment.playerBId ?? "",
					};
				}),
			};
		});

	const calculate = async () => {
		if (isCalculating.value) {
			return;
		}
		if (initializationPromise) {
			await initializationPromise;
		}
		errorMessage.value = null;

		const selectedDivision = lineupDivisions.value.find(
			(division) => division.divisionId === selectedDivisionId.value,
		);
		const selectedTeam = lineupTeams.value.find(
			(team) => team.teamId === selectedTeamId.value,
		);
		const selectedMatchupValue = selectedMatchup.value;

		if (!selectedDivision || !selectedTeam || !selectedMatchupValue) {
			errorMessage.value =
				"Select a division, team, and matchup before recommending pairings.";
			return;
		}
		if (!isAvailabilityValid(selectedAvailablePlayerIds.value)) {
			errorMessage.value =
				"Select an even number of available players (minimum 8).";
			return;
		}
		if (mode.value === "known_opponent" && knownOpponentCompletionError.value) {
			errorMessage.value = knownOpponentCompletionError.value;
			return;
		}

		isCalculating.value = true;
		try {
			const payload = {
				divisionId: selectedDivision.divisionId,
				seasonYear: selectedDivision.seasonYear,
				seasonNumber: selectedDivision.seasonNumber,
				teamId: selectedTeam.teamId,
				oppTeamId: selectedMatchupValue.oppTeamId,
				matchupId: selectedMatchupValue.matchupId,
				mode: mode.value,
				availablePlayerIds: selectedAvailablePlayerIds.value,
				objective: "MAX_EXPECTED_WINS" as const,
				maxRecommendations: 3,
				downsideQuantile: 0.2,
				scenarioLimit: 12,
				...(mode.value === "known_opponent"
					? {
						opponentRounds: buildOpponentRounds(),
					}
					: {}),
			};
			recommendationResult.value = await client.recommend(payload);
		} catch (error) {
			errorMessage.value =
				error instanceof Error && error.message.length > 0
					? error.message
					: "Unable to generate lineup recommendations. Try again.";
		} finally {
			isCalculating.value = false;
		}
	};

	resetOpponentAssignments();
	initializationPromise = client
		.getDivisions()
		.then((response) => {
			lineupDivisions.value = response.divisions;
		})
		.catch(() => {
			errorMessage.value = "Unable to load lineup lab context.";
		})
		.finally(() => {
			isLoadingDivisions.value = false;
			initializationPromise = null;
		});

	return {
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
		errorMessage,
		knownOpponentCompletionError,
		canCalculate,
		selectLineupDivision,
		selectLineupTeam,
		selectLineupMatchup,
		selectLineupPlayerAvailability,
		setMode,
		setOpponentSlotAssignment,
		calculate,
	};
}

export const useLineupLabController = (): LineupLabController => {
	const client = createLineupLabClient(fetch, () => null);
	return createLineupLabController(client);
};
