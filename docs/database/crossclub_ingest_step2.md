# CrossClub Step 2: Chunked Ingestion Runner

## What was added
- `src/lib/crossclub-ingest.ts`: ingestion engine (chunked, resumable, raw + normalized writes).
- `scripts/ingest-crossclub.ts`: CLI entrypoint.
- `tests/crossclub-ingest.test.ts`: coverage for checkpoint keys, chunking, endpoint plans, payload denormalization.
- `supabase/migrations/20260214185500_enable_crossclub_rls.sql`: RLS enablement + public read policies.

## Commands
- Initial bootstrap (all core endpoints):
  - `npm run ingest:crossclub`
- Weekly sync (lighter endpoint set):
  - `npm run ingest:crossclub:weekly`
- Piecewise bootstrap (initial load in chunks):
  - `npm run ingest:crossclub:players`
  - `npm run ingest:crossclub:standings`
  - `npm run ingest:crossclub:teams`
  - `npm run ingest:crossclub:matchups`
  - `npm run ingest:crossclub:playoffs`
  - `npm run ingest:crossclub:details`
- Weekly matchup-detail refresh:
  - `npm run ingest:crossclub:details:weekly`
- Strict dependency guard variants (warn if base phases are missing):
  - `npm run ingest:crossclub:details:strict`
  - `npm run ingest:crossclub:details:weekly:strict`
- Dry run (no Supabase writes):
  - `npm run ingest:crossclub:dry-run`

## Required env vars
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CROSSCLUB_WEEKLY_WINDOW_DAYS` (defaults to `120`; used by weekly detail sync)
- `CROSSCLUB_RETRY_ATTEMPTS` (defaults to `3`)
- `CROSSCLUB_RETRY_BASE_DELAY_MS` (defaults to `500`)
- `CROSSCLUB_RETRY_JITTER_RATIO` (defaults to `0.2`)

## Recommendation coverage
1. Hybrid model: implemented.
   - Raw payload capture in `api_raw_ingest`.
   - Normalized upserts into core tables.
2. RLS hardening: implemented.
   - Migration created and applied to enable RLS and read policies.
3. Chunked/resumable ingestion: implemented.
   - Division chunking via `CROSSCLUB_CHUNK_SIZE`.
   - Rate limiting via `CROSSCLUB_DELAY_MS`.
   - Resume guards via `ingest_checkpoints`.
4. Cadence strategy: implemented in runner modes.
   - `bootstrap`: players/teams/standings/matchups/playoffs.
   - `weekly`: standings + matchup endpoints.
   - `weekly details`: only recent matchups in `CROSSCLUB_WEEKLY_WINDOW_DAYS`.

## Step 3 (now implemented)
- `details` phase calls `/divisions/{divisionId}/matchups/{matchupId}`.
- It writes:
  - `matchup_player_stats`
  - `lineups`
  - `lineup_slots`

## Reliability and guardrails
- Retry + backoff + jitter is enabled for API fetches.
- Each run prints a summary line:
  - mode, phase, dry-run status, rows, retries, warnings, rows by table.
- Strict dependency guard (warn-only):
  - checks checkpoints for `players`, `teams`, `matchups`, and `playoff-matchups` before `details`.

## Notes
- The runner uses Supabase REST with service-role auth for upserts.
- Snapshot-aware tables write with `snapshot_date = current UTC date`.
