import { ref, type Ref } from "vue";

import {
	createChatClient,
	type ChatBackendMode,
	type ChatSendMessage,
	type ChatSendOptions,
} from "./chatClient";
import {
	createLineupLabClient,
	type LineupLabRosterPlayer,
} from "./lineupLabClient";
import type { ChatMessage, LineupRecommendationPayload } from "./types";

export interface ChatController {
	messages: Ref<ChatMessage[]>;
	isSending: Ref<boolean>;
	errorMessage: Ref<string | null>;
	modelLabel: Ref<string>;
	extendedThinking: Ref<boolean>;
	lineupDivisions: Ref<
		Array<{
			divisionId: string;
			divisionName: string;
			seasonYear: number;
			seasonNumber: number;
			location: string;
		}>
	>;
	lineupTeams: Ref<Array<{ teamId: string; teamName: string }>>;
	lineupMatchups: Ref<
		Array<{
			matchupId: string;
			weekNumber: number | null;
			scheduledTime: string | null;
			teamId: string;
			oppTeamId: string;
			teamName: string;
			oppTeamName: string;
		}>
	>;
	lineupRosterPlayers: Ref<LineupLabRosterPlayer[]>;
	selectedDivisionId: Ref<string | null>;
	selectedTeamId: Ref<string | null>;
	selectedMatchupId: Ref<string | null>;
	selectedAvailablePlayerIds: Ref<string[]>;
	isLoadingTeams: Ref<boolean>;
	isLoadingMatchups: Ref<boolean>;
	submit: (value: string) => Promise<void>;
	selectLineupDivision: (divisionId: string) => Promise<void>;
	selectLineupTeam: (teamId: string) => Promise<void>;
	selectLineupMatchup: (matchupId: string) => void;
	selectLineupPlayerAvailability: (
		playerId: string,
		isAvailable: boolean,
	) => void;
	runLineupLabRecommend: () => Promise<void>;
}

const seedMessages: ChatMessage[] = [
	{
		id: "seed-assistant",
		role: "assistant",
		content: "Welcome back, Captain.  What do you need help with today?",
		createdAt: new Date(0).toISOString(),
	},
];

export function createChatController(
	send: (
		messages: ChatSendMessage[],
		options?: ChatSendOptions,
	) => Promise<{ reply: string; model: string }>,
	recommendLineup: (input: {
		divisionId: string;
		seasonYear: number;
		seasonNumber: number;
		teamId: string;
		oppTeamId: string;
		matchupId: string;
		availablePlayerIds: string[];
	}) => Promise<LineupRecommendationPayload>,
	loadDivisions: () => Promise<{
		divisions: Array<{
			divisionId: string;
			divisionName: string;
			seasonYear: number;
			seasonNumber: number;
			location: string;
		}>;
	}>,
	loadTeams: (divisionId: string) => Promise<{
		teams: Array<{ teamId: string; teamName: string }>;
	}>,
	loadMatchups: (input: {
		divisionId: string;
		teamId: string;
		seasonYear: number;
		seasonNumber: number;
	}) => Promise<{
		matchups: Array<{
			matchupId: string;
			weekNumber: number | null;
			scheduledTime: string | null;
			teamId: string;
			oppTeamId: string;
			teamName: string;
			oppTeamName: string;
		}>;
		availablePlayerIds: string[];
		suggestedAvailablePlayerIds: string[];
		rosterPlayers: LineupLabRosterPlayer[];
	}>,
	getConfig?: () => Promise<{ model: string }>,
): ChatController {
	const messages = ref<ChatMessage[]>([...seedMessages]);
	const isSending = ref(false);
	const errorMessage = ref<string | null>(null);
	const modelLabel = ref("Unknown model");
	const extendedThinking = ref(false);
	const lineupDivisions = ref<
		Array<{
			divisionId: string;
			divisionName: string;
			seasonYear: number;
			seasonNumber: number;
			location: string;
		}>
	>([]);
	const lineupTeams = ref<Array<{ teamId: string; teamName: string }>>([]);
	const lineupMatchups = ref<
		Array<{
			matchupId: string;
			weekNumber: number | null;
			scheduledTime: string | null;
			teamId: string;
			oppTeamId: string;
			teamName: string;
			oppTeamName: string;
		}>
	>([]);
	const lineupRosterPlayers = ref<LineupLabRosterPlayer[]>([]);
	const selectedDivisionId = ref<string | null>(null);
	const selectedTeamId = ref<string | null>(null);
	const selectedMatchupId = ref<string | null>(null);
	const selectedAvailablePlayerIds = ref<string[]>([]);
	const isLoadingTeams = ref(false);
	const isLoadingMatchups = ref(false);
	let teamLoadRequestId = 0;
	let matchupLoadRequestId = 0;
	let initializationPromise: Promise<void> | null = null;
	const availabilityOverrides = new Map<string, boolean>();

	const submit = async (value: string) => {
		const content = value.trim();
		if (!content || isSending.value) {
			return;
		}

		const userMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: "user",
			content,
			createdAt: new Date().toISOString(),
		};

		messages.value.push(userMessage);
		isSending.value = true;
		errorMessage.value = null;

		try {
			const payload = messages.value
				.filter(
					(message): message is ChatMessage & { role: "assistant" | "user" } =>
						message.role === "assistant" || message.role === "user",
				)
				.map((message) => ({ role: message.role, content: message.content }));
			const requestOptions = {
				extendedThinking: extendedThinking.value,
			};
			const response = await send(payload, requestOptions);
			modelLabel.value = response.model;

			const assistantMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: "assistant",
				content: response.reply,
				createdAt: new Date().toISOString(),
			};
			messages.value.push(assistantMessage);
		} catch {
			errorMessage.value = "Unable to reach the chat service. Try again.";
		} finally {
			isSending.value = false;
		}
	};

	const runLineupLabRecommend = async () => {
		if (isSending.value) {
			return;
		}
		if (initializationPromise) {
			await initializationPromise;
		}
		const selectedDivision = lineupDivisions.value.find(
			(division) => division.divisionId === selectedDivisionId.value,
		);
		const selectedMatchup = lineupMatchups.value.find(
			(matchup) => matchup.matchupId === selectedMatchupId.value,
		);
		const selectedTeam = lineupTeams.value.find(
			(team) => team.teamId === selectedTeamId.value,
		);
		if (
			!selectedDivision ||
			!selectedMatchup ||
			!selectedTeam ||
			selectedAvailablePlayerIds.value.length < 8
		) {
			errorMessage.value =
				"Select division, team, and matchup before recommending pairings.";
			return;
		}

		const userMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: "user",
			content: `Calculate pairings for ${selectedTeam.teamName} vs ${selectedMatchup.oppTeamName} (Week ${selectedMatchup.weekNumber ?? "?"}).`,
			kind: "text",
			explorer: {
				pathLabel: `LINEUP LAB > ${selectedDivision.divisionName} > ${selectedTeam.teamName} > Calculate Pairings`,
			},
			createdAt: new Date().toISOString(),
		};
		messages.value.push(userMessage);
		isSending.value = true;
		errorMessage.value = null;

		try {
			const payload = await recommendLineup({
				divisionId: selectedDivision.divisionId,
				seasonYear: selectedDivision.seasonYear,
				seasonNumber: selectedDivision.seasonNumber,
				teamId: selectedTeam.teamId,
				oppTeamId: selectedMatchup.oppTeamId,
				matchupId: selectedMatchup.matchupId,
				availablePlayerIds: selectedAvailablePlayerIds.value,
			});
			const assistantMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: "assistant",
				content: "Lineup recommendation generated.",
				kind: "lineup_recommendation",
				lineupRecommendation: payload,
				createdAt: new Date().toISOString(),
			};
			messages.value.push(assistantMessage);
		} catch {
			errorMessage.value =
				"Unable to generate lineup recommendations. Try again.";
			messages.value.push({
				id: crypto.randomUUID(),
				role: "assistant",
				content:
					"I couldn't generate pairings for that selection. Try another team or matchup.",
				createdAt: new Date().toISOString(),
			});
		} finally {
			isSending.value = false;
		}
	};

	const selectLineupDivision = async (divisionId: string) => {
		if (!divisionId) {
			return;
		}
		errorMessage.value = null;
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
			const response = await loadTeams(divisionId);
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
			const response = await loadMatchups({
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
			if (lineupMatchups.value.length > 0) {
				selectedMatchupId.value = lineupMatchups.value[0]?.matchupId ?? null;
			}
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
	};

	void getConfig?.()
		.then((config) => {
			modelLabel.value = config.model;
		})
		.catch(() => {});
	initializationPromise = loadDivisions()
		.then(async (response) => {
			lineupDivisions.value = response.divisions;
			const firstDivision = lineupDivisions.value[0];
			if (!firstDivision) {
				return;
			}
			await selectLineupDivision(firstDivision.divisionId);
			const firstTeam = lineupTeams.value[0];
			if (!firstTeam) {
				return;
			}
			await selectLineupTeam(firstTeam.teamId);
		})
		.catch(() => {
			errorMessage.value = "Unable to load lineup lab context.";
		})
		.finally(() => {
			initializationPromise = null;
		});

	return {
		messages,
		isSending,
		errorMessage,
		modelLabel,
		extendedThinking,
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
		submit,
		selectLineupDivision,
		selectLineupTeam,
		selectLineupMatchup,
		selectLineupPlayerAvailability,
		runLineupLabRecommend,
	};
}

export function useChatController(): ChatController {
	const backendMode: ChatBackendMode =
		import.meta.env.VITE_CHAT_BACKEND_MODE === "mock" ? "mock" : "real";
	const client = createChatClient(fetch, () => null, { mode: backendMode });
	const lineupClient = createLineupLabClient(fetch, () => null);
	return createChatController(
		client.send,
		(input) =>
			lineupClient.recommend({
				divisionId: input.divisionId,
				seasonYear: input.seasonYear,
				seasonNumber: input.seasonNumber,
				teamId: input.teamId,
				oppTeamId: input.oppTeamId,
				matchupId: input.matchupId,
				availablePlayerIds: input.availablePlayerIds,
				objective: "MAX_EXPECTED_WINS",
				maxRecommendations: 3,
				scenarioLimit: 12,
			}),
		() => lineupClient.getDivisions(),
		(divisionId) => lineupClient.getTeams(divisionId),
		(input) => lineupClient.getMatchups(input),
		client.getConfig,
	);
}
