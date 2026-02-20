import type { NormalizedEvalItem } from "./evalResults";

export type AttributionLayer = "prompt" | "schema" | "topology" | "data";

export type ProposedFixType =
	| "system_prompt"
	| "few_shot"
	| "catalog"
	| "view_metadata"
	| "graph_node"
	| "edge"
	| "retry_policy"
	| "state_field"
	| "data_quality";

export interface FailureAttribution {
	primary_layer: AttributionLayer;
	secondary_layer: AttributionLayer | null;
	confidence: number;
	symptoms: string[];
	evidence: string[];
	proposed_fix_type: ProposedFixType;
	proposed_fix: string;
	risk: "low" | "medium" | "high";
}

export interface AttributionSummary {
	primaryLayerCounts: Record<AttributionLayer, number>;
	secondaryLayerCounts: Record<AttributionLayer, number>;
}

const truncate = (value: string): string =>
	value.length > 220 ? `${value.slice(0, 220)}...` : value;

const lower = (value: string): string => value.toLowerCase();

export const attributeFailure = (
	item: NormalizedEvalItem,
): FailureAttribution => {
	const comment = lower(item.judgeComment);
	const output = lower(item.output);
	const question = lower(item.input);
	const evidence = [truncate(item.input), truncate(item.output), truncate(item.judgeComment)];

	const schemaSignals = [
		/sql error|syntax error|column .* does not exist|relation .* does not exist|invalid input syntax|operator does not exist/,
		/wrong table|wrong join|invalid primary key|key does not exist/,
	];
	const topologySignals = [
		/gave up|stuck|loop|retry|did not retry|fallback/,
		/validator|should have caught|node/,
	];
	const dataSignals = [
		/no rows|no data|missing data|stale|incomplete|snapshot/,
		/data quality|ingestion/,
	];
	const promptSignals = [
		/does not answer|did not answer|asked a clarifying question|misinterpret|hallucinat|ignored constraint/,
		/ambiguous/,
	];

	const hasSchemaSignal = schemaSignals.some(
		(pattern) => pattern.test(comment) || pattern.test(output),
	);
	if (hasSchemaSignal) {
		return {
			primary_layer: "schema",
			secondary_layer: "prompt",
			confidence: 0.88,
			symptoms: [
				"Query/tool semantic mismatch",
				"Schema-level signal found in judge commentary",
			],
			evidence,
			proposed_fix_type: "view_metadata",
			proposed_fix:
				"Update catalog/view metadata and column mapping hints for SQL generation.",
			risk: "medium",
		};
	}

	const hasTopologySignal = topologySignals.some(
		(pattern) => pattern.test(comment) || pattern.test(output),
	);
	if (hasTopologySignal) {
		return {
			primary_layer: "topology",
			secondary_layer: "prompt",
			confidence: 0.8,
			symptoms: [
				"Control-flow/retry behavior issue detected",
				"Graph-level signal found in failure text",
			],
			evidence,
			proposed_fix_type: "retry_policy",
			proposed_fix:
				"Adjust graph retry/conditional edges or add validator node before final answer.",
			risk: "high",
		};
	}

	const hasDataSignal = dataSignals.some(
		(pattern) =>
			pattern.test(comment) || pattern.test(output) || pattern.test(question),
	);
	if (hasDataSignal) {
		return {
			primary_layer: "data",
			secondary_layer: "schema",
			confidence: 0.72,
			symptoms: [
				"Potential source data gap or stale snapshot",
				"Data completeness signal found",
			],
			evidence,
			proposed_fix_type: "data_quality",
			proposed_fix:
				"Validate ingestion freshness and view coverage for requested entities/time ranges.",
			risk: "medium",
		};
	}

	const hasPromptSignal = promptSignals.some(
		(pattern) =>
			pattern.test(comment) || pattern.test(output) || pattern.test(question),
	);
	return {
		primary_layer: "prompt",
		secondary_layer: hasPromptSignal ? "topology" : null,
		confidence: hasPromptSignal ? 0.78 : 0.64,
		symptoms: [
			"Instruction/interpretation mismatch",
			"Agent response did not align with expected output",
		],
		evidence,
		proposed_fix_type: "system_prompt",
		proposed_fix:
			"Tighten SQL/answer prompt instructions and few-shot examples for this failure pattern.",
		risk: "low",
	};
};

export const summarizeAttribution = (
	attributions: FailureAttribution[],
): AttributionSummary => {
	const primaryLayerCounts: Record<AttributionLayer, number> = {
		prompt: 0,
		schema: 0,
		topology: 0,
		data: 0,
	};
	const secondaryLayerCounts: Record<AttributionLayer, number> = {
		prompt: 0,
		schema: 0,
		topology: 0,
		data: 0,
	};
	for (const attribution of attributions) {
		primaryLayerCounts[attribution.primary_layer] += 1;
		if (attribution.secondary_layer) {
			secondaryLayerCounts[attribution.secondary_layer] += 1;
		}
	}
	return { primaryLayerCounts, secondaryLayerCounts };
};

