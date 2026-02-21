# Add is_current_season To All Season Views Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `is_current_season` to every public view that exposes both `season_number` and `season_year`, then align catalog metadata and docs.

**Architecture:** Introduce one forward-only SQL migration that recreates all season-scoped views and appends `is_current_season` (without reordering existing columns). Use a shared current-season calculation (max season year, then max season number in that year) to keep semantics consistent across views.

**Tech Stack:** Supabase Postgres views, Supabase MCP migration tooling, TypeScript/Vitest catalog tests.

---

### Task 1: Red test for catalog season defaults

**Files:**
- Create: `tests/catalog-season-defaults.test.ts`

1. Add tests asserting all season-scoped catalog entries include:
   - `is_current_season` in `columns`
   - `filterHints.defaults.is_current_season = "true"`
2. Run test and verify it fails before implementation:
   - `npm run test -- tests/catalog-season-defaults.test.ts`

### Task 2: SQL migration for season-scoped views

**Files:**
- Create: `supabase/migrations/<timestamp>_add_is_current_season_to_all_season_views.sql`

1. Recreate these views with appended `is_current_season`:
   - `vw_player_stats_per_season`
   - `vw_player_stats_per_match`
   - `vw_player_game_history`
   - `vw_match_game_lineups_scores`
   - `vw_team_standings`
   - `vw_team_matches`
2. Keep `vw_player_team` behavior intact (already has `is_current_season`).
3. Ensure no existing columns are reordered.

### Task 3: Apply migration and validate in Supabase

**Files:**
- None (MCP operations)

1. Apply migration with `mcp__supabase__apply_migration`.
2. Validate with SQL:
   - all target views exist
   - each has `is_current_season`
   - old columns preserved

### Task 4: Update schema docs and catalog metadata

**Files:**
- Modify: `docs/database/crossclub_schema_v1.sql`
- Modify: `worker/src/runtime/catalog/catalog.data.ts`

1. Update doc SQL definitions for affected views.
2. For season-scoped catalog entries add:
   - `is_current_season` column
   - `filterHints.defaults.is_current_season = "true"`
   - sample values for `is_current_season`

### Task 5: Green verification

**Files:**
- None

1. Re-run targeted tests:
   - `npm run test -- tests/catalog-season-defaults.test.ts tests/catalog-selector.test.ts tests/sql-prompt-contract.test.ts`
2. Run TypeScript check:
   - `npm run typecheck`
3. Report any broader repo checks that fail due unrelated pre-existing issues.
