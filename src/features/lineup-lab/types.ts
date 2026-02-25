export type LineupLabMode = "blind" | "known_opponent";
export type LineupLabObjective = "MAX_EXPECTED_WINS" | "MINIMIZE_DOWNSIDE";
export type LineupMatchType = "mixed" | "female" | "male";

export interface LineupRosterPlayer {
	playerId: string;
	firstName: string | null;
	lastName: string | null;
	gender: string | null;
	isSub: boolean;
	suggested: boolean;
}

export interface OpponentRosterPlayer {
	playerId: string;
	firstName: string | null;
	lastName: string | null;
	gender: string | null;
	isSub: boolean;
}

export interface LineupLabDivisionOption {
	divisionId: string;
	divisionName: string;
	seasonYear: number;
	seasonNumber: number;
	location: string;
}

export interface LineupLabTeamOption {
	teamId: string;
	teamName: string;
}

export interface LineupLabMatchupOption {
	matchupId: string;
	weekNumber: number | null;
	scheduledTime: string | null;
	teamId: string;
	oppTeamId: string;
	teamName: string;
	oppTeamName: string;
	opponentRosterPlayers: OpponentRosterPlayer[];
}

export interface LineupLabMatchupContextResponse {
	matchups: LineupLabMatchupOption[];
	availablePlayerIds: string[];
	suggestedAvailablePlayerIds: string[];
	rosterPlayers: LineupRosterPlayer[];
}

export interface KnownOpponentGameInput {
	roundNumber: number;
	slotNumber: number;
	matchType: LineupMatchType;
	opponentPlayerAId: string;
	opponentPlayerBId: string;
}

export interface KnownOpponentRoundInput {
	roundNumber: number;
	games: KnownOpponentGameInput[];
}

export interface OpponentRosterEntry {
	playerId: string;
	gender: string | null;
}

export interface LineupLabRecommendRequest {
	divisionId: string;
	seasonYear: number;
	seasonNumber: number;
	teamId: string;
	oppTeamId: string;
	matchupId: string;
	mode: LineupLabMode;
	availablePlayerIds: string[];
	objective: LineupLabObjective;
	maxRecommendations?: number;
	downsideQuantile?: number;
	scenarioLimit?: number;
	opponentRounds?: KnownOpponentRoundInput[];
	/** Required when mode is known_opponent; used for gender validation. */
	opponentRoster?: OpponentRosterEntry[];
}

export interface LineupRecommendationPair {
	playerAId: string;
	playerBId: string;
}

export interface LineupRecommendationRound {
	roundNumber: number;
	games: Array<{
		roundNumber: number;
		slotNumber: number;
		matchType: LineupMatchType;
		playerAId: string;
		playerBId: string;
		winProbability: number;
		duprApplied?: boolean;
		duprCoverageCount?: number;
		duprWeightApplied?: number;
		teamStrengthApplied?: boolean;
	}>;
}

export interface LineupRecommendationItem {
	rank: number;
	pairSetId: string;
	pairs: LineupRecommendationPair[];
	expectedWins: number;
	floorWinsQ20: number;
	matchupWinProbability: number;
	volatility: number;
	confidence: "LOW" | "MEDIUM" | "HIGH";
	gameConfidence: "LOW" | "MEDIUM" | "HIGH";
	matchupConfidence: "LOW" | "MEDIUM" | "HIGH";
	duprApplied?: boolean;
	duprCoverageCount?: number;
	duprWeightApplied?: number;
	teamStrengthApplied?: boolean;
	rounds?: LineupRecommendationRound[];
	pairUsage?: Array<{
		playerAId: string;
		playerBId: string;
		count: number;
	}>;
}

export interface LineupRecommendationPayload {
	requestId: string;
	generatedAt: string;
	objective: LineupLabObjective;
	recommendations: LineupRecommendationItem[];
	scenarioSummary: {
		scenarioCount: number;
	};
	bundleMetadata?: {
		generatedAt: string;
		maxLastSeenAt: string | null;
		dataStalenessHours: number | null;
		warning?: string;
	};
	playerDirectory?: Record<string, string>;
}

export interface OpponentSlotAssignment {
	playerAId: string | null;
	playerBId: string | null;
}

export type OpponentAssignmentsBySlot = Record<string, OpponentSlotAssignment>;
