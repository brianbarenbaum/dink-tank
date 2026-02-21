import type { WorkerEnv } from "./env";
import { executeReadOnlySqlRows } from "./sql/sqlExecutor";

const DIVISION_RE = /\b\d\.(?:0|5)\b/;
const POD_RE = /\b(northwest|northeast|southwest|southeast)\b/i;

const extractDivision = (question: string): string | null =>
	question.match(DIVISION_RE)?.[0] ?? null;

const extractPod = (question: string): string | null => {
	const match = question.match(POD_RE);
	if (!match?.[1]) {
		return null;
	}
	const raw = match[1].toLowerCase();
	return `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
};

const toNumber = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number.parseFloat(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return null;
};

const answerBestWomenRecord = async (
	env: WorkerEnv,
	division: string,
	pod: string,
): Promise<string | null> => {
	const rows = await executeReadOnlySqlRows(
		env,
		`SELECT team_name, womens_record, women_wins, women_losses
FROM public.vw_team_standings
WHERE is_current_season = true
  AND division_name = '${division}'
  AND pod_name = '${pod}'
ORDER BY women_wins DESC, women_losses ASC, team_name ASC
LIMIT 1`,
	);
	const top = rows[0];
	if (!top || typeof top.team_name !== "string") {
		return null;
	}
	const record =
		typeof top.womens_record === "string" && top.womens_record.length > 0
			? top.womens_record
			: `${toNumber(top.women_wins) ?? 0}-${toNumber(top.women_losses) ?? 0}`;
	return `${top.team_name} has the best Women's record in the ${division} ${pod} pod (${record} record).

Metric type: match-level
Verified scope: ${division} division, ${pod} pod, current season`;
};

const answerMostCompetitivePod = async (
	env: WorkerEnv,
	division: string,
): Promise<string | null> => {
	const rows = await executeReadOnlySqlRows(
		env,
		`SELECT pod_name, AVG(average_point_differential::numeric) AS avg_point_diff
FROM public.vw_team_standings
WHERE is_current_season = true
  AND division_name = '${division}'
GROUP BY pod_name
ORDER BY ABS(AVG(average_point_differential::numeric)) ASC, pod_name ASC
LIMIT 1`,
	);
	const top = rows[0];
	if (!top || typeof top.pod_name !== "string") {
		return null;
	}
	const avg = toNumber(top.avg_point_diff);
	const avgLabel = avg === null ? "N/A" : avg.toFixed(2);
	return `${top.pod_name} is the most competitive pod in ${division} based on average point differential (closest to zero: ${avgLabel}).

Metric type: match-level
Verified scope: ${division} division, all pods, current season`;
};

const answerWorstAwayRecord = async (
	env: WorkerEnv,
	division: string,
): Promise<string | null> => {
	const rows = await executeReadOnlySqlRows(
		env,
		`SELECT team_name, away_record, away_wins, away_losses
FROM public.vw_team_standings
WHERE is_current_season = true
  AND division_name = '${division}'
ORDER BY away_win_rate::numeric ASC, away_losses DESC, away_wins ASC, team_name ASC
LIMIT 1`,
	);
	const top = rows[0];
	if (!top || typeof top.team_name !== "string") {
		return null;
	}
	const record =
		typeof top.away_record === "string" && top.away_record.length > 0
			? top.away_record
			: `${toNumber(top.away_wins) ?? 0}-${toNumber(top.away_losses) ?? 0}`;
	return `${top.team_name} has the worst away record in ${division} at ${record}.

Metric type: match-level
Verified scope: ${division} division, away record, current season`;
};

export const tryResolveFastPathAnswer = async (
	env: WorkerEnv,
	question: string,
): Promise<string | null> => {
	const trimmed = question.trim();
	if (!trimmed) {
		return null;
	}
	const lower = trimmed.toLowerCase();
	const division = extractDivision(trimmed) ?? "3.0";

	if (/\bbest\b.*\bwomen'?s\b.*\brecord\b/i.test(trimmed)) {
		const pod = extractPod(trimmed);
		if (!pod) {
			return null;
		}
		return answerBestWomenRecord(env, division, pod);
	}

	if (
		lower.includes("most competitive") &&
		lower.includes("point differential")
	) {
		return answerMostCompetitivePod(env, division);
	}

	if (lower.includes("worst") && lower.includes("away record")) {
		return answerWorstAwayRecord(env, division);
	}

	return null;
};
