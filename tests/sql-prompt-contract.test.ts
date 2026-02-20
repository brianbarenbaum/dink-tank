import { describe, expect, it } from "vitest";

import { buildSqlSystemPrompt } from "../worker/src/runtime/prompt";

describe("sql prompt contract", () => {
	it("embeds selected catalog context in the system prompt", () => {
		const prompt = buildSqlSystemPrompt({
			catalogContext: "public.vw_team_standings:\n- team_name\n- wins",
			selectionReason:
				"Top match public.vw_team_standings scored 9.80 from question overlap.",
		});

		expect(prompt).toContain("Catalog views selected for this question");
		expect(prompt).toContain("public.vw_team_standings");
		expect(prompt).toContain("selection reason");
	});

	it("instructs the model to avoid unnecessary clarification prompts", () => {
		const prompt = buildSqlSystemPrompt({
			catalogContext: "public.vw_team_matches:\n- team_name\n- match_result",
			selectionReason: "Top match public.vw_team_matches scored 8.20.",
		});

		expect(prompt).toContain("Ask for clarification only if");
		expect(prompt).toContain("If the question is answerable");
	});
});
