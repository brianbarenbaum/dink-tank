export type LineupLabObjective = "MAX_EXPECTED_WINS" | "MINIMIZE_DOWNSIDE";
export type LineupLabMode = "blind" | "known_opponent";
export type LineupMatchType = "mixed" | "female" | "male";

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
	availablePlayerIds: string[];
	matchupId: string;
	mode: LineupLabMode;
	objective: LineupLabObjective;
	maxRecommendations: number;
	downsideQuantile: number;
	scenarioLimit: number;
	opponentRounds?: KnownOpponentRoundInput[];
	/** Required when mode is known_opponent; used for gender validation. */
	opponentRoster?: OpponentRosterEntry[];
}

export interface ValidationSuccess {
	ok: true;
	value: LineupLabRecommendRequest;
}

export interface ValidationFailure {
	ok: false;
	error: string;
}

export type LineupLabValidationResult = ValidationSuccess | ValidationFailure;

export interface BundleCandidatePair {
	pair_player_low_id: string;
	pair_player_high_id: string;
	pair_key: string;
	win_rate_shrunk?: number;
	pd_win_probability?: number | null;
	sample_reliability?: number;
	division_win_rate_prior?: number | null;
	mixed_win_rate?: number | null;
	mixed_win_rate_shrunk?: number | null;
	mixed_win_rate_prior?: number | null;
	mixed_pd_win_probability?: number | null;
	female_win_rate?: number | null;
	female_win_rate_shrunk?: number | null;
	female_win_rate_prior?: number | null;
	female_pd_win_probability?: number | null;
	male_win_rate?: number | null;
	male_win_rate_shrunk?: number | null;
	male_win_rate_prior?: number | null;
	male_pd_win_probability?: number | null;
}

export interface BundleScenario {
	scenario_id: string;
	scenario_probability?: number;
	scenario_pairs?: Array<{
		match_type?: string;
		pair_key?: string;
		pair_player_low_id?: string;
		pair_player_high_id?: string;
	}>;
}

export interface BundlePairMatchup {
	match_type?: string;
	our_pair_low_id: string;
	our_pair_high_id: string;
	opp_pair_low_id: string;
	opp_pair_high_id: string;
	win_rate_shrunk?: number;
	pd_win_probability?: number | null;
	sample_reliability?: number;
}

export interface LineupLabFeatureBundle {
	generated_at?: string;
	max_last_seen_at?: string | null;
	data_staleness_hours?: number | null;
	counts?: Record<string, number>;
	candidate_pairs: BundleCandidatePair[];
	opponent_scenarios: BundleScenario[];
	pair_matchups: BundlePairMatchup[];
	players_catalog?: Array<{
		player_id: string;
		first_name?: string | null;
		last_name?: string | null;
		gender?: string | null;
		team_id?: string | null;
	}>;
}

export interface RecommendedPair {
	playerAId: string;
	playerBId: string;
}

export interface LineupScheduledGame {
	roundNumber: number;
	slotNumber: number;
	matchType: LineupMatchType;
	playerAId: string;
	playerBId: string;
	winProbability: number;
}

export interface LineupScheduledRound {
	roundNumber: number;
	games: LineupScheduledGame[];
}

export interface LineupLabRecommendation {
	rank: number;
	pairSetId: string;
	pairs: RecommendedPair[];
	expectedWins: number;
	floorWinsQ20: number;
	matchupWinProbability: number;
	volatility: number;
	confidence: "LOW" | "MEDIUM" | "HIGH";
	gameConfidence: "LOW" | "MEDIUM" | "HIGH";
	matchupConfidence: "LOW" | "MEDIUM" | "HIGH";
	rounds: LineupScheduledRound[];
	pairUsage: Array<{
		playerAId: string;
		playerBId: string;
		count: number;
	}>;
}

export interface LineupLabRecommendResponse {
	requestId: string;
	generatedAt: string;
	objective: LineupLabObjective;
	recommendations: LineupLabRecommendation[];
	scenarioSummary: {
		scenarioCount: number;
	};
	bundleMetadata?: {
		generatedAt: string;
		maxLastSeenAt: string | null;
		dataStalenessHours: number | null;
		warning?: string;
	};
	playerDirectory: Record<string, string>;
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
	opponentRosterPlayers: Array<{
		playerId: string;
		firstName: string | null;
		lastName: string | null;
		gender: string | null;
		isSub: boolean;
	}>;
}

export interface LineupLabMatchupContextResponse {
	matchups: LineupLabMatchupOption[];
	availablePlayerIds: string[];
	suggestedAvailablePlayerIds: string[];
	rosterPlayers: Array<{
		playerId: string;
		firstName: string | null;
		lastName: string | null;
		gender: string | null;
		isSub: boolean;
		suggested: boolean;
	}>;
}
