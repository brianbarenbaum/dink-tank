import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { PlannedFix } from "./fixPlanner";

export interface ApplyFixesResult {
	appliedCount: number;
	updatedFile: string;
	addedRules: number;
}

const HINTS_FILE = resolve(process.cwd(), "worker/eval/config/optimizationHints.ts");
const RUNTIME_TUNING_FILE = resolve(
	process.cwd(),
	"worker/eval/config/runtimeTuning.ts",
);

const extractArray = (source: string, key: string): string[] => {
	const blockMatch = source.match(new RegExp(`${key}:\\s*\\[(.*?)\\],`, "s"));
	if (!blockMatch) {
		return [];
	}
	const values: string[] = [];
	for (const match of blockMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
		values.push(match[1].replaceAll('\\"', '"').replaceAll("\\\\", "\\"));
	}
	return values;
};

const unique = (values: string[]): string[] => [...new Set(values)];

const toQuotedLines = (values: string[]): string =>
	values
		.map((value) => `\t\t"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}",`)
		.join("\n");

const buildHintsSource = (params: {
	sqlGenerationRules: string[];
	sqlEditRules: string[];
	answerRules: string[];
}): string => `export interface OptimizationHints {
	sqlGenerationRules: string[];
	sqlEditRules: string[];
	answerRules: string[];
}

export const OPTIMIZATION_HINTS: OptimizationHints = {
	sqlGenerationRules: [
${toQuotedLines(params.sqlGenerationRules)}
	],
	sqlEditRules: [
${toQuotedLines(params.sqlEditRules)}
	],
	answerRules: [
${toQuotedLines(params.answerRules)}
	],
};
`;

export const applyPlannedFixes = async (params: {
	plannedFixes: PlannedFix[];
	maxPatchesPerLoop: number;
	autoApply: boolean;
}): Promise<ApplyFixesResult> => {
	const source = await readFile(HINTS_FILE, "utf8");
	const currentSqlRules = extractArray(source, "sqlGenerationRules");
	const currentSqlEditRules = extractArray(source, "sqlEditRules");
	const currentAnswerRules = extractArray(source, "answerRules");

	const selectedFixes = params.plannedFixes.slice(0, params.maxPatchesPerLoop);
	const nextSqlRules = [...currentSqlRules];
	const nextSqlEditRules = [...currentSqlEditRules];
	const nextAnswerRules = [...currentAnswerRules];

	for (const fix of selectedFixes) {
		for (const rule of fix.rules) {
			if (/follow-up|follow up|prior|scope|sql/i.test(rule)) {
				nextSqlEditRules.push(rule);
				continue;
			}
			if (/clarification|ask|question|style|answer/i.test(rule)) {
				nextAnswerRules.push(rule);
				continue;
			}
			nextSqlRules.push(rule);
		}
	}

	const mergedSql = unique(nextSqlRules);
	const mergedSqlEdit = unique(nextSqlEditRules);
	const mergedAnswer = unique(nextAnswerRules);
	const addedRules =
		mergedSql.length -
		currentSqlRules.length +
		(mergedSqlEdit.length - currentSqlEditRules.length) +
		(mergedAnswer.length - currentAnswerRules.length);

	let runtimeUpdated = false;
	const needsNoRepeatGuard = selectedFixes.some(
		(fix) => fix.id === "no-repeat-clarification-guard",
	);
	if (params.autoApply && needsNoRepeatGuard) {
		const runtimeSource = await readFile(RUNTIME_TUNING_FILE, "utf8");
		let updatedRuntime = runtimeSource;
		updatedRuntime = updatedRuntime.replace(
			/allowLowConfidenceSqlForFactoidQuestions:\s*(true|false)/,
			"allowLowConfidenceSqlForFactoidQuestions: true",
		);
		updatedRuntime = updatedRuntime.replace(
			/skipWonLostClarificationOnFactoidQuestions:\s*(true|false)/,
			"skipWonLostClarificationOnFactoidQuestions: true",
		);
		if (updatedRuntime !== runtimeSource) {
			await writeFile(RUNTIME_TUNING_FILE, updatedRuntime, "utf8");
			runtimeUpdated = true;
		}
	}

	if (params.autoApply && addedRules > 0) {
		const nextSource = buildHintsSource({
			sqlGenerationRules: mergedSql,
			sqlEditRules: mergedSqlEdit,
			answerRules: mergedAnswer,
		});
		await writeFile(HINTS_FILE, nextSource, "utf8");
	}

	return {
		appliedCount: params.autoApply ? selectedFixes.length : 0,
		updatedFile: runtimeUpdated
			? "worker/eval/config/runtimeTuning.ts,worker/eval/config/optimizationHints.ts"
			: "worker/eval/config/optimizationHints.ts",
		addedRules: params.autoApply ? Math.max(0, addedRules) : 0,
	};
};
