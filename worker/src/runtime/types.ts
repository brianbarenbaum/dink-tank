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

export interface ValidationSuccess {
	ok: true;
	value: ChatRequest;
}

export interface ValidationFailure {
	ok: false;
	error: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;
