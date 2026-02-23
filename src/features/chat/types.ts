export type ChatRole = "system" | "user" | "assistant";

export type ChatMessageKind = "text" | "lineup_recommendation";

export interface LineupRecommendationPair {
	playerAId: string;
	playerBId: string;
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
			rounds?: Array<{
		roundNumber: number;
		games: Array<{
			roundNumber: number;
			slotNumber: number;
			matchType: "mixed" | "female" | "male";
			playerAId: string;
			playerBId: string;
			winProbability: number;
		}>;
	}>;
	pairUsage?: Array<{
		playerAId: string;
		playerBId: string;
		count: number;
	}>;
}

export interface LineupRecommendationPayload {
	requestId: string;
	generatedAt: string;
	objective: "MAX_EXPECTED_WINS" | "MINIMIZE_DOWNSIDE";
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

export interface ExplorerMessageMeta {
	pathLabel: string;
}

export interface ChatMessage {
	id: string;
	role: ChatRole;
	content: string;
	createdAt: string;
	kind?: ChatMessageKind;
	explorer?: ExplorerMessageMeta;
	lineupRecommendation?: LineupRecommendationPayload;
}
