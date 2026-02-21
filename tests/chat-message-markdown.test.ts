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

		expect(rendered).toContain("<ul>");
		expect(rendered).toContain(
			"<li><strong>Opponent:</strong> Garden State</li>",
		);
		expect(rendered).toContain(
			"<li><strong>Result:</strong> <strong>Loss</strong></li>",
		);
	});

	it("escapes unsafe HTML before rendering markdown", () => {
		const content = '**Safe** <img src=x onerror="alert(1)" />';

		const rendered = formatChatMessageContent(content);

		expect(rendered).toContain("<strong>Safe</strong>");
		expect(rendered).toContain(
			"&lt;img src=x onerror=&quot;alert(1)&quot; /&gt;",
		);
		expect(rendered).not.toContain("<img");
	});
});
