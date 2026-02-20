export interface GraphRuntimeTuning {
	allowLowConfidenceSqlForFactoidQuestions: boolean;
	skipWonLostClarificationOnFactoidQuestions: boolean;
}

export const GRAPH_RUNTIME_TUNING: GraphRuntimeTuning = {
	allowLowConfidenceSqlForFactoidQuestions: true,
	skipWonLostClarificationOnFactoidQuestions: true,
};

