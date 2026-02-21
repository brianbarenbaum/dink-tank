import type { RequestContext } from "../requestContext";
import type { WorkerEnv } from "../env";
import { fetchLineupLabFeatureBundle } from "./repository";
import {
	recommendPairSets,
	toRecommendations,
} from "./optimizer";
import type {
	LineupLabRecommendRequest,
	LineupLabRecommendResponse,
} from "./types";

export const runLineupLabRecommend = async (
	env: WorkerEnv,
	request: LineupLabRecommendRequest,
	context: RequestContext,
): Promise<LineupLabRecommendResponse> => {
	const bundle = await fetchLineupLabFeatureBundle(env, request);
	const pairSetScores = recommendPairSets(request, bundle);
	const recommendations = toRecommendations(
		pairSetScores,
		request.maxRecommendations,
	);

	return {
		requestId: context.requestId,
		generatedAt: new Date().toISOString(),
		objective: request.objective,
		recommendations,
		scenarioSummary: {
			scenarioCount: bundle.opponent_scenarios.length,
		},
	};
};
