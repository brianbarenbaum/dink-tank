import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useChatSessionStore } from "../src/stores/chatSession";

describe("chatSession store", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it("starts with seed assistant message and empty pending state", () => {
		const store = useChatSessionStore();

		expect(store.messages.length).toBe(1);
		expect(store.messages[0]?.role).toBe("assistant");
		expect(store.isSending).toBe(false);
	});

	it("appends user and assistant messages in order", () => {
		const store = useChatSessionStore();

		store.addUserMessage("How do we defend against heavy topspin?");
		store.addAssistantMessage("Reset early and keep paddle head up.");

		const lastTwo = store.messages.slice(-2);
		expect(lastTwo.map((m) => m.role)).toEqual(["user", "assistant"]);
	});
});
