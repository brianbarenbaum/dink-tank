import type { WorkerEnv } from "./env";
import { executeReadOnlySqlRows } from "./sql/sqlExecutor";
import type { ScopeParseResult, ScopedMetadata } from "./types";

const DIVISION_RE = /\b\d\.(?:0|5)\b/g;
const SEASON_YEAR_RE = /\b(20\d{2})\b/;
const POD_KEYWORDS = [
	"northwest",
	"northeast",
	"southwest",
	"southeast",
	"north",
	"south",
	"east",
	"west",
	"central",
] as const;
const TEAM_INTENT_RE =
	/\b(team|teams|schedule|opponent|opponents|match results?|club|lineup)\b/i;
const SCOPED_METADATA_CACHE_TTL_MS = 60_000;
const scopedMetadataCache = new Map<
	string,
	{ value: ScopedMetadata | null; expiresAtMs: number }
>();

const normalizeToken = (value: string): string =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "")
		.trim();

const titleCase = (value: string): string =>
	value.length === 0
		? value
		: `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}`;

const toPodLabel = (normalized: string): string => {
	if (normalized.endsWith("west") || normalized.endsWith("east")) {
		const prefix = normalized.startsWith("north")
			? "North"
			: normalized.startsWith("south")
				? "South"
				: "";
		const suffix = normalized.endsWith("west") ? "west" : "east";
		if (prefix) {
			return `${prefix}${suffix}`;
		}
	}
	return titleCase(normalized);
};

export const parseScopeTerms = (question: string): ScopeParseResult => {
	const lower = question.toLowerCase();
	const divisionMatches = [...lower.matchAll(DIVISION_RE)].map(
		(match) => match[0],
	);
	const inferredDivisionTerms = [...new Set(divisionMatches)];

	const tokens = lower.split(/\s+/).map(normalizeToken).filter(Boolean);
	const inferredPodTerms = [
		...new Set(
			tokens.filter((token) =>
				POD_KEYWORDS.includes(token as (typeof POD_KEYWORDS)[number]),
			),
		),
	];

	const seasonYearMatch = question.match(SEASON_YEAR_RE);
	const inferredSeasonYear = seasonYearMatch
		? Number.parseInt(seasonYearMatch[1], 10)
		: undefined;

	return {
		inferredDivisionTerms,
		inferredPodTerms,
		inferredSeasonYear,
		teamIntent: TEAM_INTENT_RE.test(question),
	};
};

export const formatScopedMetadataBlock = (
	metadata: ScopedMetadata | null,
): string => {
	if (!metadata) {
		return "";
	}

	const lines: string[] = [];
	lines.push(`Season scope: ${metadata.seasonLabel}`);

	if (metadata.divisions.length > 0) {
		lines.push(`Recognized divisions: ${metadata.divisions.join(", ")}`);
	}

	const podEntries = Object.entries(metadata.podsByDivision)
		.filter(([, pods]) => pods.length > 0)
		.sort(([a], [b]) => a.localeCompare(b));
	if (podEntries.length > 0) {
		const serializedPods = podEntries
			.map(([division, pods]) => `${division}: ${pods.join(", ")}`)
			.join(" | ");
		lines.push(`Recognized pods: ${serializedPods}`);
	}

	if (metadata.includeTeams) {
		const teamEntries = Object.entries(metadata.teamsByDivision ?? {})
			.filter(([, teams]) => teams.length > 0)
			.sort(([a], [b]) => a.localeCompare(b));
		if (teamEntries.length > 0) {
			const serializedTeams = teamEntries
				.map(([division, teams]) => `${division}: ${teams.join(", ")}`)
				.join(" | ");
			lines.push(`Recognized teams: ${serializedTeams}`);
		}
	}

	if (lines.length === 0) {
		return "";
	}

	lines.push(
		"Interpretation rule: if a recognized term matches a division/pod/team label, treat it as that scope unless user overrides.",
	);

	return lines.join("\n");
};

export const formatPodLabels = (pods: string[]): string[] => [
	...new Set(
		pods.map((pod) => toPodLabel(normalizeToken(pod))).filter(Boolean),
	),
];

const quoteSqlLiteral = (value: string): string =>
	`'${value.replaceAll("'", "''")}'`;

const buildDivisionWhereClause = (divisionTerms: string[]): string =>
	divisionTerms.length === 0
		? ""
		: ` and division_name in (${divisionTerms.map(quoteSqlLiteral).join(", ")})`;

const buildSeasonWhereClause = (seasonYear?: number): string =>
	typeof seasonYear === "number"
		? `season_year = ${seasonYear}`
		: "is_current_season = true";

const buildScopedMetadataCacheKey = (input: {
	seasonWhere: string;
	divisionTerms: string[];
	teamIntent: boolean;
	podTerms: string[];
}): string =>
	JSON.stringify({
		seasonWhere: input.seasonWhere,
		divisionTerms: [...input.divisionTerms].sort((a, b) => a.localeCompare(b)),
		teamIntent: input.teamIntent,
		podTerms: [...input.podTerms].sort((a, b) => a.localeCompare(b)),
	});

export const __resetScopedMetadataCacheForTests = (): void => {
	scopedMetadataCache.clear();
};

/**
 * Resolves a compact, season-scoped dictionary of divisions/pods and optional teams.
 */
export const resolveScopedMetadata = async (
	env: WorkerEnv,
	question: string,
): Promise<ScopedMetadata | null> => {
	const parsed = parseScopeTerms(question);
	const hasScopeCue =
		parsed.inferredDivisionTerms.length > 0 ||
		parsed.inferredPodTerms.length > 0 ||
		parsed.teamIntent;
	if (!hasScopeCue) {
		return null;
	}

	const seasonWhere = buildSeasonWhereClause(parsed.inferredSeasonYear);
	const divisionFilter = buildDivisionWhereClause(parsed.inferredDivisionTerms);
	const cacheKey = buildScopedMetadataCacheKey({
		seasonWhere,
		divisionTerms: parsed.inferredDivisionTerms,
		teamIntent: parsed.teamIntent,
		podTerms: parsed.inferredPodTerms,
	});
	const cached = scopedMetadataCache.get(cacheKey);
	if (cached && cached.expiresAtMs > Date.now()) {
		return cached.value;
	}
	const divisionPodRows = await executeReadOnlySqlRows(
		env,
		`select distinct division_name, pod_name
from public.vw_team_standings
where ${seasonWhere}${divisionFilter}
order by division_name asc, pod_name asc
limit 200`,
	);

	const divisions = [
		...new Set(
			divisionPodRows
				.map((row) => row.division_name)
				.filter(
					(value): value is string =>
						typeof value === "string" && value.length > 0,
				),
		),
	].sort((a, b) => a.localeCompare(b));

	const podsByDivision = divisions.reduce<Record<string, string[]>>(
		(accumulator, division) => {
			const pods = divisionPodRows
				.filter((row) => row.division_name === division)
				.map((row) =>
					typeof row.pod_name === "string" ? row.pod_name : row.pod,
				)
				.filter(
					(value): value is string =>
						typeof value === "string" && value.length > 0,
				);
			accumulator[division] = formatPodLabels(pods);
			return accumulator;
		},
		{},
	);

	let teamsByDivision: Record<string, string[]> | undefined;
	if (parsed.teamIntent) {
		const teamRows = await executeReadOnlySqlRows(
			env,
			`select distinct division_name, team_name
from public.vw_team_standings
where ${seasonWhere}${divisionFilter}
order by division_name asc, team_name asc
limit 300`,
		);

		teamsByDivision = [
			...new Set(
				teamRows
					.map((row) => row.division_name)
					.filter(
						(value): value is string =>
							typeof value === "string" && value.length > 0,
					),
			),
		]
			.sort((a, b) => a.localeCompare(b))
			.reduce<Record<string, string[]>>((accumulator, division) => {
				const teams = [
					...new Set(
						teamRows
							.filter((row) => row.division_name === division)
							.map((row) => row.team_name)
							.filter(
								(value): value is string =>
									typeof value === "string" && value.length > 0,
							),
					),
				].sort((a, b) => a.localeCompare(b));
				accumulator[division] = teams;
				return accumulator;
			}, {});
	}

	const hasPods = Object.values(podsByDivision).some((pods) => pods.length > 0);
	const hasTeams = Boolean(
		teamsByDivision &&
			Object.values(teamsByDivision).some((teams) => teams.length > 0),
	);
	if (divisions.length === 0 && !hasPods && !hasTeams) {
		scopedMetadataCache.set(cacheKey, {
			value: null,
			expiresAtMs: Date.now() + SCOPED_METADATA_CACHE_TTL_MS,
		});
		return null;
	}

	const scopedMetadata = {
		seasonLabel:
			typeof parsed.inferredSeasonYear === "number"
				? `${parsed.inferredSeasonYear}`
				: "current season",
		divisions,
		podsByDivision,
		teamsByDivision,
		includeTeams: parsed.teamIntent,
	};
	scopedMetadataCache.set(cacheKey, {
		value: scopedMetadata,
		expiresAtMs: Date.now() + SCOPED_METADATA_CACHE_TTL_MS,
	});
	return scopedMetadata;
};
