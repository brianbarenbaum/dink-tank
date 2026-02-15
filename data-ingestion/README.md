# CrossClub Ingestion Runbook

This document explains how to run the CrossClub ingestion pipeline if you have never seen this project before.

## What this ingestion does
- Pulls data from CrossClub API endpoints.
- Stores raw API payloads in `api_raw_ingest` (for audit/debug).
- Upserts normalized records into core tables (`regions`, `divisions`, `players`, `teams`, `matchups`, etc.).
- Writes season-isolated membership snapshots:
  - `player_rosters`
  - `team_seasons`
- Tracks progress with:
  - `ingest_runs` (run status + summary metadata)
  - `ingest_checkpoints` (resume points, per division + phase)

## Season isolation model
- Each season is treated as its own data bubble using `season_year` + `season_number`.
- Use these tables for season-specific queries:
  - `team_standings`
  - `player_division_stats`
  - `player_rosters`
  - `team_seasons`
- Base entity tables (`players`, `teams`, `clubs`) remain canonical identity tables.

## Prerequisites
1. Install dependencies:
   - `npm install`
2. Configure env:
   - Copy `.env.example` to `.env` and set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Load env vars into your shell session before running scripts:
   - Option A (bash/zsh):
     - `set -a; source .env; set +a`
   - Option B (single command form):
     - `env $(grep -v '^#' .env | xargs) npm run ingest:crossclub:dry-run`
4. Ensure DB schema/migrations are already applied in Supabase.

## Local SQLite preflight (recommended before Supabase)
Run local validation first to catch FK/conflict issues without touching Supabase:

1. `npm run ingest:sqlite:init`
   - Creates local SQLite schema at `data-ingestion/sqlite/crossclub.db` (or `CROSSCLUB_SQLITE_PATH`).
2. `npm run ingest:sqlite:mock`
   - Loads mock fixture payloads from `data-ingestion/mock-data/`.
3. `npm run ingest:sqlite:verify`
   - Runs integrity checks (FKs, duplicate logical keys, missing season rows).
4. `npm run ingest:crossclub:dry-run`
   - Validates live API execution path with no Supabase writes.

Promote to real Supabase ingestion only after local SQLite verification passes.

## Ingestion modes and phases
- `bootstrap` mode:
  - Intended for initial load.
  - Pulls everything for selected phase.
- `weekly` mode:
  - Intended for recurring updates.
  - Uses checkpoints to skip already-processed division/phase for the same day.
  - `details` in weekly mode is limited to recent matchups via `CROSSCLUB_WEEKLY_WINDOW_DAYS`.

Phases:
- `players`
- `teams`
- `standings`
- `matchups`
- `playoff-matchups` (`ingest:crossclub:playoffs`)
- `details` (matchup-level detail endpoint `/matchups/{id}`)
- `all` (combined flow)

## Dry-run mode
Command:
- `npm run ingest:crossclub:dry-run`

What dry-run does:
- Calls CrossClub API endpoints.
- Executes planning/filtering/checkpoint logic paths in memory.
- Prints run summary.

What dry-run does not do:
- No writes to Supabase tables.
- No run/checkpoint rows persisted.

Use dry-run to validate connectivity and expected phase behavior before first real ingestion.

## First ingestion (recommended order)
Use piecewise ingestion so you can monitor progress incrementally:

1. `npm run ingest:crossclub:players`
   - Loads player entities + `player_division_stats`.
2. `npm run ingest:crossclub:teams`
   - Loads clubs + teams.
3. `npm run ingest:crossclub:standings`
   - Loads standings snapshots.
4. `npm run ingest:crossclub:matchups`
   - Loads regular-season matchup list.
5. `npm run ingest:crossclub:playoffs`
   - Loads playoff matchup list.
6. `npm run ingest:crossclub:details:strict`
   - Loads matchup detail endpoint per matchup ID.
   - Writes `matchup_player_stats`, `lineups`, `lineup_slots`.
   - `--strict-dependency-guard` warns if required earlier phases were not run.

Alternative one-shot bootstrap:
- `npm run ingest:crossclub`

## Weekly operation
Recommended weekly order (for complete season maintenance):

1. `npm run ingest:crossclub:players`
   - Refreshes player roster membership and season player stats.
   - This is the step that captures players added/removed from teams.
   - Updates: `players`, `player_division_stats`, `player_rosters` (and minimal `clubs`/`teams` from players payload).
2. `npm run ingest:crossclub:teams`
   - Refreshes team + club metadata and season team snapshots.
   - Updates: `clubs`, `teams`, `team_seasons`.
3. `npm run ingest:crossclub:weekly`
   - Weekly endpoint sweep for standings + regular/playoff matchups.
   - Updates: `team_standings`, `matchups`.
4. `npm run ingest:crossclub:details:weekly:strict`
   - Refreshes detail-level matchup/player/lineup data for recent matchups only.
   - Updates: `matchup_player_stats`, `lineups`, `lineup_slots`.
   - Uses `CROSSCLUB_WEEKLY_WINDOW_DAYS` to limit API volume.

If API load must be minimized, the lean weekly variant is:
1. `npm run ingest:crossclub:weekly`
2. `npm run ingest:crossclub:details:weekly:strict`

But with the lean variant, player adds/removals may not be fully reflected in `player_rosters` until you run `ingest:crossclub:players`.

## What each script does
- `npm run ingest:crossclub`
  - One-shot bootstrap (`bootstrap all`): players, standings, teams, matchups, playoff-matchups.
- `npm run ingest:crossclub:weekly`
  - One-shot weekly sweep (`weekly all`): standings + matchups + playoff-matchups only.
- `npm run ingest:crossclub:players`
  - Player and roster phase (`bootstrap players`): canonical players + season roster snapshots.
- `npm run ingest:crossclub:teams`
  - Team phase (`bootstrap teams`): club/team metadata + `team_seasons`.
- `npm run ingest:crossclub:standings`
  - Standings phase (`bootstrap standings`): writes `team_standings` snapshots.
- `npm run ingest:crossclub:matchups`
  - Matchup list phase (`bootstrap matchups`): regular season matchup rows.
- `npm run ingest:crossclub:playoffs`
  - Playoff matchup list phase (`bootstrap playoff-matchups`): playoff matchups.
- `npm run ingest:crossclub:details`
  - Details phase (`bootstrap details`): full detail fetch for selected divisions.
- `npm run ingest:crossclub:details:weekly`
  - Weekly details (`weekly details`): recent detail fetch only.
- `npm run ingest:crossclub:details:strict`
  - Bootstrap details with prerequisite warnings.
- `npm run ingest:crossclub:details:weekly:strict`
  - Weekly details with prerequisite warnings.
- `npm run ingest:crossclub:dry-run`
  - Executes live fetch path with no Supabase writes.

## Reliability controls
Configured via env vars:
- `CROSSCLUB_CHUNK_SIZE` (default `2`)
- `CROSSCLUB_DELAY_MS` (default `600`)
- `CROSSCLUB_RETRY_ATTEMPTS` (default `3`)
- `CROSSCLUB_RETRY_BASE_DELAY_MS` (default `500`)
- `CROSSCLUB_RETRY_JITTER_RATIO` (default `0.2`)
- `CROSSCLUB_WEEKLY_WINDOW_DAYS` (default `120`)
- `CROSSCLUB_REGION_FILTER` (optional, exact region label match)
- `CROSSCLUB_DIVISION_FILTER` (optional, exact division label match)

## Script list
- `npm run ingest:help`
- `npm run ingest:sqlite:init`
- `npm run ingest:sqlite:mock`
- `npm run ingest:sqlite:verify`
- `npm run ingest:crossclub`
- `npm run ingest:crossclub:weekly`
- `npm run ingest:crossclub:players`
- `npm run ingest:crossclub:standings`
- `npm run ingest:crossclub:teams`
- `npm run ingest:crossclub:matchups`
- `npm run ingest:crossclub:playoffs`
- `npm run ingest:crossclub:details`
- `npm run ingest:crossclub:details:weekly`
- `npm run ingest:crossclub:details:strict`
- `npm run ingest:crossclub:details:weekly:strict`
- `npm run ingest:crossclub:dry-run`

## Output and monitoring
Each run prints a summary line with:
- mode
- phase
- dry-run flag
- rows written
- retry count
- warning count
- rows written by table

## Region/division scoping
To load only NJ/PA 4.0, set:

```bash
CROSSCLUB_REGION_FILTER="NJ / PA"
CROSSCLUB_DIVISION_FILTER="4.0"
```

Then run the normal scripts. Only matching divisions will be processed.

For persisted runs, query `public.ingest_runs` and `public.ingest_checkpoints` in Supabase.

## Troubleshooting
- `Missing required env var`:
  - Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `fetch failed`:
  - Usually DNS/network issue. Re-run later or from a networked environment.
- Strict dependency warnings in details phase:
  - Run missing prerequisite phases (`players`, `teams`, `matchups`, `playoffs`) first.
