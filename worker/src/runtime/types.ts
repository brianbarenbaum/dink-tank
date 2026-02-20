export type ChatRole = "user" | "assistant";

export interface ChatMessage {
	role: ChatRole;
	content: string;
}

export interface ChatRequest {
	messages: ChatMessage[];
}

export interface ChatResponse {
	reply: string;
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
