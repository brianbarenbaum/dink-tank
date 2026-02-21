export type ChatRole = "user" | "assistant";

export interface ChatMessage {
	role: ChatRole;
	content: string;
}

export interface ChatRequest {
	messages: ChatMessage[];
	options?: {
		extendedThinking?: boolean;
	};
}

export interface ChatResponse {
	reply: string;
	model: string;
	extendedThinking: boolean;
}

export interface ScopedMetadata {
	seasonLabel: string;
	divisions: string[];
	podsByDivision: Record<string, string[]>;
	teamsByDivision?: Record<string, string[]>;
	includeTeams: boolean;
}

export interface ScopeParseResult {
	inferredDivisionTerms: string[];
	inferredPodTerms: string[];
	inferredSeasonYear?: number;
	teamIntent: boolean;
}

export interface ValidationSuccess {
	ok: true;
	value: ChatRequest;
}

export interface ValidationFailure {
	ok: false;
	error: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;
