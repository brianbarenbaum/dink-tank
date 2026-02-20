# Supabase View Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update Supabase semantic views and runtime catalog metadata to support current-season flags, richer player season stats, and a consolidated team matches view.

**Architecture:** Introduce one forward-only Supabase migration that recreates affected views (`vw_player_team`, `vw_player_stats_per_season`, and new `vw_team_matches`) and drops replaced views. Keep worker catalog metadata as source of truth for LLM SQL planning by renaming/remapping catalog entries and routing hints to the new view names and columns.

**Tech Stack:** PostgreSQL (Supabase), Supabase MCP migration tooling, TypeScript/Vitest worker catalog selector tests.

---

### Task 1: Catalog contract red phase

**Files:**
- Modify: `tests/catalog-selector.test.ts`
- Modify: `tests/sql-prompt-contract.test.ts`

1. Write failing expectations for `public.vw_team_matches` where old tests reference `public.vw_team_match_summary` or `public.vw_team_schedule`.
2. Run targeted tests to verify expected failures:
   - `npm run test -- tests/catalog-selector.test.ts tests/sql-prompt-contract.test.ts`

### Task 2: SQL migration implementation

**Files:**
- Create: `supabase/migrations/20260220190138_align_semantic_views_player_team_and_team_matches.sql`

1. Recreate `public.vw_player_team` with `gender` and computed `is_current_season` flag based on max `season_year` then max `season_number` in that year.
2. Recreate `public.vw_player_stats_per_season` (interpreting requested `vw_player_status_per_season` update as this existing view) with added columns:
   - `total_points_against`
   - `total_point_differential`
   - `mixed_ppg as mixed_points_per_game`
   - `mixed_wins`, `mixed_losses`
   - `gender_ppg as gender_points_per_game`
   - `gender_wins`, `gender_losses`
3. Create `public.vw_team_matches` by combining schedule + match summary fields and add `is_past_match` derived from `match_datetime` source timestamp.
4. Drop replaced views `public.vw_team_schedule` and `public.vw_team_match_summary`.

### Task 3: Apply and validate migration

**Files:**
- None (MCP operations)

1. Apply migration in Supabase using MCP.
2. Verify via SQL inspection:
   - view existence
   - expected columns present
   - old views removed

### Task 4: Update repository schema docs and runtime catalog metadata

**Files:**
- Modify: `docs/database/crossclub_schema_v1.sql`
- Modify: `worker/src/runtime/catalog/catalog.data.ts`
- Modify: `worker/src/runtime/catalog/catalog.selector.ts`
- Modify: `worker/eval/config/optimizationHints.ts`
- Modify: `worker/eval/lib/fixPlanner.ts`

1. Align doc SQL definitions with migration changes.
2. Replace catalog entries/references from deprecated team views to `public.vw_team_matches`.
3. Update fallback and won/lost routing references to `public.vw_team_matches`.
4. Update optimization hint strings to new view name.

### Task 5: Green verification

**Files:**
- None

1. Re-run targeted tests:
   - `npm run test -- tests/catalog-selector.test.ts tests/sql-prompt-contract.test.ts`
2. Run broader checks as feasible within task scope and report any skipped commands explicitly.
