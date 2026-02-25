import { createHash } from "node:crypto";

import type {
	BundleCandidatePair,
	BundlePairMatchup,
	LineupLabFeatureBundle,
	LineupLabObjective,
	LineupLabRecommendation,
	LineupLabRecommendRequest,
	LineupMatchType,
	LineupScheduledGame,
	LineupScheduledRound,
	RecommendedPair,
} from "./types";

type Gender = "male" | "female";

interface ScoredSchedule {
	pairSetId: string;
	rounds: LineupScheduledRound[];
	expectedWins: number;
	floorWinsQ20: number;
	matchupWinProbability: number;
	volatility: number;
	gameConfidence: "LOW" | "MEDIUM" | "HIGH";
	matchupConfidence: "LOW" | "MEDIUM" | "HIGH";
	duprApplied: boolean;
	duprCoverageCount: number;
	duprWeightApplied: number;
	teamStrengthApplied: boolean;
	pairUsage: Array<{ playerAId: string; playerBId: string; count: number }>;
	pairs: RecommendedPair[];
}

interface PairRecord {
	playerAId: string;
	playerBId: string;
	pairKey: string;
	matchType: LineupMatchType;
	baseWinRate: number;
	pdWinProbability: number;
	baseReliability: number;
}

interface OpponentPair {
	lowId: string;
	highId: string;
	weight: number;
}

interface OpponentScenarioPrepared {
	id: string;
	weight: number;
	byType: Record<LineupMatchType, OpponentPair[]>;
}

interface PlayerMeta {
	id: string;
	gender: Gender;
}

interface PairMatchupValue {
	winRate: number;
	pdWinProbability: number;
	reliability: number;
	signalCorrelation: number | null;
}

interface BuildContext {
	players: PlayerMeta[];
	pairRecordsByType: Record<LineupMatchType, PairRecord[]>;
	pairRecordByKeyAndType: Map<string, PairRecord>;
	pairMatchupMap: Map<string, PairMatchupValue>;
	scenarios: OpponentScenarioPrepared[];
	candidateSignalCorrelationByType: Record<LineupMatchType, number | null>;
	matchupSignalCorrelationByType: Record<LineupMatchType, number | null>;
	downsideQuantile: number;
	objective: LineupLabObjective;
	duprByPlayerId: Map<string, number>;
	teamStrengthDelta: number | null;
	scoringConfig: LineupLabScoringConfig;
}

interface MutableScheduleState {
	playerGames: Map<string, number>;
	pairUsage: Map<string, number>;
}

interface ScheduledSlot {
	matchType: LineupMatchType;
	pair: PairRecord;
}

interface KnownOpponentSlot {
	roundNumber: number;
	slotNumber: number;
	matchType: LineupMatchType;
	opponentPair: OpponentPair;
}

export interface LineupLabScoringConfig {
	enableDuprBlend: boolean;
	duprMajorWeight: number;
	enableTeamStrengthAdjustment: boolean;
	duprSlope: number;
	teamStrengthFactor: number;
	teamStrengthCap: number;
}

const MAX_PLAYER_GAMES = 8;
const MAX_PAIR_GAMES = 2;
const TOTAL_ROUNDS = 8;
const MAX_ATTEMPTS = 180;
const PD_BLEND_MAX_WEIGHT = 0.35;
const PD_BLEND_MIN_WEIGHT = 0.08;
const PD_CORRELATION_GUARDRAIL = 0.85;
const PD_CORRELATION_HARD_CAP = 0.97;
const PD_HIGH_CORRELATION_MAX_WEIGHT = 0.12;
const DEFAULT_DUPR_MAJOR_WEIGHT = 0.65;
const DEFAULT_DUPR_SLOPE = 1.6;
const DEFAULT_TEAM_STRENGTH_FACTOR = 0.45;
const DEFAULT_TEAM_STRENGTH_CAP = 0.35;

const ROUND_SLOT_TEMPLATE: Array<Array<LineupMatchType>> = [
	["mixed", "mixed", "mixed", "mixed"],
	["female", "female", "male", "male"],
	["mixed", "mixed", "mixed", "mixed"],
	["female", "female", "male", "male"],
	["mixed", "mixed", "mixed", "mixed"],
	["female", "female", "male", "male"],
	["mixed", "mixed", "mixed", "mixed"],
	["female", "female", "male", "male"],
];

const clampProbability = (value: number): number => {
	if (!Number.isFinite(value)) {
		return 0.5;
	}
	return Math.max(0.05, Math.min(0.95, value));
};

export const logit = (probability: number): number => {
	const p = clampProbability(probability);
	return Math.log(p / (1 - p));
};

export const sigmoid = (value: number): number => {
	if (!Number.isFinite(value)) {
		return 0.5;
	}
	return 1 / (1 + Math.exp(-value));
};

export const blendLogit = (
	probabilityA: number,
	probabilityB: number,
	weightA: number,
	weightB: number,
): number => {
	const safeWeightA = Number.isFinite(weightA) ? Math.max(0, weightA) : 0;
	const safeWeightB = Number.isFinite(weightB) ? Math.max(0, weightB) : 0;
	const totalWeight = safeWeightA + safeWeightB;
	if (totalWeight <= 0) {
		return clampProbability(probabilityB);
	}
	const normalizedWeightA = safeWeightA / totalWeight;
	const normalizedWeightB = safeWeightB / totalWeight;
	const blendedLogit =
		logit(probabilityA) * normalizedWeightA +
		logit(probabilityB) * normalizedWeightB;
	return clampProbability(sigmoid(blendedLogit));
};

const normalizeGender = (value: unknown): Gender | null => {
	if (typeof value !== "string") {
		return null;
	}
	const normalized = value.trim().toLowerCase();
	if (normalized === "m" || normalized === "male" || normalized === "man") {
		return "male";
	}
	if (
		normalized === "f" ||
		normalized === "female" ||
		normalized === "woman" ||
		normalized === "women"
	) {
		return "female";
	}
	return null;
};

const toPairKey = (a: string, b: string): string =>
	[a, b].sort((left, right) => left.localeCompare(right)).join(":");

const matchupKey = (
	matchType: LineupMatchType,
	ourLow: string,
	ourHigh: string,
	oppLow: string,
	oppHigh: string,
): string => `${matchType}|${ourLow}|${ourHigh}|${oppLow}|${oppHigh}`;

const pairKeyAndType = (pairKey: string, matchType: LineupMatchType): string =>
	`${matchType}|${pairKey}`;

const seededRandom = (seed: number): (() => number) => {
	let value = (seed >>> 0) + 1;
	return () => {
		value = (value * 1664525 + 1013904223) >>> 0;
		return value / 0xffffffff;
	};
};

const getPairType = (left: Gender, right: Gender): LineupMatchType | null => {
	if (left === right) {
		return left === "male" ? "male" : "female";
	}
	return "mixed";
};

const asFiniteRate = (value: unknown): number | null =>
	typeof value === "number" && Number.isFinite(value) ? value : null;

export const resolveCandidateMatchTypeWinRate = (
	candidate: BundleCandidatePair,
	matchType: LineupMatchType,
): number => {
	if (matchType === "mixed") {
		return (
			asFiniteRate(candidate.mixed_win_rate_shrunk) ??
			asFiniteRate(candidate.win_rate_shrunk) ??
			asFiniteRate(candidate.mixed_win_rate) ??
			0.5
		);
	}
	if (matchType === "female") {
		return (
			asFiniteRate(candidate.female_win_rate_shrunk) ??
			asFiniteRate(candidate.win_rate_shrunk) ??
			asFiniteRate(candidate.female_win_rate) ??
			0.5
		);
	}
	if (matchType === "male") {
		return (
			asFiniteRate(candidate.male_win_rate_shrunk) ??
			asFiniteRate(candidate.win_rate_shrunk) ??
			asFiniteRate(candidate.male_win_rate) ??
			0.5
		);
	}
	return 0.5;
};

const resolveCandidateMatchTypePdWinProbability = (
	candidate: BundleCandidatePair,
	matchType: LineupMatchType,
	baseWinRate: number,
): number => {
	if (matchType === "mixed") {
		return (
			asFiniteRate(candidate.mixed_pd_win_probability) ??
			asFiniteRate(candidate.pd_win_probability) ??
			baseWinRate
		);
	}
	if (matchType === "female") {
		return (
			asFiniteRate(candidate.female_pd_win_probability) ??
			asFiniteRate(candidate.pd_win_probability) ??
			baseWinRate
		);
	}
	if (matchType === "male") {
		return (
			asFiniteRate(candidate.male_pd_win_probability) ??
			asFiniteRate(candidate.pd_win_probability) ??
			baseWinRate
		);
	}
	return baseWinRate;
};

const hasCandidateTypePdSignal = (
	candidate: BundleCandidatePair,
	matchType: LineupMatchType,
): boolean => {
	if (asFiniteRate(candidate.pd_win_probability) !== null) {
		return true;
	}
	if (matchType === "mixed") {
		return asFiniteRate(candidate.mixed_pd_win_probability) !== null;
	}
	if (matchType === "female") {
		return asFiniteRate(candidate.female_pd_win_probability) !== null;
	}
	if (matchType === "male") {
		return asFiniteRate(candidate.male_pd_win_probability) !== null;
	}
	return false;
};

const calculatePearsonCorrelation = (
	pairs: Array<{ x: number; y: number }>,
): number | null => {
	if (pairs.length < 4) {
		return null;
	}
	const meanX = pairs.reduce((acc, pair) => acc + pair.x, 0) / pairs.length;
	const meanY = pairs.reduce((acc, pair) => acc + pair.y, 0) / pairs.length;
	let numerator = 0;
	let varianceX = 0;
	let varianceY = 0;
	for (const pair of pairs) {
		const dx = pair.x - meanX;
		const dy = pair.y - meanY;
		numerator += dx * dy;
		varianceX += dx * dx;
		varianceY += dy * dy;
	}
	if (varianceX <= 1e-9 || varianceY <= 1e-9) {
		return null;
	}
	return Math.max(
		-1,
		Math.min(1, numerator / Math.sqrt(varianceX * varianceY)),
	);
};

const resolvePdBlendWeight = (
	reliability: number,
	signalCorrelation: number | null,
): number => {
	const clampedReliability = Math.max(0, Math.min(1, reliability));
	let weight =
		PD_BLEND_MIN_WEIGHT +
		(PD_BLEND_MAX_WEIGHT - PD_BLEND_MIN_WEIGHT) * clampedReliability;
	if (
		typeof signalCorrelation !== "number" ||
		!Number.isFinite(signalCorrelation)
	) {
		return weight;
	}
	const absCorrelation = Math.abs(signalCorrelation);
	if (absCorrelation < PD_CORRELATION_GUARDRAIL) {
		return weight;
	}
	const denom = PD_CORRELATION_HARD_CAP - PD_CORRELATION_GUARDRAIL;
	const normalized =
		denom > 0
			? Math.min(
					1,
					Math.max(0, (absCorrelation - PD_CORRELATION_GUARDRAIL) / denom),
				)
			: 1;
	const cappedMaxWeight =
		PD_HIGH_CORRELATION_MAX_WEIGHT * (1 - 0.4 * normalized);
	weight = Math.min(weight, cappedMaxWeight);
	return Math.max(0, Math.min(PD_BLEND_MAX_WEIGHT, weight));
};

export const blendWinProbabilitySignals = (params: {
	baseWinRate: number;
	pdWinProbability: number;
	reliability: number;
	signalCorrelation: number | null;
}): number => {
	const baseWinRate = clampProbability(params.baseWinRate);
	const pdWinProbability = clampProbability(params.pdWinProbability);
	const weight = resolvePdBlendWeight(
		params.reliability,
		params.signalCorrelation,
	);
	return clampProbability(
		baseWinRate * (1 - weight) + pdWinProbability * weight,
	);
};

const resolveScoringConfig = (
	config?: Partial<LineupLabScoringConfig>,
): LineupLabScoringConfig => {
	const duprMajorWeight =
		typeof config?.duprMajorWeight === "number"
			? config.duprMajorWeight
			: DEFAULT_DUPR_MAJOR_WEIGHT;
	if (
		!Number.isFinite(duprMajorWeight) ||
		duprMajorWeight < 0 ||
		duprMajorWeight > 1
	) {
		throw new Error("LINEUP_DUPR_MAJOR_WEIGHT must be between 0 and 1.");
	}

	const duprSlope =
		typeof config?.duprSlope === "number"
			? config.duprSlope
			: DEFAULT_DUPR_SLOPE;
	if (!Number.isFinite(duprSlope) || duprSlope <= 0) {
		throw new Error("LINEUP_DUPR_SLOPE must be positive.");
	}

	const teamStrengthFactor =
		typeof config?.teamStrengthFactor === "number"
			? config.teamStrengthFactor
			: DEFAULT_TEAM_STRENGTH_FACTOR;
	if (!Number.isFinite(teamStrengthFactor) || teamStrengthFactor < 0) {
		throw new Error("LINEUP_TEAM_STRENGTH_FACTOR must be non-negative.");
	}

	const teamStrengthCap =
		typeof config?.teamStrengthCap === "number"
			? config.teamStrengthCap
			: DEFAULT_TEAM_STRENGTH_CAP;
	if (!Number.isFinite(teamStrengthCap) || teamStrengthCap <= 0) {
		throw new Error("LINEUP_TEAM_STRENGTH_CAP must be positive.");
	}

	return {
		enableDuprBlend: config?.enableDuprBlend ?? true,
		duprMajorWeight,
		enableTeamStrengthAdjustment: config?.enableTeamStrengthAdjustment ?? true,
		duprSlope,
		teamStrengthFactor,
		teamStrengthCap,
	};
};

interface TeamStrengthAdjustment {
	probability: number;
	applied: boolean;
}

const applyTeamStrengthAdjustment = (
	probability: number,
	context: BuildContext,
): TeamStrengthAdjustment => {
	const baseProbability = clampProbability(probability);
	const config = context.scoringConfig;
	if (!config.enableTeamStrengthAdjustment) {
		return { probability: baseProbability, applied: false };
	}
	const teamStrengthDelta = context.teamStrengthDelta;
	if (
		typeof teamStrengthDelta !== "number" ||
		!Number.isFinite(teamStrengthDelta)
	) {
		return { probability: baseProbability, applied: false };
	}

	const rawAdjustment = config.teamStrengthFactor * teamStrengthDelta;
	const boundedAdjustment = Math.max(
		-config.teamStrengthCap,
		Math.min(config.teamStrengthCap, rawAdjustment),
	);
	const adjustedProbability = clampProbability(
		sigmoid(logit(baseProbability) + boundedAdjustment),
	);
	return {
		probability: adjustedProbability,
		applied: true,
	};
};

interface DuprSignalResult {
	probability: number | null;
	coverageCount: number;
	applied: boolean;
	weightApplied: number;
}

const toDuprValue = (value: unknown): number | null =>
	typeof value === "number" && Number.isFinite(value) ? value : null;

const evaluateDuprSignal = (
	context: BuildContext,
	ourPlayerAId: string,
	ourPlayerBId: string,
	oppPlayerAId: string,
	oppPlayerBId: string,
): DuprSignalResult => {
	const config = context.scoringConfig;
	const ratings = [
		toDuprValue(context.duprByPlayerId.get(ourPlayerAId)),
		toDuprValue(context.duprByPlayerId.get(ourPlayerBId)),
		toDuprValue(context.duprByPlayerId.get(oppPlayerAId)),
		toDuprValue(context.duprByPlayerId.get(oppPlayerBId)),
	];
	const coverageCount = ratings.filter((rating) => rating !== null).length;
	if (!config.enableDuprBlend || coverageCount < 4) {
		return {
			probability: null,
			coverageCount,
			applied: false,
			weightApplied: 0,
		};
	}

	const ourAverage = ((ratings[0] ?? 0) + (ratings[1] ?? 0)) / 2;
	const oppAverage = ((ratings[2] ?? 0) + (ratings[3] ?? 0)) / 2;
	const duprDelta = ourAverage - oppAverage;
	const duprProbability = clampProbability(
		sigmoid(config.duprSlope * duprDelta),
	);
	return {
		probability: duprProbability,
		coverageCount: 4,
		applied: true,
		weightApplied: config.duprMajorWeight,
	};
};

interface MatchupScoreResult {
	probability: number;
	reliability: number;
	duprApplied: boolean;
	duprCoverageCount: number;
	duprWeightApplied: number;
	teamStrengthApplied: boolean;
}

const toCoverageCount = (value: number): number =>
	Math.max(0, Math.min(4, Math.round(value)));

const combineFinalProbability = (
	pNonDupr: number,
	duprSignal: DuprSignalResult,
	config: LineupLabScoringConfig,
): number => {
	if (!duprSignal.applied || duprSignal.probability === null) {
		return clampProbability(pNonDupr);
	}
	return blendLogit(
		duprSignal.probability,
		pNonDupr,
		config.duprMajorWeight,
		1 - config.duprMajorWeight,
	);
};

const weightedQuantile = (
	values: number[],
	weights: number[],
	q: number,
): number => {
	if (values.length === 0) {
		return 0;
	}
	const entries = values.map((value, index) => ({
		value,
		weight: weights[index] ?? 0,
	}));
	entries.sort((left, right) => left.value - right.value);
	const totalWeight = entries.reduce((acc, entry) => acc + entry.weight, 0);
	if (totalWeight <= 0) {
		const sorted = [...values].sort((a, b) => a - b);
		const fallbackIndex = Math.max(
			0,
			Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1))),
		);
		return sorted[fallbackIndex] ?? 0;
	}
	const target = q * totalWeight;
	let cumulative = 0;
	for (const entry of entries) {
		cumulative += entry.weight;
		if (cumulative >= target) {
			return entry.value;
		}
	}
	return entries[entries.length - 1]?.value ?? 0;
};

const standardDeviation = (values: number[], weights: number[]): number => {
	if (values.length === 0) {
		return 0;
	}
	const totalWeight = weights.reduce((acc, value) => acc + value, 0);
	if (totalWeight <= 0) {
		const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
		const variance =
			values.reduce((acc, value) => acc + (value - mean) * (value - mean), 0) /
			values.length;
		return Math.sqrt(Math.max(variance, 0));
	}
	const mean =
		values.reduce(
			(acc, value, index) => acc + value * (weights[index] ?? 0),
			0,
		) / totalWeight;
	const variance =
		values.reduce((acc, value, index) => {
			const delta = value - mean;
			return acc + (weights[index] ?? 0) * delta * delta;
		}, 0) / totalWeight;
	return Math.sqrt(Math.max(variance, 0));
};

const buildWinDistribution = (gameProbabilities: number[]): number[] => {
	const maxWins = gameProbabilities.length;
	const distribution = new Array<number>(maxWins + 1).fill(0);
	distribution[0] = 1;
	for (const rawProbability of gameProbabilities) {
		const probability = clampProbability(rawProbability);
		for (let wins = maxWins; wins >= 0; wins -= 1) {
			const keepLoss = distribution[wins] * (1 - probability);
			const addWin = wins > 0 ? distribution[wins - 1] * probability : 0;
			distribution[wins] = keepLoss + addWin;
		}
	}
	return distribution;
};

const quantileFromDistribution = (
	distribution: number[],
	q: number,
): number => {
	let cumulative = 0;
	for (let wins = 0; wins < distribution.length; wins += 1) {
		cumulative += distribution[wins] ?? 0;
		if (cumulative >= q) {
			return wins;
		}
	}
	return Math.max(0, distribution.length - 1);
};

const confidenceFromCoverage = (
	coverage: number,
): "LOW" | "MEDIUM" | "HIGH" => {
	if (coverage >= 0.66) {
		return "HIGH";
	}
	if (coverage >= 0.4) {
		return "MEDIUM";
	}
	return "LOW";
};

const estimateMatchupWinProbability = (gameProbabilities: number[]): number => {
	if (gameProbabilities.length === 0) {
		return 0.5;
	}
	const maxWins = gameProbabilities.length;
	const distribution = new Array<number>(maxWins + 1).fill(0);
	distribution[0] = 1;
	for (const rawProbability of gameProbabilities) {
		const probability = clampProbability(rawProbability);
		for (let wins = maxWins; wins >= 0; wins -= 1) {
			const keepLoss = distribution[wins] * (1 - probability);
			const addWin = wins > 0 ? distribution[wins - 1] * probability : 0;
			distribution[wins] = keepLoss + addWin;
		}
	}

	const halfGames = maxWins / 2;
	let winProbability = 0;
	for (let wins = 0; wins <= maxWins; wins += 1) {
		if (wins > halfGames) {
			winProbability += distribution[wins] ?? 0;
			continue;
		}
		if (maxWins % 2 === 0 && wins === halfGames) {
			// Treat exact tie as a half-win probability to avoid overstating certainty.
			winProbability += (distribution[wins] ?? 0) * 0.5;
		}
	}
	return clampProbability(winProbability);
};

const matchupConfidenceFromSignals = (
	coverage: number,
	matchupWinProbability: number,
	scenarioWeights: number[],
): "LOW" | "MEDIUM" | "HIGH" => {
	const clampedCoverage = Math.max(0, Math.min(1, coverage));
	const decisiveness = Math.min(1, Math.abs(matchupWinProbability - 0.5) * 2);
	const concentration = scenarioWeights.reduce(
		(acc, weight) => acc + weight * weight,
		0,
	);
	const effectiveScenarioCount =
		concentration > 0 ? 1 / concentration : Math.max(1, scenarioWeights.length);
	const scenarioDiversity = Math.min(1, effectiveScenarioCount / 6);
	const score =
		clampedCoverage * 0.55 + decisiveness * 0.3 + scenarioDiversity * 0.15;
	if (score >= 0.68) {
		return "HIGH";
	}
	if (score >= 0.43) {
		return "MEDIUM";
	}
	return "LOW";
};

const buildContext = (
	request: LineupLabRecommendRequest,
	bundle: LineupLabFeatureBundle,
	config?: Partial<LineupLabScoringConfig>,
): BuildContext => {
	const playerGenderMap = new Map<string, Gender>();
	const duprByPlayerId = new Map<string, number>();
	for (const row of bundle.players_catalog ?? []) {
		if (typeof row?.player_id !== "string") {
			continue;
		}
		const normalizedGender = normalizeGender(row.gender);
		if (!normalizedGender) {
			continue;
		}
		playerGenderMap.set(row.player_id, normalizedGender);
		const duprRating =
			typeof row.dupr_rating === "number" && Number.isFinite(row.dupr_rating)
				? row.dupr_rating
				: null;
		if (duprRating !== null) {
			duprByPlayerId.set(row.player_id, duprRating);
		}
	}

	const players = request.availablePlayerIds
		.map((id) => ({ id, gender: playerGenderMap.get(id) }))
		.filter((player): player is PlayerMeta => Boolean(player.gender));

	const maleCount = players.filter((player) => player.gender === "male").length;
	const femaleCount = players.filter(
		(player) => player.gender === "female",
	).length;
	if (maleCount < 4 || femaleCount < 4) {
		throw new Error(
			"Insufficient eligible players by gender. Need at least 4 men and 4 women with known gender.",
		);
	}

	const candidateMap = new Map<string, BundleCandidatePair>();
	for (const candidate of bundle.candidate_pairs) {
		candidateMap.set(candidate.pair_key, candidate);
	}

	const pairRecordsByType: Record<LineupMatchType, PairRecord[]> = {
		mixed: [],
		female: [],
		male: [],
	};
	const candidateSignalSamples: Record<
		LineupMatchType,
		Array<{ x: number; y: number }>
	> = {
		mixed: [],
		female: [],
		male: [],
	};
	const pairRecordByKeyAndType = new Map<string, PairRecord>();

	for (let i = 0; i < players.length; i += 1) {
		for (let j = i + 1; j < players.length; j += 1) {
			const left = players[i];
			const right = players[j];
			if (!left || !right) {
				continue;
			}
			const matchType = getPairType(left.gender, right.gender);
			if (!matchType) {
				continue;
			}
			const pairKey = toPairKey(left.id, right.id);
			const candidate = candidateMap.get(pairKey);
			const baseWinRate = clampProbability(
				candidate
					? resolveCandidateMatchTypeWinRate(candidate, matchType)
					: 0.5,
			);
			const pdWinProbability = clampProbability(
				candidate
					? resolveCandidateMatchTypePdWinProbability(
							candidate,
							matchType,
							baseWinRate,
						)
					: baseWinRate,
			);
			const baseReliability =
				typeof candidate?.sample_reliability === "number"
					? Math.max(0, Math.min(1, candidate.sample_reliability))
					: 0;
			const record: PairRecord = {
				playerAId: left.id,
				playerBId: right.id,
				pairKey,
				matchType,
				baseWinRate,
				pdWinProbability,
				baseReliability,
			};
			if (candidate && hasCandidateTypePdSignal(candidate, matchType)) {
				candidateSignalSamples[matchType].push({
					x: baseWinRate,
					y: pdWinProbability,
				});
			}
			pairRecordsByType[matchType].push(record);
			pairRecordByKeyAndType.set(pairKeyAndType(pairKey, matchType), record);
		}
	}

	const pairMatchupMap = new Map<string, PairMatchupValue>();
	const matchupSignalSamples: Record<
		LineupMatchType,
		Array<{ x: number; y: number }>
	> = {
		mixed: [],
		female: [],
		male: [],
	};
	for (const row of bundle.pair_matchups) {
		const matchType = row.match_type;
		if (
			matchType !== "mixed" &&
			matchType !== "female" &&
			matchType !== "male"
		) {
			continue;
		}
		const winRate = clampProbability(
			typeof row.win_rate_shrunk === "number" ? row.win_rate_shrunk : 0.5,
		);
		const pdWinProbability = clampProbability(
			typeof row.pd_win_probability === "number"
				? row.pd_win_probability
				: winRate,
		);
		if (typeof row.pd_win_probability === "number") {
			matchupSignalSamples[matchType].push({
				x: winRate,
				y: pdWinProbability,
			});
		}
		pairMatchupMap.set(
			matchupKey(
				matchType,
				row.our_pair_low_id,
				row.our_pair_high_id,
				row.opp_pair_low_id,
				row.opp_pair_high_id,
			),
			{
				winRate,
				pdWinProbability,
				reliability:
					typeof row.sample_reliability === "number"
						? Math.max(0, Math.min(1, row.sample_reliability))
						: 0,
				signalCorrelation: null,
			},
		);
	}

	const candidateSignalCorrelationByType: Record<
		LineupMatchType,
		number | null
	> = {
		mixed: calculatePearsonCorrelation(candidateSignalSamples.mixed),
		female: calculatePearsonCorrelation(candidateSignalSamples.female),
		male: calculatePearsonCorrelation(candidateSignalSamples.male),
	};
	const matchupSignalCorrelationByType: Record<LineupMatchType, number | null> =
		{
			mixed: calculatePearsonCorrelation(matchupSignalSamples.mixed),
			female: calculatePearsonCorrelation(matchupSignalSamples.female),
			male: calculatePearsonCorrelation(matchupSignalSamples.male),
		};

	const rawScenarios: OpponentScenarioPrepared[] =
		bundle.opponent_scenarios.map((scenario, index) => {
			const byType: Record<LineupMatchType, OpponentPair[]> = {
				mixed: [],
				female: [],
				male: [],
			};
			for (const pairObj of scenario.scenario_pairs ?? []) {
				const type = pairObj.match_type;
				if (type !== "mixed" && type !== "female" && type !== "male") {
					continue;
				}
				if (
					typeof pairObj.pair_player_low_id !== "string" ||
					typeof pairObj.pair_player_high_id !== "string"
				) {
					continue;
				}
				const gamesWithPair =
					typeof (pairObj as { games_with_pair?: unknown }).games_with_pair ===
					"number"
						? Math.max(
								1,
								Math.floor(
									(pairObj as { games_with_pair: number }).games_with_pair,
								),
							)
						: 1;
				byType[type].push({
					lowId: pairObj.pair_player_low_id,
					highId: pairObj.pair_player_high_id,
					weight: gamesWithPair,
				});
			}
			const rawWeight =
				typeof scenario.scenario_probability === "number" &&
				Number.isFinite(scenario.scenario_probability) &&
				scenario.scenario_probability > 0
					? scenario.scenario_probability
					: 0;
			return {
				id: scenario.scenario_id || `scenario_${index + 1}`,
				weight: rawWeight,
				byType,
			};
		});

	const scenarioWeightSum = rawScenarios.reduce(
		(acc, scenario) => acc + scenario.weight,
		0,
	);
	const scenarios =
		rawScenarios.length > 0
			? rawScenarios.map((scenario) => ({
					...scenario,
					weight:
						scenarioWeightSum > 0
							? scenario.weight / scenarioWeightSum
							: 1 / rawScenarios.length,
				}))
			: [];

	const teamStrengthDelta =
		typeof bundle.team_strength?.strength_delta === "number" &&
		Number.isFinite(bundle.team_strength.strength_delta)
			? bundle.team_strength.strength_delta
			: null;

	return {
		players,
		pairRecordsByType,
		pairRecordByKeyAndType,
		pairMatchupMap,
		scenarios,
		candidateSignalCorrelationByType,
		matchupSignalCorrelationByType,
		downsideQuantile: request.downsideQuantile,
		objective: request.objective,
		duprByPlayerId,
		teamStrengthDelta,
		scoringConfig: resolveScoringConfig(config),
	};
};

const pairUsageCount = (state: MutableScheduleState, pairKey: string): number =>
	state.pairUsage.get(pairKey) ?? 0;

const playerGameCount = (
	state: MutableScheduleState,
	playerId: string,
): number => state.playerGames.get(playerId) ?? 0;

const getPairScore = (
	record: PairRecord,
	state: MutableScheduleState,
	rand: () => number,
): number => {
	const aCount = playerGameCount(state, record.playerAId);
	const bCount = playerGameCount(state, record.playerBId);
	const pairCount = pairUsageCount(state, record.pairKey);
	const fatiguePenalty = (aCount + bCount) * 0.03;
	const repeatPenalty = pairCount * 0.08;
	const randomNoise = rand() * 0.015;
	return (
		record.baseWinRate +
		record.baseReliability * 0.05 -
		fatiguePenalty -
		repeatPenalty +
		randomNoise
	);
};

const getKnownOpponentPairScore = (
	context: BuildContext,
	record: PairRecord,
	opponentPair: OpponentPair,
	state: MutableScheduleState,
): number => {
	const matchupScore = scoreMatchupForOpponentPair(
		context,
		{
			roundNumber: 0,
			slotNumber: 0,
			matchType: record.matchType,
			playerAId: record.playerAId,
			playerBId: record.playerBId,
			winProbability: 0.5,
		},
		opponentPair,
	);
	const aCount = playerGameCount(state, record.playerAId);
	const bCount = playerGameCount(state, record.playerBId);
	const pairCount = pairUsageCount(state, record.pairKey);
	const fatiguePenalty = (aCount + bCount) * 0.02;
	const repeatPenalty = pairCount * 0.08;
	return (
		matchupScore.probability +
		matchupScore.reliability * 0.04 -
		fatiguePenalty -
		repeatPenalty
	);
};

const getEligiblePairsForSlot = (
	slotType: LineupMatchType,
	state: MutableScheduleState,
	roundPlayers: Set<string>,
	pairRecordsByType: Record<LineupMatchType, PairRecord[]>,
): PairRecord[] =>
	pairRecordsByType[slotType].filter((record) => {
		if (
			roundPlayers.has(record.playerAId) ||
			roundPlayers.has(record.playerBId)
		) {
			return false;
		}
		if (
			playerGameCount(state, record.playerAId) >= MAX_PLAYER_GAMES ||
			playerGameCount(state, record.playerBId) >= MAX_PLAYER_GAMES
		) {
			return false;
		}
		if (pairUsageCount(state, record.pairKey) >= MAX_PAIR_GAMES) {
			return false;
		}
		return true;
	});

const applyPairToState = (
	state: MutableScheduleState,
	record: PairRecord,
	delta: 1 | -1,
): void => {
	state.playerGames.set(
		record.playerAId,
		Math.max(0, playerGameCount(state, record.playerAId) + delta),
	);
	state.playerGames.set(
		record.playerBId,
		Math.max(0, playerGameCount(state, record.playerBId) + delta),
	);
	state.pairUsage.set(
		record.pairKey,
		Math.max(0, pairUsageCount(state, record.pairKey) + delta),
	);
};

const solveRound = (
	slotTypes: LineupMatchType[],
	state: MutableScheduleState,
	pairRecordsByType: Record<LineupMatchType, PairRecord[]>,
	rand: () => number,
): PairRecord[] | null => {
	const assignments: PairRecord[] = [];
	const roundPlayers = new Set<string>();

	const recurse = (slotIndex: number): boolean => {
		if (slotIndex >= slotTypes.length) {
			return true;
		}
		const slotType = slotTypes[slotIndex];
		if (!slotType) {
			return false;
		}
		const candidates = getEligiblePairsForSlot(
			slotType,
			state,
			roundPlayers,
			pairRecordsByType,
		)
			.map((record) => ({
				record,
				score: getPairScore(record, state, rand),
			}))
			.sort((left, right) => right.score - left.score)
			.slice(0, 14);

		for (const candidate of candidates) {
			const record = candidate.record;
			assignments.push(record);
			roundPlayers.add(record.playerAId);
			roundPlayers.add(record.playerBId);
			applyPairToState(state, record, 1);

			if (recurse(slotIndex + 1)) {
				return true;
			}

			applyPairToState(state, record, -1);
			roundPlayers.delete(record.playerAId);
			roundPlayers.delete(record.playerBId);
			assignments.pop();
		}

		return false;
	};

	return recurse(0) ? assignments : null;
};

const solveRoundKnownOpponent = (
	context: BuildContext,
	slotInputs: KnownOpponentSlot[],
	state: MutableScheduleState,
): PairRecord[] | null => {
	const assignments: PairRecord[] = [];
	const roundPlayers = new Set<string>();

	const recurse = (slotIndex: number): boolean => {
		if (slotIndex >= slotInputs.length) {
			return true;
		}
		const slot = slotInputs[slotIndex];
		if (!slot) {
			return false;
		}
		const candidates = getEligiblePairsForSlot(
			slot.matchType,
			state,
			roundPlayers,
			context.pairRecordsByType,
		)
			.map((record) => ({
				record,
				score: getKnownOpponentPairScore(
					context,
					record,
					slot.opponentPair,
					state,
				),
			}))
			.sort((left, right) => {
				if (right.score !== left.score) {
					return right.score - left.score;
				}
				return left.record.pairKey.localeCompare(right.record.pairKey);
			})
			.slice(0, 18);

		for (const candidate of candidates) {
			const record = candidate.record;
			assignments.push(record);
			roundPlayers.add(record.playerAId);
			roundPlayers.add(record.playerBId);
			applyPairToState(state, record, 1);
			if (recurse(slotIndex + 1)) {
				return true;
			}
			applyPairToState(state, record, -1);
			roundPlayers.delete(record.playerAId);
			roundPlayers.delete(record.playerBId);
			assignments.pop();
		}

		return false;
	};

	return recurse(0) ? assignments : null;
};

const buildScheduleRounds = (
	context: BuildContext,
	seed: number,
): LineupScheduledRound[] | null => {
	const rand = seededRandom(seed);
	const state: MutableScheduleState = {
		playerGames: new Map<string, number>(),
		pairUsage: new Map<string, number>(),
	};

	const rounds: LineupScheduledRound[] = [];
	for (let roundIndex = 0; roundIndex < TOTAL_ROUNDS; roundIndex += 1) {
		const template = ROUND_SLOT_TEMPLATE[roundIndex];
		if (!template) {
			return null;
		}
		const slotOrder = [...template].sort((left, right) => {
			if (left === right) {
				return 0;
			}
			return rand() > 0.5 ? 1 : -1;
		});
		const solved = solveRound(
			slotOrder,
			state,
			context.pairRecordsByType,
			rand,
		);
		if (!solved) {
			return null;
		}

		const games: LineupScheduledGame[] = solved.map((pair, slot) => ({
			roundNumber: roundIndex + 1,
			slotNumber: slot + 1,
			matchType: pair.matchType,
			playerAId: pair.playerAId,
			playerBId: pair.playerBId,
			winProbability: 0.5,
		}));
		rounds.push({ roundNumber: roundIndex + 1, games });
	}

	return rounds;
};

const normalizeKnownOpponentSlots = (
	request: LineupLabRecommendRequest,
): KnownOpponentSlot[] => {
	const slots: KnownOpponentSlot[] = [];
	for (const round of request.opponentRounds ?? []) {
		for (const game of round.games) {
			const opponentSorted = [
				game.opponentPlayerAId,
				game.opponentPlayerBId,
			].sort((left, right) => left.localeCompare(right));
			slots.push({
				roundNumber: round.roundNumber,
				slotNumber: game.slotNumber,
				matchType: game.matchType,
				opponentPair: {
					lowId: opponentSorted[0] ?? "",
					highId: opponentSorted[1] ?? "",
					weight: 1,
				},
			});
		}
	}
	return slots.sort((left, right) => {
		if (left.roundNumber !== right.roundNumber) {
			return left.roundNumber - right.roundNumber;
		}
		return left.slotNumber - right.slotNumber;
	});
};

const buildScheduleRoundsKnownOpponent = (
	context: BuildContext,
	request: LineupLabRecommendRequest,
): {
	rounds: LineupScheduledRound[];
	opponentSlotMap: Map<string, OpponentPair>;
} => {
	const normalizedSlots = normalizeKnownOpponentSlots(request);
	if (normalizedSlots.length !== TOTAL_ROUNDS * 4) {
		throw new Error("Known-opponent request is missing slot assignments.");
	}
	const opponentSlotMap = new Map<string, OpponentPair>();
	for (const slot of normalizedSlots) {
		opponentSlotMap.set(
			`${slot.roundNumber}:${slot.slotNumber}`,
			slot.opponentPair,
		);
	}

	const state: MutableScheduleState = {
		playerGames: new Map<string, number>(),
		pairUsage: new Map<string, number>(),
	};
	const rounds: LineupScheduledRound[] = [];
	for (let roundNumber = 1; roundNumber <= TOTAL_ROUNDS; roundNumber += 1) {
		const slotInputs = normalizedSlots.filter(
			(slot) => slot.roundNumber === roundNumber,
		);
		const solved = solveRoundKnownOpponent(context, slotInputs, state);
		if (!solved) {
			throw new Error(
				"Unable to generate a known-opponent schedule with current constraints.",
			);
		}
		const games: LineupScheduledGame[] = solved.map((pair, slotIndex) => ({
			roundNumber,
			slotNumber: slotIndex + 1,
			matchType: pair.matchType,
			playerAId: pair.playerAId,
			playerBId: pair.playerBId,
			winProbability: 0.5,
		}));
		rounds.push({ roundNumber, games });
	}
	return { rounds, opponentSlotMap };
};

const getMatchupProbability = (
	context: BuildContext,
	game: LineupScheduledGame,
	opponentPair: OpponentPair,
): PairMatchupValue => {
	const ourSorted = [game.playerAId, game.playerBId].sort((a, b) =>
		a.localeCompare(b),
	);
	const ourLow = ourSorted[0] ?? "";
	const ourHigh = ourSorted[1] ?? "";
	const mapValue = context.pairMatchupMap.get(
		matchupKey(
			game.matchType,
			ourLow,
			ourHigh,
			opponentPair.lowId,
			opponentPair.highId,
		),
	);
	if (mapValue) {
		return {
			...mapValue,
			signalCorrelation:
				context.matchupSignalCorrelationByType[game.matchType] ??
				mapValue.signalCorrelation,
		};
	}

	const fallback = context.pairRecordByKeyAndType.get(
		pairKeyAndType(toPairKey(game.playerAId, game.playerBId), game.matchType),
	);
	if (fallback) {
		return {
			winRate: fallback.baseWinRate,
			pdWinProbability: fallback.pdWinProbability,
			reliability: fallback.baseReliability,
			signalCorrelation:
				context.candidateSignalCorrelationByType[game.matchType],
		};
	}

	return {
		winRate: 0.5,
		pdWinProbability: 0.5,
		reliability: 0,
		signalCorrelation: null,
	};
};

const scoreFallbackWithTeamAdjustment = (
	context: BuildContext,
	game: LineupScheduledGame,
): MatchupScoreResult => {
	const fallback = context.pairRecordByKeyAndType.get(
		pairKeyAndType(toPairKey(game.playerAId, game.playerBId), game.matchType),
	);
	const pCurrent = fallback
		? blendWinProbabilitySignals({
				baseWinRate: fallback.baseWinRate,
				pdWinProbability: fallback.pdWinProbability,
				reliability: fallback.baseReliability,
				signalCorrelation:
					context.candidateSignalCorrelationByType[game.matchType],
			})
		: 0.5;
	const teamAdjusted = applyTeamStrengthAdjustment(pCurrent, context);
	return {
		probability: teamAdjusted.probability,
		reliability: fallback?.baseReliability ?? 0,
		duprApplied: false,
		duprCoverageCount: 0,
		duprWeightApplied: 0,
		teamStrengthApplied: teamAdjusted.applied,
	};
};

const scoreMatchupForOpponentPair = (
	context: BuildContext,
	game: LineupScheduledGame,
	opponentPair: OpponentPair,
): MatchupScoreResult => {
	const probability = getMatchupProbability(context, game, opponentPair);
	const pCurrent = blendWinProbabilitySignals({
		baseWinRate: probability.winRate,
		pdWinProbability: probability.pdWinProbability,
		reliability: probability.reliability,
		signalCorrelation: probability.signalCorrelation,
	});
	const teamAdjusted = applyTeamStrengthAdjustment(pCurrent, context);
	const duprSignal = evaluateDuprSignal(
		context,
		game.playerAId,
		game.playerBId,
		opponentPair.lowId,
		opponentPair.highId,
	);
	return {
		probability: combineFinalProbability(
			teamAdjusted.probability,
			duprSignal,
			context.scoringConfig,
		),
		reliability: probability.reliability,
		duprApplied: duprSignal.applied,
		duprCoverageCount: duprSignal.coverageCount,
		duprWeightApplied: duprSignal.weightApplied,
		teamStrengthApplied: teamAdjusted.applied,
	};
};

const scoreGameAgainstScenario = (
	context: BuildContext,
	game: LineupScheduledGame,
	scenario: OpponentScenarioPrepared,
): MatchupScoreResult => {
	const opponentPairs = scenario.byType[game.matchType] ?? [];
	if (opponentPairs.length === 0) {
		return scoreFallbackWithTeamAdjustment(context, game);
	}

	const totalWeight = opponentPairs.reduce((acc, pair) => acc + pair.weight, 0);
	if (totalWeight <= 0) {
		return scoreFallbackWithTeamAdjustment(context, game);
	}

	let weightedProbability = 0;
	let weightedReliability = 0;
	let weightedCoverage = 0;
	let weightedDuprApplied = 0;
	let weightedTeamStrengthApplied = 0;
	for (const opponentPair of opponentPairs) {
		const result = scoreMatchupForOpponentPair(context, game, opponentPair);
		weightedProbability += result.probability * opponentPair.weight;
		weightedReliability += result.reliability * opponentPair.weight;
		weightedCoverage += result.duprCoverageCount * opponentPair.weight;
		if (result.duprApplied) {
			weightedDuprApplied += opponentPair.weight;
		}
		if (result.teamStrengthApplied) {
			weightedTeamStrengthApplied += opponentPair.weight;
		}
	}

	return {
		probability: clampProbability(weightedProbability / totalWeight),
		reliability: weightedReliability / totalWeight,
		duprApplied: weightedDuprApplied > 0,
		duprCoverageCount: toCoverageCount(weightedCoverage / totalWeight),
		duprWeightApplied:
			weightedDuprApplied > 0 ? context.scoringConfig.duprMajorWeight : 0,
		teamStrengthApplied: weightedTeamStrengthApplied > 0,
	};
};

const scoreSchedule = (
	context: BuildContext,
	rounds: LineupScheduledRound[],
): ScoredSchedule => {
	const games = rounds.flatMap((round) => round.games);
	const scenarioTotals: number[] = [];
	const scenarioMatchupWinProbabilities: number[] = [];
	const scenarioWeights: number[] = [];
	let globalCoverage = 0;

	const expectedWinByGame = new Map<string, number>();
	const duprCoverageByGame = new Map<string, number>();
	const duprAppliedWeightByGame = new Map<string, number>();
	const teamStrengthAppliedWeightByGame = new Map<string, number>();
	for (const game of games) {
		const key = `${game.roundNumber}:${game.slotNumber}`;
		expectedWinByGame.set(key, 0);
		duprCoverageByGame.set(key, 0);
		duprAppliedWeightByGame.set(key, 0);
		teamStrengthAppliedWeightByGame.set(key, 0);
	}

	for (const scenario of context.scenarios) {
		let scenarioExpectedWins = 0;
		const scenarioGameWinProbabilities: number[] = [];
		for (const game of games) {
			const score = scoreGameAgainstScenario(context, game, scenario);
			const key = `${game.roundNumber}:${game.slotNumber}`;
			scenarioExpectedWins += score.probability;
			scenarioGameWinProbabilities.push(score.probability);
			globalCoverage += score.reliability * scenario.weight;
			expectedWinByGame.set(
				key,
				(expectedWinByGame.get(key) ?? 0) + score.probability * scenario.weight,
			);
			duprCoverageByGame.set(
				key,
				(duprCoverageByGame.get(key) ?? 0) +
					score.duprCoverageCount * scenario.weight,
			);
			if (score.duprApplied) {
				duprAppliedWeightByGame.set(
					key,
					(duprAppliedWeightByGame.get(key) ?? 0) + scenario.weight,
				);
			}
			if (score.teamStrengthApplied) {
				teamStrengthAppliedWeightByGame.set(
					key,
					(teamStrengthAppliedWeightByGame.get(key) ?? 0) + scenario.weight,
				);
			}
		}
		scenarioTotals.push(scenarioExpectedWins);
		scenarioMatchupWinProbabilities.push(
			estimateMatchupWinProbability(scenarioGameWinProbabilities),
		);
		scenarioWeights.push(scenario.weight);
	}

	const expectedWins =
		scenarioTotals.reduce(
			(acc, value, index) => acc + value * (scenarioWeights[index] ?? 0),
			0,
		) || 0;
	const floorWinsQ20 = weightedQuantile(
		scenarioTotals,
		scenarioWeights,
		context.downsideQuantile,
	);
	const volatility = standardDeviation(scenarioTotals, scenarioWeights);
	const matchupWinProbability =
		scenarioMatchupWinProbabilities.reduce(
			(acc, value, index) => acc + value * (scenarioWeights[index] ?? 0),
			0,
		) || 0.5;
	const gameCoverage = globalCoverage / Math.max(games.length, 1);
	const gameConfidence = confidenceFromCoverage(gameCoverage);
	const matchupConfidence = matchupConfidenceFromSignals(
		gameCoverage,
		matchupWinProbability,
		scenarioWeights,
	);

	const roundsWithWinProbability = rounds.map((round) => ({
		roundNumber: round.roundNumber,
		games: round.games.map((game) => ({
			...game,
			...((): LineupScheduledGame => {
				const key = `${game.roundNumber}:${game.slotNumber}`;
				const duprApplied = (duprAppliedWeightByGame.get(key) ?? 0) > 0;
				const duprCoverageCount = toCoverageCount(
					duprCoverageByGame.get(key) ?? 0,
				);
				const teamStrengthApplied =
					(teamStrengthAppliedWeightByGame.get(key) ?? 0) > 0;
				return {
					...game,
					winProbability: Number((expectedWinByGame.get(key) ?? 0).toFixed(3)),
					duprApplied,
					duprCoverageCount,
					duprWeightApplied: duprApplied
						? context.scoringConfig.duprMajorWeight
						: 0,
					teamStrengthApplied,
				};
			})(),
		})),
	}));

	const gameDiagnostics = roundsWithWinProbability.flatMap(
		(round) => round.games,
	);
	const duprApplied = gameDiagnostics.some((game) => game.duprApplied === true);
	const duprCoverageCount = toCoverageCount(
		gameDiagnostics.reduce(
			(acc, game) => acc + (game.duprCoverageCount ?? 0),
			0,
		) / Math.max(gameDiagnostics.length, 1),
	);
	const teamStrengthApplied = gameDiagnostics.some(
		(game) => game.teamStrengthApplied === true,
	);

	const pairUsageMap = new Map<
		string,
		{ playerAId: string; playerBId: string; count: number }
	>();
	for (const game of games) {
		const key = toPairKey(game.playerAId, game.playerBId);
		const existing = pairUsageMap.get(key);
		if (existing) {
			existing.count += 1;
			continue;
		}
		pairUsageMap.set(key, {
			playerAId: game.playerAId,
			playerBId: game.playerBId,
			count: 1,
		});
	}
	const pairUsage = [...pairUsageMap.values()].sort(
		(left, right) => right.count - left.count,
	);
	const topPairs = pairUsage.slice(0, 6).map((pair) => ({
		playerAId: pair.playerAId,
		playerBId: pair.playerBId,
	}));

	const signature = roundsWithWinProbability
		.flatMap((round) =>
			round.games.map(
				(game) =>
					`${round.roundNumber}:${game.slotNumber}:${game.matchType}:${toPairKey(game.playerAId, game.playerBId)}`,
			),
		)
		.join("|");
	const pairSetId = createHash("sha1")
		.update(signature)
		.digest("hex")
		.slice(0, 12);

	return {
		pairSetId,
		rounds: roundsWithWinProbability,
		expectedWins: Number(expectedWins.toFixed(3)),
		floorWinsQ20: Number(floorWinsQ20.toFixed(3)),
		matchupWinProbability: Number(matchupWinProbability.toFixed(3)),
		volatility: Number(volatility.toFixed(3)),
		gameConfidence,
		matchupConfidence,
		duprApplied,
		duprCoverageCount,
		duprWeightApplied: duprApplied ? context.scoringConfig.duprMajorWeight : 0,
		teamStrengthApplied,
		pairUsage,
		pairs: topPairs,
	};
};

const scoreKnownOpponentSchedule = (
	context: BuildContext,
	rounds: LineupScheduledRound[],
	opponentSlotMap: Map<string, OpponentPair>,
): ScoredSchedule => {
	const games = rounds.flatMap((round) => round.games);
	const winProbabilities: number[] = [];
	const reliabilities: number[] = [];
	let duprCoverageTotal = 0;
	let duprApplied = false;
	let teamStrengthApplied = false;
	const roundsWithWinProbability = rounds.map((round) => ({
		roundNumber: round.roundNumber,
		games: round.games.map((game) => {
			const opponentPair = opponentSlotMap.get(
				`${game.roundNumber}:${game.slotNumber}`,
			);
			const result = opponentPair
				? scoreMatchupForOpponentPair(context, game, opponentPair)
				: scoreFallbackWithTeamAdjustment(context, game);
			winProbabilities.push(result.probability);
			reliabilities.push(result.reliability);
			duprCoverageTotal += result.duprCoverageCount;
			duprApplied = duprApplied || result.duprApplied;
			teamStrengthApplied = teamStrengthApplied || result.teamStrengthApplied;
			return {
				...game,
				winProbability: Number(result.probability.toFixed(3)),
				duprApplied: result.duprApplied,
				duprCoverageCount: result.duprCoverageCount,
				duprWeightApplied: result.duprWeightApplied,
				teamStrengthApplied: result.teamStrengthApplied,
			};
		}),
	}));

	const distribution = buildWinDistribution(winProbabilities);
	const expectedWins = winProbabilities.reduce((acc, value) => acc + value, 0);
	const floorWinsQ20 = quantileFromDistribution(
		distribution,
		context.downsideQuantile,
	);
	const variance = winProbabilities.reduce(
		(acc, probability) => acc + probability * (1 - probability),
		0,
	);
	const volatility = Math.sqrt(Math.max(variance, 0));
	const matchupWinProbability = estimateMatchupWinProbability(winProbabilities);
	const coverage =
		reliabilities.reduce((acc, value) => acc + value, 0) /
		Math.max(reliabilities.length, 1);
	const gameConfidence = confidenceFromCoverage(coverage);
	const matchupConfidence = matchupConfidenceFromSignals(
		coverage,
		matchupWinProbability,
		[1],
	);

	const pairUsageMap = new Map<
		string,
		{ playerAId: string; playerBId: string; count: number }
	>();
	for (const game of games) {
		const key = toPairKey(game.playerAId, game.playerBId);
		const existing = pairUsageMap.get(key);
		if (existing) {
			existing.count += 1;
			continue;
		}
		pairUsageMap.set(key, {
			playerAId: game.playerAId,
			playerBId: game.playerBId,
			count: 1,
		});
	}
	const pairUsage = [...pairUsageMap.values()].sort(
		(left, right) => right.count - left.count,
	);
	const topPairs = pairUsage.slice(0, 6).map((pair) => ({
		playerAId: pair.playerAId,
		playerBId: pair.playerBId,
	}));
	const signature = roundsWithWinProbability
		.flatMap((round) =>
			round.games.map(
				(game) =>
					`${round.roundNumber}:${game.slotNumber}:${game.matchType}:${toPairKey(game.playerAId, game.playerBId)}`,
			),
		)
		.join("|");
	const pairSetId = createHash("sha1")
		.update(signature)
		.digest("hex")
		.slice(0, 12);

	return {
		pairSetId,
		rounds: roundsWithWinProbability,
		expectedWins: Number(expectedWins.toFixed(3)),
		floorWinsQ20: Number(floorWinsQ20.toFixed(3)),
		matchupWinProbability: Number(matchupWinProbability.toFixed(3)),
		volatility: Number(volatility.toFixed(3)),
		gameConfidence,
		matchupConfidence,
		duprApplied,
		duprCoverageCount: toCoverageCount(
			duprCoverageTotal / Math.max(games.length, 1),
		),
		duprWeightApplied: duprApplied ? context.scoringConfig.duprMajorWeight : 0,
		teamStrengthApplied,
		pairUsage,
		pairs: topPairs,
	};
};

const rankSchedules = (
	schedules: ScoredSchedule[],
	objective: LineupLabObjective,
): ScoredSchedule[] =>
	[...schedules].sort((left, right) => {
		if (objective === "MAX_EXPECTED_WINS") {
			if (right.expectedWins !== left.expectedWins) {
				return right.expectedWins - left.expectedWins;
			}
			if (right.matchupWinProbability !== left.matchupWinProbability) {
				return right.matchupWinProbability - left.matchupWinProbability;
			}
			if (right.floorWinsQ20 !== left.floorWinsQ20) {
				return right.floorWinsQ20 - left.floorWinsQ20;
			}
			return left.volatility - right.volatility;
		}
		if (right.floorWinsQ20 !== left.floorWinsQ20) {
			return right.floorWinsQ20 - left.floorWinsQ20;
		}
		if (right.matchupWinProbability !== left.matchupWinProbability) {
			return right.matchupWinProbability - left.matchupWinProbability;
		}
		if (right.expectedWins !== left.expectedWins) {
			return right.expectedWins - left.expectedWins;
		}
		return left.volatility - right.volatility;
	});

export const recommendPairSets = (
	request: LineupLabRecommendRequest,
	bundle: LineupLabFeatureBundle,
	config?: Partial<LineupLabScoringConfig>,
): ScoredSchedule[] => {
	const context = buildContext(request, bundle, config);
	if (context.scenarios.length === 0) {
		throw new Error("No opponent scenarios available for recommendation.");
	}

	const candidates: ScoredSchedule[] = [];
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
		const rounds = buildScheduleRounds(context, attempt + 1);
		if (!rounds) {
			continue;
		}
		const scored = scoreSchedule(context, rounds);
		candidates.push(scored);
	}

	if (candidates.length === 0) {
		throw new Error(
			"Unable to generate valid schedules with current constraints.",
		);
	}

	const uniqueById = new Map<string, ScoredSchedule>();
	for (const candidate of candidates) {
		const existing = uniqueById.get(candidate.pairSetId);
		if (!existing) {
			uniqueById.set(candidate.pairSetId, candidate);
			continue;
		}
		if (candidate.expectedWins > existing.expectedWins) {
			uniqueById.set(candidate.pairSetId, candidate);
		}
	}

	return rankSchedules([...uniqueById.values()], context.objective);
};

export const recommendPairSetsKnownOpponent = (
	request: LineupLabRecommendRequest,
	bundle: LineupLabFeatureBundle,
	config?: Partial<LineupLabScoringConfig>,
): ScoredSchedule[] => {
	const context = buildContext(request, bundle, config);
	const { rounds, opponentSlotMap } = buildScheduleRoundsKnownOpponent(
		context,
		request,
	);
	const scored = scoreKnownOpponentSchedule(context, rounds, opponentSlotMap);
	return rankSchedules([scored], context.objective);
};

export const toRecommendations = (
	scores: ScoredSchedule[],
	maxRecommendations: number,
): LineupLabRecommendation[] =>
	scores.slice(0, maxRecommendations).map((score, index) => ({
		rank: index + 1,
		pairSetId: score.pairSetId,
		pairs: score.pairs,
		expectedWins: score.expectedWins,
		floorWinsQ20: score.floorWinsQ20,
		matchupWinProbability: score.matchupWinProbability,
		volatility: score.volatility,
		confidence: score.gameConfidence,
		gameConfidence: score.gameConfidence,
		matchupConfidence: score.matchupConfidence,
		duprApplied: score.duprApplied,
		duprCoverageCount: score.duprCoverageCount,
		duprWeightApplied: score.duprWeightApplied,
		teamStrengthApplied: score.teamStrengthApplied,
		rounds: score.rounds,
		pairUsage: score.pairUsage,
	}));
