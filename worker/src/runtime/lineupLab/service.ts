import type { RequestContext } from "../requestContext";
import type { WorkerEnv } from "../env";
import { logWarn } from "../runtimeLogger";
import { fetchLineupLabFeatureBundle } from "./repository";
import {
	recommendPairSets,
	recommendPairSetsKnownOpponent,
	toRecommendations,
} from "./optimizer";
import type {
	LineupLabRecommendRequest,
	LineupLabRecommendResponse,
} from "./types";

const STALENESS_WARNING_HOURS = 24;

export const runLineupLabRecommend = async (
	env: WorkerEnv,
	request: LineupLabRecommendRequest,
	context: RequestContext,
): Promise<LineupLabRecommendResponse> => {
	const bundle = await fetchLineupLabFeatureBundle(env, request);
	const pairSetScores =
		request.mode === "known_opponent"
			? recommendPairSetsKnownOpponent(request, bundle)
			: recommendPairSets(request, bundle);
	const recommendations = toRecommendations(
		pairSetScores,
		request.maxRecommendations,
	);
	const playerDirectory = Object.fromEntries(
		(bundle.players_catalog ?? [])
			.filter((player) => typeof player?.player_id === "string")
			.map((player) => {
				const firstName = player.first_name?.trim() ?? "";
				const lastName = player.last_name?.trim() ?? "";
				const label = `${firstName} ${lastName}`.trim() || player.player_id;
				return [player.player_id, label];
			}),
	);
	const bundleGeneratedAt = bundle.generated_at ?? new Date().toISOString();
	const dataStalenessHours =
		typeof bundle.data_staleness_hours === "number"
			? bundle.data_staleness_hours
			: null;
	const stalenessWarning =
		typeof dataStalenessHours === "number" &&
		dataStalenessHours > STALENESS_WARNING_HOURS
			? `Lineup analytics data is stale (${dataStalenessHours.toFixed(1)} hours old).`
			: undefined;
	if (stalenessWarning) {
		logWarn("lineup_lab_stale_analytics_bundle", context, {
			dataStalenessHours,
			maxLastSeenAt: bundle.max_last_seen_at ?? null,
		});
	}

	return {
		requestId: context.requestId,
		generatedAt: new Date().toISOString(),
		objective: request.objective,
		recommendations,
		scenarioSummary: {
			scenarioCount: bundle.opponent_scenarios.length,
		},
		bundleMetadata: {
			generatedAt: bundleGeneratedAt,
			maxLastSeenAt: bundle.max_last_seen_at ?? null,
			dataStalenessHours,
			warning: stalenessWarning,
		},
		playerDirectory,
	};
};
