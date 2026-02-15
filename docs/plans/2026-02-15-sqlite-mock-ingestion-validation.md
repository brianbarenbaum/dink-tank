# SQLite Mock Ingestion Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local SQLite-based ingestion test harness that uses mock CrossClub JSON payloads to validate transforms, upserts, FK integrity, and incremental ingestion behavior before writing to Supabase.

**Architecture:** Keep `data-ingestion/pipeline.ts` as the transform source of truth, and add a SQLite sink + mock-data runner in `data-ingestion/`. Ingest mock endpoint payloads phase-by-phase (`players`, `teams`, `standings`, `matchups`, `playoffs`, `details`) into SQLite with the same season-scoped semantics used for Supabase.

**Tech Stack:** Node TypeScript, `better-sqlite3`, Vitest, JSON fixtures in `data-ingestion/mock-data/`

---

## Recommendation (4)

1. Use SQLite as a strict preflight gate before Supabase runs.
2. Keep transformation logic centralized in `data-ingestion/pipeline.ts`; do not duplicate mapping logic.
3. Validate both `bootstrap` and `weekly` behavior against fixtures.
4. Add deterministic fixture subsets for NJ/PA + 4.0 and add FK/uniqueness assertions in tests.

---

### Task 1: Add SQLite dependencies and scripts (The sqlite library is already installed locally)

**Files:**
- Modify: `tsconfig.json` (only if additional include paths needed)

**Step 1: Write the failing test (script existence check)**
- Add an assertion in `tests/crossclub-ingest.test.ts` that expects new CLI scripts in `package.json`:
  - `ingest:sqlite:init`
  - `ingest:sqlite:mock`
  - `ingest:sqlite:verify`

**Step 2: Run test to verify it fails**
Run: `npm run test -- tests/crossclub-ingest.test.ts`
Expected: FAIL because scripts do not exist yet.

**Step 3: Add minimal implementation**
- Add scripts:
  - `ingest:sqlite:init`: create local db + schema
  - `ingest:sqlite:mock`: run mock ingestion for selected phase(s)
  - `ingest:sqlite:verify`: run post-load integrity checks

**Step 4: Run test to verify it passes**
Run: `npm run test -- tests/crossclub-ingest.test.ts`
Expected: PASS for script existence check.

**Step 5: Commit**
```bash
git add package.json package-lock.json tests/crossclub-ingest.test.ts
git commit -m "build: add sqlite ingestion scripts and dependency"
```

---

### Task 2: Create mock data contract and fixture set

**Files:**
- Create: `data-ingestion/mock-data/README.md`
- Create: `data-ingestion/mock-data/regions.json`
- Create: `data-ingestion/mock-data/players.json`
- Create: `data-ingestion/mock-data/teams.json`
- Create: `data-ingestion/mock-data/standings.json`
- Create: `data-ingestion/mock-data/matchups.json`
- Create: `data-ingestion/mock-data/playoff-matchups.json`
- Create: `data-ingestion/mock-data/matchup-details.json`

**Step 1: Write the failing test**
- Add a fixture-shape test file:
  - `tests/crossclub-sqlite-fixtures.test.ts`
- Test should verify:
  - required fixture files exist
  - each file parses as JSON
  - key fields exist (`divisionId`, `seasonYear`, `seasonNumber`, etc.)

**Step 2: Run test to verify it fails**
Run: `npm run test -- tests/crossclub-sqlite-fixtures.test.ts`
Expected: FAIL because fixtures do not exist.

**Step 3: Add minimal implementation**
- Add small but realistic payloads (2-3 divisions, including NJ/PA 4.0)
- Include at least one payload that uses `.NET`-style `$values` wrappers to validate denormalization
- Include matchup details fixture that can produce lineups + lineup slots + matchup player stats

**Step 4: Run test to verify it passes**
Run: `npm run test -- tests/crossclub-sqlite-fixtures.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add data-ingestion/mock-data tests/crossclub-sqlite-fixtures.test.ts
git commit -m "test: add crossclub mock fixture set and validation tests"
```

---

### Task 3: Create SQLite schema for local validation

**Files:**
- Create: `data-ingestion/sqlite/schema.sql`
- Create: `data-ingestion/sqlite/db.ts`

**Step 1: Write the failing test**
- Add `tests/crossclub-sqlite-schema.test.ts` that:
  - creates a temp db
  - runs schema init
  - asserts required tables exist
  - asserts FK constraints are active

**Step 2: Run test to verify it fails**
Run: `npm run test -- tests/crossclub-sqlite-schema.test.ts`
Expected: FAIL because schema/db bootstrap does not exist.

**Step 3: Write minimal implementation**
- `schema.sql` tables should mirror Supabase ingestion targets used by pipeline:
  - `regions`, `divisions`, `clubs`, `teams`, `players`
  - `team_seasons`, `player_rosters`
  - `team_standings`, `player_division_stats`
  - `matchups`, `playoff_matchups`, `matchup_player_stats`
  - `lineups`, `lineup_slots`
  - `api_raw_ingest`, `ingest_runs`, `ingest_checkpoints`
- Include PK/FK/unique constraints needed to catch current bug classes.

**Step 4: Run test to verify it passes**
Run: `npm run test -- tests/crossclub-sqlite-schema.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add data-ingestion/sqlite tests/crossclub-sqlite-schema.test.ts
git commit -m "feat: add sqlite schema and db bootstrap for ingestion validation"
```

---

### Task 4: Build SQLite sink and mock ingestion runner

**Files:**
- Create: `data-ingestion/sqlite/sink.ts`
- Create: `data-ingestion/sqlite/run-mock.ts`
- Modify: `data-ingestion/run.ts` (optional: add mode flag routing)
- Modify: `data-ingestion/pipeline.ts` (extract reusable row-write helpers if needed)

**Step 1: Write the failing test**
- Add `tests/crossclub-sqlite-ingest.test.ts` with scenarios:
  - bootstrap all from fixtures
  - weekly details-only refresh
  - NJ/PA + 4.0 filter
- Assertions:
  - non-zero row counts per expected tables
  - no FK violations
  - idempotent re-run does not duplicate rows

**Step 2: Run test to verify it fails**
Run: `npm run test -- tests/crossclub-sqlite-ingest.test.ts`
Expected: FAIL because sink/runner are missing.

**Step 3: Write minimal implementation**
- Implement SQLite upsert helpers matching Supabase conflict keys.
- Reuse transform helpers from `data-ingestion/pipeline.ts`.
- Add CLI:
  - `node --experimental-strip-types data-ingestion/sqlite/run-mock.ts bootstrap all`
  - `... weekly details`
  - `... --region "NJ / PA" --division "4.0"`

**Step 4: Run test to verify it passes**
Run: `npm run test -- tests/crossclub-sqlite-ingest.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add data-ingestion/sqlite data-ingestion/pipeline.ts data-ingestion/run.ts tests/crossclub-sqlite-ingest.test.ts
git commit -m "feat: add sqlite sink and mock ingestion runner"
```

---

### Task 5: Add integrity verifier and drift checks

**Files:**
- Create: `data-ingestion/sqlite/verify.ts`
- Create: `tests/crossclub-sqlite-verify.test.ts`

**Step 1: Write the failing test**
- Test should expect verifier to return:
  - orphan counts by FK path
  - duplicate key collisions by logical conflict keys
  - missing season-scoped rows (`team_seasons`, `player_rosters`)

**Step 2: Run test to verify it fails**
Run: `npm run test -- tests/crossclub-sqlite-verify.test.ts`
Expected: FAIL because verifier does not exist.

**Step 3: Write minimal implementation**
- Implement verification queries and non-zero exit on integrity failures.
- Print concise report suitable for CI/log review.

**Step 4: Run test to verify it passes**
Run: `npm run test -- tests/crossclub-sqlite-verify.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add data-ingestion/sqlite/verify.ts tests/crossclub-sqlite-verify.test.ts
git commit -m "test: add sqlite integrity verifier for ingestion output"
```

---

### Task 6: Document local-first workflow

**Files:**
- Modify: `data-ingestion/README.md`
- Modify: `docs/database/crossclub_ingest_step2.md`

**Step 1: Write the failing test**
- Add a docs smoke test (or existing test update) checking README includes:
  - local SQLite preflight flow
  - command order
  - how to promote to Supabase ingestion after SQLite success

**Step 2: Run test to verify it fails**
Run: `npm run test -- tests/crossclub-sqlite-fixtures.test.ts`
Expected: FAIL on missing doc markers.

**Step 3: Write minimal implementation**
- Add “Local validation first” section:
  1. `npm run ingest:sqlite:init`
  2. `npm run ingest:sqlite:mock`
  3. `npm run ingest:sqlite:verify`
  4. `npm run ingest:crossclub:dry-run`
  5. `npm run ingest:crossclub:*` real phases

**Step 4: Run test to verify it passes**
Run: `npm run test -- tests/crossclub-sqlite-fixtures.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add data-ingestion/README.md docs/database/crossclub_ingest_step2.md tests/crossclub-sqlite-fixtures.test.ts
git commit -m "docs: add sqlite-first ingestion workflow"
```

---

## End-to-End Validation Checklist

Run in order:
1. `npm run test -- tests/crossclub-sqlite-fixtures.test.ts`
2. `npm run test -- tests/crossclub-sqlite-schema.test.ts`
3. `npm run test -- tests/crossclub-sqlite-ingest.test.ts`
4. `npm run test -- tests/crossclub-sqlite-verify.test.ts`
5. `npm run ingest:sqlite:init`
6. `npm run ingest:sqlite:mock`
7. `npm run ingest:sqlite:verify`
8. `npm run ingest:crossclub:dry-run`

Expected outcomes:
- All tests pass.
- SQLite verify returns zero orphan/duplicate failures.
- Supabase dry-run remains stable with same fixtures/filters.

## Out of Scope (YAGNI)
- Direct SQLite to Supabase auto-sync in this phase.
- GitHub Actions workflow integration.
- Backfilling every historical season from live API.

## Risks and Mitigations
- Native module install issues (`better-sqlite3`): pin Node version and fallback to `sqlite3` only if blocked.
- Fixture drift from live API: keep fixture contract doc and add one periodic fixture refresh task.
- Logic divergence between SQLite and Supabase sinks: enforce shared transform helpers in `pipeline.ts` and shared conflict key definitions.

## Handoff Notes
- Implement in small commits per task.
- If test design gets noisy, prefer table-driven tests and fixture factories.
- Keep all new local-validation code under `data-ingestion/`.
