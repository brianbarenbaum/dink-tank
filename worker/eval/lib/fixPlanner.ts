import type { NormalizedEvalItem } from "./evalResults";

export interface PlannedFix {
	id: string;
	title: string;
	rationale: string;
	filePath: string;
	rules: string[];
	relatedPrompts: string[];
}

export interface FixPlannerOptions {
	repeatedClarificationInputs?: string[];
}

const unique = (values: string[]): string[] => [...new Set(values)];

const lower = (value: string): string => value.toLowerCase();

export const buildFixPlan = (
	worstItems: NormalizedEvalItem[],
	maxFixes: number,
	options: FixPlannerOptions = {},
): PlannedFix[] => {
	const allText = lower(
		worstItems
			.map((item) => `${item.input}\n${item.output}\n${item.judgeComment}`)
			.join("\n\n"),
	);

	const prompts = unique(worstItems.map((item) => item.input).filter(Boolean));
	const plan: PlannedFix[] = [];

	if ((options.repeatedClarificationInputs?.length ?? 0) > 0) {
		plan.push({
			id: "no-repeat-clarification-guard",
			title: "Enable no-repeat clarification guard for recurring failures",
			rationale:
				"Repeated loop failures returned clarification-style answers for the same prompts without progress.",
			filePath: "worker/eval/config/runtimeTuning.ts",
			rules: [
				"Allow low-confidence SQL execution for factoid questions to avoid repeated clarification loops.",
				"Skip generic won/lost clarification prompts when the question is a direct factoid request.",
			],
			relatedPrompts: unique(options.repeatedClarificationInputs ?? []),
		});
	}

	if (
		/\bfollow[- ]?up\b|\bcontext\b|\bprior\b|\bcarryover\b|\bstandalone\b/.test(
			allText,
		)
	) {
		plan.push({
			id: "followup-scope",
			title: "Strengthen follow-up scope carryover",
			rationale:
				"Low-scoring examples indicate context is not consistently carried into follow-up SQL generation.",
			filePath: "worker/eval/config/optimizationHints.ts",
			rules: [
				"When follow-up asks for a metric-only refinement, preserve prior team/division/season constraints.",
				"Do not ask repeated clarification if the user has already provided the requested detail in the previous turn.",
			],
			relatedPrompts: prompts,
		});
	}

	if (/\bdivision\b|\b3\.0\b|\b3\.5\b|\b4\.0\b|\bambiguous\b/.test(allText)) {
		plan.push({
			id: "division-clarification",
			title: "Improve division disambiguation handling",
			rationale:
				"Judge commentary points to missing or incorrect division scoping in generated SQL and clarifications.",
			filePath: "worker/eval/config/optimizationHints.ts",
			rules: [
				"If team or player question is ambiguous across divisions, ask one explicit division clarification before SQL.",
				"When division is provided in follow-up, enforce exact division_name equality in SQL.",
			],
			relatedPrompts: prompts,
		});
	}

	if (
		/\bteam\b|\broster\b|\bplayer\b|\bwon\b|\blost\b|\bmatch\b/.test(allText)
	) {
		plan.push({
			id: "team-player-scope",
			title: "Disambiguate team vs player win/loss intent",
			rationale:
				"Failures suggest ambiguity between team-level results and player-level statistics.",
			filePath: "worker/eval/config/optimizationHints.ts",
			rules: [
				"When user asks won/lost and subject is unclear, ask one-line team-results vs player-stats clarification.",
				"Use public.vw_team_matches for team match outcomes and public.vw_player_stats_per_match for player outcomes.",
			],
			relatedPrompts: prompts,
		});
	}

	if (plan.length === 0) {
		plan.push({
			id: "generic-accuracy",
			title: "General prompt hardening for accuracy",
			rationale:
				"No clear cluster detected; add generic guardrails for exact-entity matching and concise clarification flow.",
			filePath: "worker/eval/config/optimizationHints.ts",
			rules: [
				"Use exact team/division/player matching unless user explicitly requests fuzzy matching.",
				"Prefer asking one focused clarification over answering with guessed scope.",
			],
			relatedPrompts: prompts,
		});
	}

	return plan.slice(0, maxFixes);
};
