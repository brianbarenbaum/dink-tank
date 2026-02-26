import { describe, expect, it } from "vitest";

import { formatChatMessageContent } from "../src/features/chat/formatMessageContent";

describe("formatChatMessageContent", () => {
	it("renders markdown bullets and bold text", () => {
		const content = [
			"For Pickle Juice 4.0, their most recent match was:",
			"",
			"- **Opponent:** Garden State",
			"- **Season:** 2025, Season 3, Week 6",
			"- **Result:** **Loss**",
		].join("\n");

		const rendered = formatChatMessageContent(content);

		const listBlock = rendered.find((block) => block.kind === "list");
		expect(listBlock).toBeTruthy();
		expect(listBlock?.lines[0]?.[0]).toEqual({
			kind: "strong",
			text: "Opponent:",
		});
		expect(listBlock?.lines[0]?.[1]).toEqual({
			kind: "text",
			text: " Garden State",
		});
		expect(listBlock?.lines[2]?.[0]).toEqual({
			kind: "strong",
			text: "Result:",
		});
		expect(listBlock?.lines[2]?.[1]).toEqual({
			kind: "text",
			text: " ",
		});
		expect(listBlock?.lines[2]?.[2]).toEqual({
			kind: "strong",
			text: "Loss",
		});
	});

	it("keeps unsafe HTML as plain text runs", () => {
		const content = '**Safe** <img src=x onerror="alert(1)" />';

		const rendered = formatChatMessageContent(content);

		expect(rendered[0]?.kind).toBe("paragraph");
		expect(rendered[0]?.lines[0]?.[0]).toEqual({ kind: "strong", text: "Safe" });
		expect(rendered[0]?.lines[0]?.[1]).toEqual({
			kind: "text",
			text: ' <img src=x onerror="alert(1)" />',
		});
	});
});
