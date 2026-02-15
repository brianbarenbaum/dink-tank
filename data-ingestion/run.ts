import {
	ingestCrossClub,
	type IngestPhase,
	type SyncMode,
} from "./pipeline.ts";

const VALID_PHASES: IngestPhase[] = [
	"all",
	"players",
	"standings",
	"teams",
	"matchups",
	"playoff-matchups",
	"details",
];

const requiredEnv = (name: string): string => {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
};

const readModeArg = (): SyncMode => {
	const value = process.argv[2]?.trim();
	return value === "weekly" ? "weekly" : "bootstrap";
};

const readPhaseArg = (): IngestPhase => {
	const value = process.argv[3]?.trim() as IngestPhase | undefined;
	if (!value || !VALID_PHASES.includes(value)) {
		return "all";
	}
	return value;
};

const readDryRunFlag = (): boolean => process.argv.includes("--dry-run");
const readStrictDependencyGuardFlag = (): boolean =>
	process.argv.includes("--strict-dependency-guard");
const hasHelpFlag = (): boolean =>
	process.argv.includes("--help") || process.argv.includes("-h");

const printHelp = (): void => {
	console.log(`CrossClub ingestion runner

Usage:
  node --experimental-strip-types data-ingestion/run.ts [bootstrap|weekly] [phase] [--dry-run] [--strict-dependency-guard]

Phases:
  all | players | standings | teams | matchups | playoff-matchups | details

Examples:
  npm run ingest:crossclub
  npm run ingest:crossclub:players
  npm run ingest:crossclub:details:strict
  npm run ingest:crossclub:dry-run
`);
};

const main = async (): Promise<void> => {
	if (hasHelpFlag()) {
		printHelp();
		return;
	}

	const mode = readModeArg();
	const phase = readPhaseArg();
	const dryRun = readDryRunFlag();
	const strictDependencyGuard = readStrictDependencyGuardFlag();

	await ingestCrossClub({
		mode,
		phase,
		dryRun,
		strictDependencyGuard,
		supabaseUrl: dryRun
			? process.env.SUPABASE_URL
			: requiredEnv("SUPABASE_URL"),
		supabaseServiceRoleKey: dryRun
			? process.env.SUPABASE_SERVICE_ROLE_KEY
			: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
		chunkSize: Number(process.env.CROSSCLUB_CHUNK_SIZE ?? 2),
		delayMs: Number(process.env.CROSSCLUB_DELAY_MS ?? 600),
		retryAttempts: Number(process.env.CROSSCLUB_RETRY_ATTEMPTS ?? 3),
		retryBaseDelayMs: Number(process.env.CROSSCLUB_RETRY_BASE_DELAY_MS ?? 500),
		retryJitterRatio: Number(process.env.CROSSCLUB_RETRY_JITTER_RATIO ?? 0.2),
		lat: process.env.CROSSCLUB_LAT ?? "40.2202",
		lng: process.env.CROSSCLUB_LNG ?? "-74.7642",
		weeklyWindowDays: Number(process.env.CROSSCLUB_WEEKLY_WINDOW_DAYS ?? 120),
		regionLocationFilter: process.env.CROSSCLUB_REGION_FILTER,
		divisionNameFilter: process.env.CROSSCLUB_DIVISION_FILTER,
	});
};

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : "unknown error";
	console.error(`[crossclub-ingest] ${message}`);
	process.exitCode = 1;
});
