import { tokenize } from "./schemaIndex";
import { AI_CATALOG } from "./catalog.data";
import { buildSchemaContext } from "./catalog.context";
import type {
	CatalogEntry,
	CatalogSelectorInput,
	CatalogSelectorOptions,
	WonLostIntentDecision,
	WonLostIntentHints,
} from "./catalog.types";

const SAFE_FALLBACK_VIEW = "public.vw_team_matches";
const PARTNER_HISTORY_VIEW = "public.vw_player_game_history";
const TEAM_ROSTER_VIEW = "public.vw_player_team";
const PLAYER_STATS_SEASON_VIEW = "public.vw_player_stats_per_season";
const PARTNER_INTENT_RE =
	/\b(partner|teammate|played with|play with|pair(?:ed|ing)? with)\b/i;
const ROSTER_INTENT_RE =
	/\b(roster|members?|players?\s+on|who(?:'s| is)\s+on|list\s+players?)\b/i;
const PLAYER_RANKING_INTENT_RE =
	/(?:\brank(?:ed|ing)?\b|\boverall\b|\btop player\b|\bbest player\b|\bworst player\b)/i;

/**
 * Scores an entry by deterministic token overlap between question and curated catalog metadata.
 */
const scoreDeterministic = (
	entry: CatalogEntry,
	questionTokens: string[],
): number => {
	const aliasTokens = tokenize(entry.aliases.join(" "));
	const useCaseTokens = tokenize(entry.useFor.join(" "));
	const columnTokens = tokenize(entry.columns.join(" "));
	const overlap = (tokens: string[], weight: number): number =>
		tokens.reduce(
			(total, token) => total + (questionTokens.includes(token) ? weight : 0),
			0,
		);
	return (
		overlap(aliasTokens, 4) +
		overlap(useCaseTokens, 3) +
		overlap(columnTokens, 1)
	);
};

/**
 * Computes a lightweight semantic-overlap score from descriptive catalog text.
 */
const scoreSemanticLite = (
	entry: CatalogEntry,
	questionTokens: string[],
): number => {
	const searchable = tokenize(
		`${entry.description} ${entry.aliases.join(" ")} ${entry.useFor.join(" ")} ${entry.exampleQuestions.join(" ")}`,
	);
	const matchCount = searchable.reduce(
		(total, token) => total + (questionTokens.includes(token) ? 1 : 0),
		0,
	);
	const uniqueCount = new Set(searchable).size;
	if (uniqueCount === 0) {
		return 0;
	}
	return matchCount / uniqueCount;
};

/**
 * Resolves ambiguous won/lost questions to team-level or player-level views when possible.
 */
export const classifyWonLostIntent = (
	question: string,
	hints: WonLostIntentHints = {},
): WonLostIntentDecision | null => {
	const lower = question.toLowerCase();
	const explicitTeamResolution =
		/\bteam match results?\b/.test(lower) || /\bteam results?\b/.test(lower);
	const explicitPlayerResolution =
		/\bplayer match stats?\b/.test(lower) || /\bplayer stats?\b/.test(lower);

	if (explicitTeamResolution && !explicitPlayerResolution) {
		return {
			preferredView: "public.vw_team_matches",
			reason: "Explicit follow-up selected team-level match results.",
		};
	}
	if (explicitPlayerResolution && !explicitTeamResolution) {
		return {
			preferredView: "public.vw_player_stats_per_match",
			reason: "Explicit follow-up selected player-level match stats.",
		};
	}

	if (!/\b(won|lost|win|loss|result|results)\b/.test(lower)) {
		return null;
	}

	const explicitTeamCue =
		/\b(team|opponent|schedule|club|division|every match|match-by-match|match by match)\b/.test(
			lower,
		) ||
		/\bbounce\b|\bpickle\b|\bflemington\b|\bmalvern\b|\bnewtown\b|\bsupreme\b/.test(
			lower,
		);
	const explicitPlayerCue =
		/\b(player|each player|per player|individual player|how did)\b/.test(
			lower,
		) || /\bhe\b|\bshe\b|\bhis\b|\bher\b/.test(lower);
	const hasLikelyPersonName =
		/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(question) &&
		!/\bBounce\b/.test(question);

	const teamCue = explicitTeamCue || Boolean(hints.activeTeamName);
	const playerCue =
		explicitPlayerCue || hasLikelyPersonName || Boolean(hints.activePlayerName);

	if (teamCue && !playerCue) {
		return {
			preferredView: "public.vw_team_matches",
			reason: "Detected team-level won/lost intent.",
		};
	}
	if (playerCue && !teamCue) {
		return {
			preferredView: "public.vw_player_stats_per_match",
			reason: "Detected player-level won/lost intent.",
		};
	}

	return {
		clarification:
			"Do you want team match results or player match stats for wins/losses?",
		reason: "Won/lost intent is ambiguous between team and player scope.",
	};
};

/**
 * Selects the most relevant catalog views and builds the corresponding schema prompt context.
 */
export const selectCatalogContext = (
	question: string,
	options: CatalogSelectorOptions,
): CatalogSelectorInput => {
	const normalizedTopK = Math.max(1, options.topK);
	const tokens = tokenize(question);
	const hasPartnerIntent = PARTNER_INTENT_RE.test(question);
	const hasRosterIntent = ROSTER_INTENT_RE.test(question);
	const hasPlayerRankingIntent = PLAYER_RANKING_INTENT_RE.test(question);
	const forcedPrimaryView =
		options.forcePrimaryView ??
		(hasPartnerIntent
			? PARTNER_HISTORY_VIEW
			: hasRosterIntent
					? TEAM_ROSTER_VIEW
					: hasPlayerRankingIntent
						? PLAYER_STATS_SEASON_VIEW
					: undefined);

	const ranked = AI_CATALOG.map((entry) => {
		const deterministicScore = scoreDeterministic(entry, tokens);
		const semanticLite = scoreSemanticLite(entry, tokens);
		const finalScore =
			options.mode === "hybrid"
				? deterministicScore + semanticLite * 6
				: deterministicScore;
		return {
			entry,
			deterministicScore,
			semanticLite,
			finalScore,
		};
	})
		.sort((left, right) => right.finalScore - left.finalScore)
		.slice(0, normalizedTopK);

	let selected = ranked.map((result) => result.entry);
	const forcedEntry = forcedPrimaryView
		? AI_CATALOG.find((entry) => entry.name === forcedPrimaryView)
		: undefined;
	if (forcedEntry) {
		selected = [
			forcedEntry,
			...selected.filter((entry) => entry.name !== forcedEntry.name),
		].slice(0, normalizedTopK);
	}
	const top = ranked[0];
	const second = ranked[1];
	const confidenceDenominator =
		(top?.finalScore ?? 0) + (second?.finalScore ?? 0) + 0.0001;
	const relativeConfidence =
		top && top.finalScore > 0 ? top.finalScore / confidenceDenominator : 0;
	const absoluteConfidence = top ? Math.min(1, top.finalScore / 16) : 0;
	const confidence = relativeConfidence * absoluteConfidence;

	const source: "deterministic" | "hybrid" =
		options.mode === "hybrid" && top && top.semanticLite > 0
			? "hybrid"
			: "deterministic";

	const baseReason =
		top && top.finalScore > 0
			? `Top match ${top.entry.name} scored ${top.finalScore.toFixed(2)} from question overlap.`
			: "No strong catalog match was found from the question phrasing.";
	const forcedReasonSource = hasPartnerIntent
		? "partner-intent classifier"
		: hasRosterIntent
			? "roster-intent classifier"
			: hasPlayerRankingIntent
				? "ranking-intent classifier"
			: "deterministic intent classifier";
	let reason = forcedEntry
		? `${baseReason} Forced primary view ${forcedEntry.name} from ${forcedReasonSource}.`
		: baseReason;

	if (confidence < options.confidenceMin) {
		const hasMeaningfulTopMatch = (top?.finalScore ?? 0) > 0;
		const fallbackEntry =
			forcedEntry ??
			(hasMeaningfulTopMatch
				? selected[0]
				: AI_CATALOG.find((entry) => entry.name === SAFE_FALLBACK_VIEW) ??
					AI_CATALOG[0]);
		selected = fallbackEntry ? [fallbackEntry] : selected;
		reason = `${reason} Confidence ${confidence.toFixed(2)} is below confidence threshold ${options.confidenceMin.toFixed(2)}; fallback to ${fallbackEntry?.name ?? "none"}.`;
	}

	const catalogContext = buildSchemaContext(
		selected,
		options.maxColumnsPerView ?? 20,
	);
	return {
		selectedViews: selected.map((entry) => entry.name),
		selectedSchema: catalogContext,
		catalogContext,
		confidence,
		reason,
		source,
	};
};
