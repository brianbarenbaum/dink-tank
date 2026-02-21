import type {
	ChatMessage,
	ChatRequest,
	ValidationFailure,
	ValidationResult,
	ValidationSuccess,
} from "./types";

const MAX_MESSAGES = 20;

/**
 * Creates a standardized validation failure payload.
 */
const fail = (error: string): ValidationFailure => ({ ok: false, error });

/**
 * Validates that an unknown value matches the accepted chat message contract.
 */
const isMessage = (value: unknown): value is ChatMessage => {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as Partial<ChatMessage>;
	const validRole = candidate.role === "user" || candidate.role === "assistant";
	const validContent =
		typeof candidate.content === "string" &&
		candidate.content.trim().length > 0;

	return validRole && validContent;
};

const success = (value: ChatRequest): ValidationSuccess => ({
	ok: true,
	value,
});

/**
 * Validates and normalizes the incoming `/api/chat` request body.
 */
export const parseChatRequest = (payload: unknown): ValidationResult => {
	if (!payload || typeof payload !== "object") {
		return fail("Request body must be an object.");
	}

	const candidate = payload as Partial<ChatRequest>;
	if (!Array.isArray(candidate.messages) || candidate.messages.length === 0) {
		return fail("messages must be a non-empty array.");
	}

	if (candidate.messages.length > MAX_MESSAGES) {
		return fail(`messages may include at most ${MAX_MESSAGES} entries.`);
	}

	if (!candidate.messages.every(isMessage)) {
		return fail(
			"messages must include only user/assistant roles and non-empty content.",
		);
	}

	if (
		candidate.options &&
		(typeof candidate.options !== "object" ||
			Array.isArray(candidate.options) ||
			("extendedThinking" in candidate.options &&
				typeof (
					candidate.options as {
						extendedThinking?: unknown;
					}
				).extendedThinking !== "boolean"))
	) {
		return fail("options.extendedThinking must be a boolean when provided.");
	}

	return success({
		messages: candidate.messages,
		options: candidate.options as { extendedThinking?: boolean } | undefined,
	});
};
