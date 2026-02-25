import { describe, expect, it } from "vitest";

import {
	blendLogit,
	blendWinProbabilitySignals,
	logit,
	recommendPairSets,
	recommendPairSetsKnownOpponent,
	resolveCandidateMatchTypeWinRate,
	sigmoid,
	toRecommendations,
} from "../worker/src/runtime/lineupLab/optimizer";
import type {
	LineupLabFeatureBundle,
	LineupLabRecommendRequest,
} from "../worker/src/runtime/lineupLab/types";

const men = [
	"10000000-0000-4000-8000-000000000001",
	"10000000-0000-4000-8000-000000000002",
	"10000000-0000-4000-8000-000000000003",
	"10000000-0000-4000-8000-000000000004",
	"10000000-0000-4000-8000-000000000005",
	"10000000-0000-4000-8000-000000000006",
	"10000000-0000-4000-8000-000000000007",
];

const women = [
	"20000000-0000-4000-8000-000000000001",
	"20000000-0000-4000-8000-000000000002",
	"20000000-0000-4000-8000-000000000003",
	"20000000-0000-4000-8000-000000000004",
	"20000000-0000-4000-8000-000000000005",
	"20000000-0000-4000-8000-000000000006",
	"20000000-0000-4000-8000-000000000007",
];

const allPlayers = [...men, ...women];

const buildKnownOpponentRounds = () => {
	const template: Array<Array<"mixed" | "female" | "male">> = [
		["mixed", "mixed", "mixed", "mixed"],
		["female", "female", "male", "male"],
		["mixed", "mixed", "mixed", "mixed"],
		["female", "female", "male", "male"],
		["mixed", "mixed", "mixed", "mixed"],
		["female", "female", "male", "male"],
		["mixed", "mixed", "mixed", "mixed"],
		["female", "female", "male", "male"],
	];
	return template.map((slotTypes, roundIndex) => ({
		roundNumber: roundIndex + 1,
		games: slotTypes.map((matchType, slotIndex) => ({
			roundNumber: roundIndex + 1,
			slotNumber: slotIndex + 1,
			matchType,
			opponentPlayerAId: men[slotIndex % men.length] ?? men[0] ?? "",
			opponentPlayerBId:
				women[(slotIndex + 1) % women.length] ?? women[0] ?? "",
		})),
	}));
};

const baseBundle: LineupLabFeatureBundle = {
	candidate_pairs: [],
	pair_matchups: [],
	opponent_scenarios: [
		{
			scenario_id: "scenario_1",
			scenario_probability: 1,
			scenario_pairs: [
				{
					match_type: "mixed",
					pair_player_low_id: men[0],
					pair_player_high_id: women[0],
					games_with_pair: 16,
				} as unknown as {
					match_type: string;
					pair_player_low_id: string;
					pair_player_high_id: string;
				},
				{
					match_type: "male",
					pair_player_low_id: men[1],
					pair_player_high_id: men[2],
					games_with_pair: 8,
				} as unknown as {
					match_type: string;
					pair_player_low_id: string;
					pair_player_high_id: string;
				},
				{
					match_type: "female",
					pair_player_low_id: women[1],
					pair_player_high_id: women[2],
					games_with_pair: 8,
				} as unknown as {
					match_type: string;
					pair_player_low_id: string;
					pair_player_high_id: string;
				},
			],
		},
	],
	players_catalog: [
		...men.map((id) => ({
			player_id: id,
			gender: "male",
			first_name: `M${id.slice(-2)}`,
			last_name: "Player",
			dupr_rating: 4.2,
		})),
		...women.map((id) => ({
			player_id: id,
			gender: "female",
			first_name: `F${id.slice(-2)}`,
			last_name: "Player",
			dupr_rating: 3.8,
		})),
	],
	team_strength: {
		our_team_id: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
		opp_team_id: "6bb73493-1a15-4527-9765-6aadfaca773b",
		our_team_strength: 0.72,
		opp_team_strength: 0.42,
		strength_delta: 0.3,
		snapshot_date: "2026-02-15",
	},
};

const knownOpponentRequest: LineupLabRecommendRequest = {
	divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
	seasonYear: 2025,
	seasonNumber: 3,
	teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
	oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
	matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
	mode: "known_opponent",
	availablePlayerIds: allPlayers,
	objective: "MAX_EXPECTED_WINS",
	maxRecommendations: 3,
	downsideQuantile: 0.2,
	scenarioLimit: 12,
	opponentRounds: buildKnownOpponentRounds(),
};

describe("lineup lab optimizer", () => {
	it("exposes stable logit/sigmoid helpers and bounded logit blending", () => {
		expect(Number(logit(0.5).toFixed(6))).toBe(0);
		expect(Number(sigmoid(0).toFixed(6))).toBe(0.5);

		const blended = blendLogit(0.8, 0.2, 0.65, 0.35);
		expect(blended).toBeGreaterThan(0.5);
		expect(blended).toBeLessThan(0.95);
	});

	it("prefers type-specific shrunk rates and handles sparse type rates safely", () => {
		expect(
			resolveCandidateMatchTypeWinRate(
				{
					pair_player_low_id: men[0] ?? "",
					pair_player_high_id: women[0] ?? "",
					pair_key: `${men[0]}:${women[0]}`,
					win_rate_shrunk: 0.54,
					mixed_win_rate: 0.96,
					mixed_win_rate_shrunk: 0.61,
				},
				"mixed",
			),
		).toBe(0.61);

		expect(
			resolveCandidateMatchTypeWinRate(
				{
					pair_player_low_id: women[1] ?? "",
					pair_player_high_id: women[2] ?? "",
					pair_key: `${women[1]}:${women[2]}`,
					win_rate_shrunk: 0.52,
					female_win_rate: null,
				},
				"female",
			),
		).toBe(0.52);

		expect(
			resolveCandidateMatchTypeWinRate(
				{
					pair_player_low_id: men[1] ?? "",
					pair_player_high_id: men[2] ?? "",
					pair_key: `${men[1]}:${men[2]}`,
					male_win_rate: 0.47,
				},
				"male",
			),
		).toBe(0.47);
	});

	it("caps PD blend when correlation is high and allows it when correlation is low", () => {
		const highCorrelationBlend = blendWinProbabilitySignals({
			baseWinRate: 0.55,
			pdWinProbability: 0.85,
			reliability: 1,
			signalCorrelation: 0.96,
		});
		const lowCorrelationBlend = blendWinProbabilitySignals({
			baseWinRate: 0.55,
			pdWinProbability: 0.85,
			reliability: 1,
			signalCorrelation: 0.15,
		});

		expect(highCorrelationBlend).toBeLessThan(0.61);
		expect(lowCorrelationBlend).toBeGreaterThan(highCorrelationBlend);
	});

	it("builds valid 8-round schedule with league constraints", () => {
		const scores = recommendPairSets(
			{
				divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
				seasonYear: 2025,
				seasonNumber: 3,
				teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
				oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
				matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
				mode: "blind",
				availablePlayerIds: allPlayers,
				objective: "MAX_EXPECTED_WINS",
				maxRecommendations: 3,
				downsideQuantile: 0.2,
				scenarioLimit: 12,
			},
			baseBundle,
		);

		const recommendations = toRecommendations(scores, 1);
		const top = recommendations[0];
		expect(top).toBeTruthy();
		expect(top?.rounds).toHaveLength(8);
		expect(top?.matchupWinProbability).toBeGreaterThanOrEqual(0);
		expect(top?.matchupWinProbability).toBeLessThanOrEqual(1);
		expect(top?.gameConfidence).toMatch(/LOW|MEDIUM|HIGH/);
		expect(top?.matchupConfidence).toMatch(/LOW|MEDIUM|HIGH/);

		const allGames = top?.rounds.flatMap((round) => round.games) ?? [];
		expect(allGames).toHaveLength(32);

		for (const round of top?.rounds ?? []) {
			expect(round.games).toHaveLength(4);
			const playersInRound = new Set<string>();
			for (const game of round.games) {
				const keyA = game.playerAId;
				const keyB = game.playerBId;
				expect(playersInRound.has(keyA)).toBe(false);
				expect(playersInRound.has(keyB)).toBe(false);
				playersInRound.add(keyA);
				playersInRound.add(keyB);
			}
		}

		const playerGames = new Map<string, number>();
		const pairUsage = new Map<string, number>();
		for (const game of allGames) {
			playerGames.set(
				game.playerAId,
				(playerGames.get(game.playerAId) ?? 0) + 1,
			);
			playerGames.set(
				game.playerBId,
				(playerGames.get(game.playerBId) ?? 0) + 1,
			);
			const pairKey = [game.playerAId, game.playerBId].sort().join(":");
			pairUsage.set(pairKey, (pairUsage.get(pairKey) ?? 0) + 1);
		}

		for (const count of playerGames.values()) {
			expect(count).toBeLessThanOrEqual(8);
		}
		for (const count of pairUsage.values()) {
			expect(count).toBeLessThanOrEqual(2);
		}

		for (const round of top?.rounds ?? []) {
			const roundNo = round.roundNumber;
			if (roundNo % 2 === 1) {
				expect(round.games.every((game) => game.matchType === "mixed")).toBe(
					true,
				);
			} else {
				const femaleCount = round.games.filter(
					(game) => game.matchType === "female",
				).length;
				const maleCount = round.games.filter(
					(game) => game.matchType === "male",
				).length;
				expect(femaleCount).toBe(2);
				expect(maleCount).toBe(2);
			}
		}
	});

	it("ranks by expected wins for MAX_EXPECTED_WINS and by floor for MINIMIZE_DOWNSIDE", () => {
		const boostedBundle: LineupLabFeatureBundle = {
			...baseBundle,
			pair_matchups: [
				{
					match_type: "mixed",
					our_pair_low_id: men[0] ?? "",
					our_pair_high_id: women[0] ?? "",
					opp_pair_low_id: men[0] ?? "",
					opp_pair_high_id: women[0] ?? "",
					win_rate_shrunk: 0.9,
					sample_reliability: 1,
				},
			],
		};

		const maxScores = recommendPairSets(
			{
				divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
				seasonYear: 2025,
				seasonNumber: 3,
				teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
				oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
				matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
				mode: "blind",
				availablePlayerIds: allPlayers,
				objective: "MAX_EXPECTED_WINS",
				maxRecommendations: 2,
				downsideQuantile: 0.2,
				scenarioLimit: 12,
			},
			boostedBundle,
		);
		const safeScores = recommendPairSets(
			{
				divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
				seasonYear: 2025,
				seasonNumber: 3,
				teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
				oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
				matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
				mode: "blind",
				availablePlayerIds: allPlayers,
				objective: "MINIMIZE_DOWNSIDE",
				maxRecommendations: 2,
				downsideQuantile: 0.2,
				scenarioLimit: 12,
			},
			boostedBundle,
		);

		expect(maxScores[0]).toBeTruthy();
		expect(safeScores[0]).toBeTruthy();
		expect(
			(maxScores[0]?.expectedWins ?? 0) >= (maxScores[1]?.expectedWins ?? 0),
		).toBe(true);
		expect(
			(safeScores[0]?.floorWinsQ20 ?? 0) >= (safeScores[1]?.floorWinsQ20 ?? 0),
		).toBe(true);
	});

	it("builds deterministic known-opponent schedules", () => {
		const first = recommendPairSetsKnownOpponent(
			knownOpponentRequest,
			baseBundle,
		);
		const second = recommendPairSetsKnownOpponent(
			knownOpponentRequest,
			baseBundle,
		);

		expect(first).toHaveLength(1);
		expect(second).toHaveLength(1);
		expect(first[0]?.pairSetId).toBe(second[0]?.pairSetId);
		expect(first[0]?.rounds).toHaveLength(8);
	});

	it("activates DUPR only with full four-player coverage", () => {
		const withDupr = recommendPairSetsKnownOpponent(
			knownOpponentRequest,
			baseBundle,
		);
		const duprAppliedGame = withDupr[0]?.rounds[0]?.games[0];
		expect(duprAppliedGame?.duprApplied).toBe(true);
		expect(duprAppliedGame?.duprCoverageCount).toBe(4);
		expect(duprAppliedGame?.duprWeightApplied).toBe(0.65);

		const missingCoverageBundle: LineupLabFeatureBundle = {
			...baseBundle,
			players_catalog:
				baseBundle.players_catalog?.map((player) =>
					player.player_id === (women[1] ?? "")
						? { ...player, dupr_rating: null }
						: player,
				) ?? [],
		};
		const withoutDupr = recommendPairSetsKnownOpponent(
			knownOpponentRequest,
			missingCoverageBundle,
		);
		const noDuprGame = withoutDupr[0]?.rounds[0]?.games[0];
		expect(noDuprGame?.duprApplied).toBe(false);
		expect(noDuprGame?.duprWeightApplied).toBe(0);
		expect((noDuprGame?.duprCoverageCount ?? 4) < 4).toBe(true);
	});

	it("applies team strength adjustment and enforces cap", () => {
		const neutralBundle: LineupLabFeatureBundle = {
			...baseBundle,
			team_strength: null,
		};
		const neutral = recommendPairSetsKnownOpponent(
			knownOpponentRequest,
			neutralBundle,
			{
				enableDuprBlend: false,
				duprMajorWeight: 0.65,
				enableTeamStrengthAdjustment: true,
				duprSlope: 1.6,
				teamStrengthFactor: 0.45,
				teamStrengthCap: 0.35,
			},
		);
		const boosted = recommendPairSetsKnownOpponent(
			knownOpponentRequest,
			baseBundle,
			{
				enableDuprBlend: false,
				duprMajorWeight: 0.65,
				enableTeamStrengthAdjustment: true,
				duprSlope: 1.6,
				teamStrengthFactor: 4,
				teamStrengthCap: 0.1,
			},
		);

		const neutralWin = neutral[0]?.rounds[0]?.games[0]?.winProbability ?? 0;
		const boostedWin = boosted[0]?.rounds[0]?.games[0]?.winProbability ?? 0;
		expect(boostedWin).toBeGreaterThanOrEqual(neutralWin);
		expect(
			Math.abs((boostedWin || 0.5) - (neutralWin || 0.5)),
		).toBeLessThanOrEqual(0.12);
	});

	it("returns recommendation and per-game diagnostics", () => {
		const scores = recommendPairSetsKnownOpponent(
			knownOpponentRequest,
			baseBundle,
		);
		const recommendations = toRecommendations(scores, 1);
		const top = recommendations[0];
		expect(top?.duprApplied).toBeTypeOf("boolean");
		expect(top?.duprCoverageCount).toBeGreaterThanOrEqual(0);
		expect(top?.duprCoverageCount).toBeLessThanOrEqual(4);
		expect(
			top?.duprWeightApplied === 0 || top?.duprWeightApplied === 0.65,
		).toBe(true);
		expect(top?.teamStrengthApplied).toBeTypeOf("boolean");

		const game = top?.rounds?.[0]?.games?.[0];
		expect(game?.duprApplied).toBeTypeOf("boolean");
		expect(game?.duprCoverageCount).toBeGreaterThanOrEqual(0);
		expect(game?.duprCoverageCount).toBeLessThanOrEqual(4);
		expect(
			game?.duprWeightApplied === 0 || game?.duprWeightApplied === 0.65,
		).toBe(true);
		expect(game?.teamStrengthApplied).toBeTypeOf("boolean");
	});
});
