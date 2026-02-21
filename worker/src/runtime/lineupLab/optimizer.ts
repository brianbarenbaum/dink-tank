import { createHash } from "node:crypto";

import type {
	LineupLabFeatureBundle,
	LineupLabObjective,
	LineupLabRecommendation,
	LineupLabRecommendRequest,
	RecommendedPair,
} from "./types";

export interface PairSetScore {
	pairSetId: string;
	pairs: RecommendedPair[];
	expectedWins: number;
	floorWinsQ20: number;
	volatility: number;
	confidence: "LOW" | "MEDIUM" | "HIGH";
}

const clampProbability = (value: number): number => {
	if (Number.isNaN(value)) {
		return 0.5;
	}
	return Math.max(0.05, Math.min(0.95, value));
};

const toPairKey = (playerAId: string, playerBId: string): string =>
	[playerAId, playerBId].sort().join(":");

const toScenarioProbability = (value: unknown): number => {
	if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
		return 0;
	}
	return value;
};

const quantile = (values: number[], q: number): number => {
	if (values.length === 0) {
		return 0;
	}
	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.max(0, Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1))));
	return sorted[index] ?? 0;
};

const sampleConfidence = (coverage: number): "LOW" | "MEDIUM" | "HIGH" => {
	if (coverage >= 0.66) {
		return "HIGH";
	}
	if (coverage >= 0.33) {
		return "MEDIUM";
	}
	return "LOW";
};

export const buildPairSets = (playerIds: string[]): RecommendedPair[][] => {
	if (playerIds.length < 2) {
		return [];
	}
	if (playerIds.length % 2 !== 0) {
		return [];
	}
	if (playerIds.length === 2) {
		return [[{ playerAId: playerIds[0] ?? "", playerBId: playerIds[1] ?? "" }]];
	}

	const [first, ...rest] = playerIds;
	if (!first) {
		return [];
	}

	const sets: RecommendedPair[][] = [];
	for (let i = 0; i < rest.length; i += 1) {
		const partner = rest[i];
		if (!partner) {
			continue;
		}
		const nextPlayers = rest.filter((_, index) => index !== i);
		for (const subset of buildPairSets(nextPlayers)) {
			sets.push([{ playerAId: first, playerBId: partner }, ...subset]);
		}
	}

	return sets;
};

export const rankPairSetResults = (
	scores: PairSetScore[],
	objective: LineupLabObjective,
): PairSetScore[] => {
	const ranked = [...scores].sort((left, right) => {
		if (objective === "MAX_EXPECTED_WINS") {
			if (right.expectedWins !== left.expectedWins) {
				return right.expectedWins - left.expectedWins;
			}
			if (right.floorWinsQ20 !== left.floorWinsQ20) {
				return right.floorWinsQ20 - left.floorWinsQ20;
			}
			return left.volatility - right.volatility;
		}

		if (right.floorWinsQ20 !== left.floorWinsQ20) {
			return right.floorWinsQ20 - left.floorWinsQ20;
		}
		if (right.expectedWins !== left.expectedWins) {
			return right.expectedWins - left.expectedWins;
		}
		return left.volatility - right.volatility;
	});

	return ranked;
};

const getPairBaseline = (
	bundle: LineupLabFeatureBundle,
	pairKey: string,
): { winRate: number; reliability: number } => {
	const row = bundle.candidate_pairs.find((candidate) => candidate.pair_key === pairKey);
	if (!row) {
		return { winRate: 0.5, reliability: 0 };
	}
	return {
		winRate:
			typeof row.win_rate_shrunk === "number"
				? clampProbability(row.win_rate_shrunk)
				: 0.5,
		reliability:
			typeof row.sample_reliability === "number"
				? Math.max(0, Math.min(1, row.sample_reliability))
				: 0,
	};
};

const getPairVsPair = (
	bundle: LineupLabFeatureBundle,
	ourPair: RecommendedPair,
	oppPairLowId: string,
	oppPairHighId: string,
	matchType: string,
): { winRate: number; reliability: number } => {
	const ourLow = [ourPair.playerAId, ourPair.playerBId].sort()[0] ?? "";
	const ourHigh = [ourPair.playerAId, ourPair.playerBId].sort()[1] ?? "";
	const row = bundle.pair_matchups.find(
		(pairMatchup) =>
			pairMatchup.our_pair_low_id === ourLow &&
			pairMatchup.our_pair_high_id === ourHigh &&
			pairMatchup.opp_pair_low_id === oppPairLowId &&
			pairMatchup.opp_pair_high_id === oppPairHighId &&
			(pairMatchup.match_type ?? "unknown") === matchType,
	);

	if (!row) {
		return getPairBaseline(bundle, toPairKey(ourPair.playerAId, ourPair.playerBId));
	}

	return {
		winRate:
			typeof row.win_rate_shrunk === "number"
				? clampProbability(row.win_rate_shrunk)
				: 0.5,
		reliability:
			typeof row.sample_reliability === "number"
				? Math.max(0, Math.min(1, row.sample_reliability))
				: 0,
	};
};

const scorePairSetAgainstScenario = (
	bundle: LineupLabFeatureBundle,
	pairs: RecommendedPair[],
	scenario: LineupLabFeatureBundle["opponent_scenarios"][number],
): { expectedWins: number; coverage: number } => {
	const opponentPairs = (scenario.scenario_pairs ?? []).filter(
		(pair) =>
			typeof pair.pair_player_low_id === "string" &&
			typeof pair.pair_player_high_id === "string",
	);
	if (opponentPairs.length === 0 || pairs.length === 0) {
		return { expectedWins: pairs.length * 0.5, coverage: 0 };
	}

	let totalExpected = 0;
	let coverageSamples = 0;
	for (const pair of pairs) {
		let bestWinRate = 0.5;
		let bestReliability = 0;
		for (const opponentPair of opponentPairs) {
			const matchup = getPairVsPair(
				bundle,
				pair,
				opponentPair.pair_player_low_id ?? "",
				opponentPair.pair_player_high_id ?? "",
				opponentPair.match_type ?? "unknown",
			);
			if (matchup.winRate > bestWinRate) {
				bestWinRate = matchup.winRate;
				bestReliability = matchup.reliability;
			}
		}
		totalExpected += bestWinRate;
		coverageSamples += bestReliability;
	}

	return {
		expectedWins: totalExpected,
		coverage: coverageSamples / pairs.length,
	};
};

const toPairSetId = (pairs: RecommendedPair[]): string => {
	const pairKey = pairs
		.map((pair) => toPairKey(pair.playerAId, pair.playerBId))
		.sort()
		.join("|");
	return createHash("sha1").update(pairKey).digest("hex").slice(0, 12);
};

export const recommendPairSets = (
	request: LineupLabRecommendRequest,
	bundle: LineupLabFeatureBundle,
): PairSetScore[] => {
	const pairSets = buildPairSets(request.availablePlayerIds);
	const scenarios = bundle.opponent_scenarios;
	const rawScenarioProbabilities = scenarios.map((scenario) =>
		toScenarioProbability(scenario.scenario_probability),
	);
	const probabilitySum = rawScenarioProbabilities.reduce(
		(total, value) => total + value,
		0,
	);
	const scenarioWeights =
		probabilitySum > 0
			? rawScenarioProbabilities.map((value) => value / probabilitySum)
			: scenarios.map(() => (scenarios.length > 0 ? 1 / scenarios.length : 0));

	const scores: PairSetScore[] = pairSets.map((pairs) => {
		const scenarioResults = scenarios.map((scenario, index) => {
			const score = scorePairSetAgainstScenario(bundle, pairs, scenario);
			return {
				expectedWins: score.expectedWins,
				coverage: score.coverage,
				weight: scenarioWeights[index] ?? 0,
			};
		});

		const expectedWins = scenarioResults.reduce(
			(total, scenario) => total + scenario.expectedWins * scenario.weight,
			0,
		);

		const unweightedScores = scenarioResults.map((scenario) => scenario.expectedWins);
		const floorWinsQ20 = quantile(unweightedScores, request.downsideQuantile);

		const volatility = Math.sqrt(
			scenarioResults.reduce((acc, scenario) => {
				const delta = scenario.expectedWins - expectedWins;
				return acc + scenario.weight * delta * delta;
			}, 0),
		);

		const averageCoverage =
			scenarioResults.length > 0
				? scenarioResults.reduce((total, scenario) => total + scenario.coverage, 0) /
					scenarioResults.length
				: 0;

		return {
			pairSetId: toPairSetId(pairs),
			pairs,
			expectedWins: Number(expectedWins.toFixed(3)),
			floorWinsQ20: Number(floorWinsQ20.toFixed(3)),
			volatility: Number(volatility.toFixed(3)),
			confidence: sampleConfidence(averageCoverage),
		};
	});

	return rankPairSetResults(scores, request.objective);
};

export const toRecommendations = (
	scores: PairSetScore[],
	maxRecommendations: number,
): LineupLabRecommendation[] =>
	scores.slice(0, maxRecommendations).map((score, index) => ({
		rank: index + 1,
		pairSetId: score.pairSetId,
		pairs: score.pairs,
		expectedWins: score.expectedWins,
		floorWinsQ20: score.floorWinsQ20,
		volatility: score.volatility,
		confidence: score.confidence,
	}));
