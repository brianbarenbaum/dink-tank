export interface OptimizationHints {
	sqlGenerationRules: string[];
	sqlEditRules: string[];
	answerRules: string[];
}

export const OPTIMIZATION_HINTS: OptimizationHints = {
	sqlGenerationRules: [
		"If the user asks for team roster, default to public.vw_player_team and avoid standings views unless explicitly requested.",
		"If a team name is provided without a division and multiple divisions are possible, return needs_clarification asking for division.",
		"When follow-up questions are short (for example: '4.0' or 'team results'), preserve prior team and season scope.",
		"Use public.vw_team_matches for team match outcomes and public.vw_player_stats_per_match for player outcomes.",
		"For partner or teammate questions, use public.vw_player_game_history.",
		"Use exact team/division/player matching unless user explicitly requests fuzzy matching.",
	],
	sqlEditRules: [
		"Keep prior team/division filters for follow-ups unless the user explicitly changes them.",
		"If previous turn asked for division clarification and user replied with a division value, enforce division_name equality in edited SQL.",
		"If team or player question is ambiguous across divisions, ask one explicit division clarification before SQL.",
		"When division is provided in follow-up, enforce exact division_name equality in SQL.",
		"Allow low-confidence SQL execution for factoid questions to avoid repeated clarification loops.",
		"Prefer asking one focused clarification over answering with guessed scope.",
		"When follow-up asks for a metric-only refinement, preserve prior team/division/season constraints.",
	],
	answerRules: [
		"When asking a clarification question, ask exactly one targeted clarification and avoid repeating the same question if the user already answered it.",
		"When a team-level request could also be interpreted as player-level stats, ask a one-line team-vs-player clarification.",
		"When user asks won/lost and subject is unclear, ask one-line team-results vs player-stats clarification.",
		"Skip generic won/lost clarification prompts when the question is a direct factoid request.",
		"Do not ask repeated clarification if the user has already provided the requested detail in the previous turn.",
	],
};
