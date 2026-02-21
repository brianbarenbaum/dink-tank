export type LineupLabObjective = "MAX_EXPECTED_WINS" | "MINIMIZE_DOWNSIDE";

export interface LineupLabRecommendRequest {
	divisionId: string;
	seasonYear: number;
	seasonNumber: number;
	teamId: string;
	oppTeamId: string;
	availablePlayerIds: string[];
	objective: LineupLabObjective;
	maxRecommendations: number;
	downsideQuantile: number;
	scenarioLimit: number;
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
	sample_reliability?: number;
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
	sample_reliability?: number;
}

export interface LineupLabFeatureBundle {
	counts?: Record<string, number>;
	candidate_pairs: BundleCandidatePair[];
	opponent_scenarios: BundleScenario[];
	pair_matchups: BundlePairMatchup[];
}

export interface RecommendedPair {
	playerAId: string;
	playerBId: string;
}

export interface LineupLabRecommendation {
	rank: number;
	pairSetId: string;
	pairs: RecommendedPair[];
	expectedWins: number;
	floorWinsQ20: number;
	volatility: number;
	confidence: "LOW" | "MEDIUM" | "HIGH";
}

export interface LineupLabRecommendResponse {
	requestId: string;
	generatedAt: string;
	objective: LineupLabObjective;
	recommendations: LineupLabRecommendation[];
	scenarioSummary: {
		scenarioCount: number;
	};
}
