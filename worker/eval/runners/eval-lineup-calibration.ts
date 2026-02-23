import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { blendWinProbabilitySignals } from "../../src/runtime/lineupLab/optimizer.ts";

interface HoldoutRecord {
	week: number;
	matchType: "mixed" | "female" | "male";
	winRateShrunk: number;
	pdWinProbability: number;
	sampleReliability?: number;
	signalCorrelation?: number | null;
	actualWin: 0 | 1;
}

interface CalibrationMetrics {
	count: number;
	brier: number;
	logLoss: number;
}

const clamp = (value: number): number => {
	if (!Number.isFinite(value)) {
		return 0.5;
	}
	return Math.max(0.01, Math.min(0.99, value));
};

const computeMetrics = (rows: Array<{ probability: number; actualWin: 0 | 1 }>): CalibrationMetrics => {
	if (rows.length === 0) {
		return { count: 0, brier: 0, logLoss: 0 };
	}
	let brierTotal = 0;
	let logLossTotal = 0;
	for (const row of rows) {
		const probability = clamp(row.probability);
		const outcome = row.actualWin;
		const error = probability - outcome;
		brierTotal += error * error;
		logLossTotal += -(
			outcome * Math.log(probability) +
			(1 - outcome) * Math.log(1 - probability)
		);
	}
	return {
		count: rows.length,
		brier: Number((brierTotal / rows.length).toFixed(6)),
		logLoss: Number((logLossTotal / rows.length).toFixed(6)),
	};
};

const loadDataset = (): HoldoutRecord[] => {
	const datasetPath =
		process.env.LINEUP_HOLDOUT_DATASET?.trim() ||
		resolve(process.cwd(), "worker/eval/datasets/lineup_holdout_weekly.json");
	const raw = readFileSync(datasetPath, "utf8");
	const parsed = JSON.parse(raw) as unknown;
	if (!Array.isArray(parsed)) {
		throw new Error(`Dataset is not an array: ${datasetPath}`);
	}
	const rows: HoldoutRecord[] = [];
	for (const item of parsed) {
		if (!item || typeof item !== "object") {
			continue;
		}
		const record = item as Partial<HoldoutRecord>;
		if (
			typeof record.week !== "number" ||
			(record.matchType !== "mixed" &&
				record.matchType !== "female" &&
				record.matchType !== "male") ||
			typeof record.winRateShrunk !== "number" ||
			typeof record.pdWinProbability !== "number" ||
			(record.actualWin !== 0 && record.actualWin !== 1)
		) {
			continue;
		}
		rows.push({
			week: record.week,
			matchType: record.matchType,
			winRateShrunk: record.winRateShrunk,
			pdWinProbability: record.pdWinProbability,
			sampleReliability: record.sampleReliability,
			signalCorrelation:
				typeof record.signalCorrelation === "number"
					? record.signalCorrelation
					: null,
			actualWin: record.actualWin,
		});
	}
	return rows;
};

const summarize = (rows: HoldoutRecord[]) => {
	const baselineRows = rows.map((row) => ({
		probability: row.winRateShrunk,
		actualWin: row.actualWin,
	}));
	const blendedRows = rows.map((row) => ({
		probability: blendWinProbabilitySignals({
			baseWinRate: row.winRateShrunk,
			pdWinProbability: row.pdWinProbability,
			reliability:
				typeof row.sampleReliability === "number" ? row.sampleReliability : 0,
			signalCorrelation:
				typeof row.signalCorrelation === "number" ? row.signalCorrelation : null,
		}),
		actualWin: row.actualWin,
	}));

	const byType = (type: HoldoutRecord["matchType"]) => {
		const scoped = rows.filter((row) => row.matchType === type);
		return {
			baseline: computeMetrics(
				scoped.map((row) => ({
					probability: row.winRateShrunk,
					actualWin: row.actualWin,
				})),
			),
			blended: computeMetrics(
				scoped.map((row) => ({
					probability: blendWinProbabilitySignals({
						baseWinRate: row.winRateShrunk,
						pdWinProbability: row.pdWinProbability,
						reliability:
							typeof row.sampleReliability === "number"
								? row.sampleReliability
								: 0,
						signalCorrelation:
							typeof row.signalCorrelation === "number"
								? row.signalCorrelation
								: null,
					}),
					actualWin: row.actualWin,
				})),
			),
		};
	};

	const baseline = computeMetrics(baselineRows);
	const blended = computeMetrics(blendedRows);
	return {
		sampleSize: rows.length,
		baseline,
		blended,
		delta: {
			brier: Number((blended.brier - baseline.brier).toFixed(6)),
			logLoss: Number((blended.logLoss - baseline.logLoss).toFixed(6)),
		},
		byMatchType: {
			mixed: byType("mixed"),
			female: byType("female"),
			male: byType("male"),
		},
	};
};

const run = () => {
	const rows = loadDataset();
	if (rows.length === 0) {
		throw new Error("No valid rows found in holdout dataset.");
	}
	const report = summarize(rows);
	console.log(JSON.stringify(report, null, 2));
};

run();
