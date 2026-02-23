# Lineup Lab Optimizer Improvements v2 Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve Lineup Lab recommendation quality and trustworthiness by fixing data/migration integrity first, then adding statistically defensible modeling and product features in risk-controlled phases.

**Architecture:** This plan treats Lineup Lab as a pipeline with four hard boundaries: data freshness/integrity, feature construction, optimization, and product controls. We stabilize each boundary before adding model complexity. Every phase has explicit entry criteria, exit criteria, and rollback paths.

**Tech Stack:** Supabase Postgres (functions/materialized views/RLS), Cloudflare Worker runtime (`pg`), Vue 3 + TypeScript frontend, Vitest + Playwright, SQL backtesting harness.

---

## Why This v2 Exists

The current implementation works end-to-end, but the highest-risk issues are upstream of “better optimizer heuristics”:

1. Migration/source-of-truth drift between repo and live analytics objects.
2. `matchupId` is validated but not used in feature generation.
3. Roster selection is truncated to 16 by sorted UUID, not true availability.
4. Scenario and pair-vs-pair datasets are extremely sparse; brute-force optimizer complexity can overfit noise.
5. Planned captain-write features require authentication/authorization groundwork that does not currently exist in the lineup path.

This v2 plan reorders delivery around those constraints.

---

## Phase 0: Stabilize Data Contracts and Operational Integrity

**Outcome:** Eliminate drift and hidden assumptions before changing model logic.

**Execution Status (2026-02-23):**
- `0.1` Completed with new migration: `supabase/migrations/20260223120000_rebuild_lineup_analytics_objects_v2.sql`
- `0.2` Completed in worker validation/repository/service paths with matchup-context enforcement and pre-match feature cutoff inputs.
- `0.3` Completed with explicit roster availability contract across context API, sidebar UI, and recommendation payload handling.
- `0.4` Completed with ingestion-owned analytics refresh trigger, worker staleness metadata, and operations runbook.
- Residual note: historical migration filenames present in Supabase but not in this branch remain a lineage-drift artifact; the new rebuild migration now establishes a deterministic source-of-truth baseline going forward.

### 0.1 Reconcile migration lineage with live analytics objects

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_rebuild_lineup_analytics_objects_v2.sql`
- Modify: `docs/plans/2026-02-22-lineup-lab-optimizer-improvements-v2.md` (status updates only)

**Tasks:**
1. Snapshot live definitions for:
   - `analytics.mv_game_events_canonical`
   - `analytics.mv_team_game_pairs`
   - `analytics.mv_pair_baseline_features`
   - `analytics.mv_pair_vs_pair_features`
   - `analytics.mv_opponent_pairing_scenarios`
   - `analytics.vw_pair_baseline_features`
   - `analytics.vw_pair_vs_pair_features`
   - `analytics.vw_opponent_pairing_scenarios`
   - `analytics.fn_lineup_lab_feature_bundle`
   - `analytics.refresh_lineup_analytics_views`
2. Write migration with explicit `drop ... if exists` + `create ...` for objects where definition updates must be guaranteed.
3. Recreate required indexes in the same migration.
4. Add idempotent `comment on ...` metadata with version marker (`lineup_analytics_v2`).

**Do not do:** `CREATE MATERIALIZED VIEW IF NOT EXISTS` as primary update mechanism.

**Exit criteria:**
- Fresh DB from migrations matches prod definitions byte-for-byte (normalized SQL comparison).
- `supabase list_migrations` and repo migration set are aligned.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

### 0.2 Make matchup context real in recommendation inputs

**Files:**
- Modify: `worker/src/runtime/lineupLab/types.ts`
- Modify: `worker/src/runtime/lineupLab/repository.ts`
- Modify: `worker/src/runtime/lineupLab/service.ts`
- Modify: `worker/src/runtime/lineupLab/validation.ts`
- Modify: `tests/lineup-lab-validation.test.ts`
- Modify: `tests/lineup-lab-handler.test.ts`

**Tasks:**
1. Treat `matchupId` as first-class context for lineup recommendations (not optional noise).
2. Add matchup-specific metadata retrieval (scheduled time, week, home/away orientation).
3. Feed matchup timestamp into feature generation so all historical aggregates can be restricted to pre-match data (`event_created_at < matchup_scheduled_time` where applicable).
4. Enforce division/team/opponent consistency checks for provided `matchupId`.

**Exit criteria:**
- Two requests with same team/opponent but different matchup weeks can produce different feature bundles.
- Validation rejects matchup/team mismatches with clear errors.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

### 0.3 Replace UUID-top-16 truncation with explicit availability contract

**Files:**
- Modify: `worker/src/runtime/lineupLab/repository.ts`
- Modify: `worker/src/runtime/lineupLab/contextHandler.ts`
- Modify: `src/features/chat/useChatController.ts`
- Modify: `src/features/chat/components/ChatSidebar.vue`
- Modify: `src/features/chat/lineupLabClient.ts`
- Create: `tests/lineup-lab-availability-selection.test.ts`

**Tasks:**
1. Stop selecting players by `ORDER BY player_id LIMIT 16`.
2. Context API should return:
   - Full roster list with names/genders.
   - Suggested default “active set” (deterministic heuristic).
3. UI adds explicit player availability controls (checkbox list or active/inactive toggles).
4. Recommendation payload uses user-selected player IDs only.
5. Enforce parity and minimum roster rules in validation with clear messages.

**Exit criteria:**
- No server-side silent truncation.
- UI and API payload reflect the same selected players.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

### 0.4 Add analytics refresh ownership and observability

**Files:**
- Modify/Create: ingestion pipeline scripts where refresh is orchestrated (`data-ingestion/**`)
- Modify: `worker/src/runtime/lineupLab/repository.ts`
- Create: `docs/operations/lineup-lab-analytics-refresh.md`

**Tasks:**
1. Define single owner for `analytics.refresh_lineup_analytics_views()`.
2. Add explicit refresh trigger in ingest completion workflow.
3. Add staleness guard in worker responses:
   - Include bundle metadata: `generated_at`, `max_last_seen_at`, `data_staleness_hours`.
4. Emit warning if staleness threshold exceeded.

**Exit criteria:**
- Refresh action is automated and documented.
- Recommendation responses expose staleness metadata.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

## Phase 1: Statistical Core Hardening (Before New UX Features)

**Outcome:** Improve predictive calibration with defensible, testable modeling changes.

### 1.1 Shrink type-specific rates correctly

**Files:**
- Modify: analytics MV migration file from Phase 0
- Modify: `worker/src/runtime/lineupLab/types.ts`
- Modify: `worker/src/runtime/lineupLab/optimizer.ts`
- Modify: `tests/lineup-lab-optimizer.test.ts`

**Tasks:**
1. Add type-specific priors (`mixed/female/male`) in feature SQL.
2. Add `*_win_rate_shrunk` fields for each type.
3. Keep raw rates for diagnostics, but optimizer should consume shrunk rates.
4. Add regression tests for null/type-sparse behavior.

**Exit criteria:**
- Optimizer never relies on raw sparse type rates by default.
- Backtest shows reduced variance in recommendations vs baseline.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

### 1.2 Incorporate point differential without double-counting

**Files:**
- Modify: analytics MV migration file
- Modify: `worker/src/runtime/lineupLab/optimizer.ts`
- Create: `worker/eval/runners/eval-lineup-calibration.ts`
- Create: `worker/eval/datasets/lineup_holdout_weekly.json`

**Tasks:**
1. Add PD-derived probability features (`pd_win_probability` and type-specific equivalents).
2. Avoid naive linear blend of highly correlated signals.
3. Implement reliability-conditioned blend with guardrails:
   - If signal correlation exceeds threshold, cap PD contribution.
4. Evaluate calibration on holdout weeks.

**Exit criteria:**
- Better Brier/log-loss on holdout vs Phase 0 model.
- No statistically significant overconfidence increase.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

### 1.3 Matchup-outcome objective layer

**Files:**
- Modify: `worker/src/runtime/lineupLab/optimizer.ts`
- Modify: `worker/src/runtime/lineupLab/types.ts`
- Modify: `src/features/chat/components/LineupRecommendationCard.vue`
- Modify: `tests/lineup-lab-optimizer.test.ts`

**Tasks:**
1. Add estimated matchup win probability (not only expected game wins).
2. Keep existing metrics (`expectedWins`, downside quantile), but rankers can use matchup-level objective.
3. Return both game-level and matchup-level confidence labels.

**Exit criteria:**
- Output payload includes matchup-level probability metric and tests validate ranges.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

## Phase 2: Known-Opponent Mode (High Tactical Value, Low Data Assumption)

**Outcome:** Provide deterministic response mode for captain decision support.

### 2.1 Request/validation model expansion

**Files:**
- Modify: `worker/src/runtime/lineupLab/types.ts`
- Modify: `worker/src/runtime/lineupLab/validation.ts`
- Modify: `tests/lineup-lab-validation.test.ts`

**Tasks:**
1. Add `mode: "blind" | "known_opponent"`.
2. Add strict `opponentRounds` schema for known-opponent mode.
3. Validate slot pattern and player UUID integrity.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

### 2.2 Deterministic optimizer path

**Files:**
- Modify: `worker/src/runtime/lineupLab/optimizer.ts`
- Modify: `worker/src/runtime/lineupLab/service.ts`
- Modify: `worker/src/runtime/lineupLab/handler.ts`
- Modify: `tests/lineup-lab-optimizer.test.ts`
- Modify: `tests/lineup-lab-handler.test.ts`

**Tasks:**
1. Add `recommendPairSetsKnownOpponent`.
2. Use slot-locked opponent pairs during construction, not only post-hoc scoring.
3. Keep constraints (fatigue/repeat pair) deterministic and reproducible.

**Exit criteria:**
- Same input yields same ranked output.
- Runtime remains within budget target.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

### 2.3 UI and API integration

**Files:**
- Modify: `src/features/chat/components/ChatSidebar.vue`
- Create: `src/features/chat/components/OpponentLineupInput.vue`
- Modify: `src/features/chat/useChatController.ts`
- Modify: `src/features/chat/lineupLabClient.ts`
- Modify: `src/features/chat/types.ts`
- Create/Modify: component tests for mode switching and validation

**Tasks:**
1. Add “Blind” vs “Response to Opponent” mode toggle.
2. Add opponent lineup entry UI with strong validation.
3. Wire mode and opponent rounds into POST body.

**Exit criteria:**
- Known-opponent workflow is fully usable from sidebar to recommendation card.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

## Phase 3: Security and Write Paths for Captain Inputs

**Outcome:** Introduce captain-editable ratings/preferences safely.

### 3.1 Authentication and authorization prerequisites

**Files:**
- Modify: worker auth middleware/runtime routes (`worker/src/runtime/index.ts` and related auth files)
- Modify/Create: RLS policies migration in `supabase/migrations/*.sql`
- Create: `docs/security/lineup-lab-captain-writes.md`

**Tasks:**
1. Enforce authenticated identity for write endpoints.
2. Define captain role/ownership checks.
3. Ensure RLS policies enforce team-level access.

**Exit criteria:**
- Unauthorized writes blocked by both API layer and DB layer.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

### 3.2 DUPR and preference schemas + endpoints

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_lineup_preferences_and_dupr_write_paths.sql`
- Modify: `worker/src/runtime/lineupLab/contextHandler.ts`
- Modify: `worker/src/runtime/lineupLab/repository.ts`
- Modify: `src/features/chat/components/ChatSidebar.vue`
- Modify: `src/features/chat/lineupLabClient.ts`
- Add tests for endpoint auth and upsert behavior

**Tasks:**
1. Add captain preference tables with PK/FK/indexes.
2. Add DUPR update endpoint and preference GET/PUT endpoints.
3. Include `dupr_rating` and preferences in feature bundle.

**Exit criteria:**
- Captain can persist and retrieve lineup preferences safely.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

### 3.3 Integrate preferences as bounded soft constraints

**Files:**
- Modify: `worker/src/runtime/lineupLab/optimizer.ts`
- Modify: `tests/lineup-lab-optimizer.test.ts`

**Tasks:**
1. Add side-compatibility and partner-affinity modifiers with tight caps.
2. Add safety cap so preferences cannot override large model probability gaps.
3. Add deterministic tests for preference effects.

**Exit criteria:**
- Preference influence is measurable but bounded.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

## Phase 4: Optimizer Architecture Upgrades Under Runtime Budgets

**Outcome:** Increase recommendation quality only where data density and compute budgets justify it.

### 4.1 Scenario representation redesign

**Files:**
- Modify: analytics scenario MV definition in migration
- Modify: `worker/src/runtime/lineupLab/optimizer.ts`
- Create: scenario diagnostics queries/docs

**Tasks:**
1. Replace exact-signature scenario rank as primary signal with clustered/partial structure (or recency-weighted marginal pair distributions).
2. Keep exact signatures for diagnostics only.

**Exit criteria:**
- Scenario object has materially higher effective sample sizes than current exact signatures.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

### 4.2 Scenario-aware construction with performance guardrails

**Files:**
- Modify: `worker/src/runtime/lineupLab/optimizer.ts`
- Modify: `worker/src/runtime/lineupLab/service.ts`
- Add perf tests/benchmarks

**Tasks:**
1. Introduce scenario-aware slot scoring.
2. Add hard runtime budget and early-stop behavior.
3. Tune attempts/adaptive search based on latency target, not fixed arbitrary counts.

**Exit criteria:**
- p95 recommendation latency under target in staging load tests.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

### 4.3 Local search and diversification (optional, gated)

**Files:**
- Modify: `worker/src/runtime/lineupLab/optimizer.ts`
- Modify: optimizer tests

**Tasks:**
1. Add local-improvement operators only if latency budget remains healthy.
2. Keep deterministic seed control for reproducibility.

**Exit criteria:**
- Quality lift proven in A/B backtests with no p95 latency regression breach.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

## Phase 5: Rollout, A/B Validation, and Production Guardrails

**Outcome:** Safe production adoption with measurable wins.

### 5.1 Offline backtest harness and acceptance thresholds

**Files:**
- Create: `worker/eval/runners/eval-lineup-ab.ts`
- Create: `worker/eval/datasets/lineup_ab_eval_set.json`
- Create: `docs/metrics/lineup-lab-success-metrics.md`

**Metrics to track:**
1. Brier score / log-loss for game outcomes.
2. Matchup win prediction calibration.
3. Recommendation stability under small roster perturbations.
4. Coverage and confidence distribution.

**Go-live gate:** new model must beat baseline on primary metrics with no severe latency/cost regressions.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

### 5.2 Feature flags and rollback controls

**Files:**
- Modify: worker config + env parsing (`worker/src/runtime/env.ts`)
- Modify: lineup service/optimizer routing
- Create: `docs/operations/lineup-lab-rollbacks.md`

**Tasks:**
1. Add model version and mode flags.
2. Support immediate rollback to prior scorer/construction path.

**Exit criteria:**
- One-config rollback works without redeploying SQL objects.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

## Recommend API E2E Loop (Mandatory for Every Step)

1. Assume the worker is already running and reachable at `http://127.0.0.1:8787` (do not start a new worker process as part of this loop).
2. Validation API calls in this loop do not require additional permission/escalation; run them directly against the running worker.
3. Build a real payload from current context endpoints (`/api/lineup-lab/context/divisions`, `/api/lineup-lab/context/teams`, `/api/lineup-lab/context/matchups`) so IDs and selected players are valid for the current data snapshot.
4. Issue a real recommendation request:
   ```bash
   curl -i -X POST http://127.0.0.1:8787/api/lineup-lab/recommend \
     -H 'content-type: application/json' \
     -d '{
       "divisionId":"<division-uuid>",
       "seasonYear":2025,
       "seasonNumber":3,
       "teamId":"<team-uuid>",
       "oppTeamId":"<opp-team-uuid>",
       "matchupId":"<matchup-uuid>",
       "availablePlayerIds":["<8-or-more-even-player-uuids>"],
       "objective":"MAX_EXPECTED_WINS",
       "maxRecommendations":3,
       "downsideQuantile":0.2,
       "scenarioLimit":12
     }'
   ```
5. Passing condition is strict: HTTP `200` plus valid JSON response shape (`requestId` string and `recommendations` array).
6. If the request fails (non-200, runtime exception, invalid payload shape, or empty critical fields), do not continue to the next plan step. Fix the root cause and rerun this exact loop until it passes.

---

## Cross-Phase Rules (Mandatory)

1. No claim of “better recommendations” without holdout metrics.
2. No new write endpoint without auth + RLS tests.
3. No optimizer search-budget increase without latency benchmark evidence.
4. No SQL object changes without migration parity checks against a fresh DB.
5. Every numbered plan step must end by passing the `Recommend API E2E Loop (Mandatory for Every Step)` with a real `POST /api/lineup-lab/recommend` call.

---

## Detailed Verification Matrix

### SQL/Schema verification
- `supabase list_migrations` matches repo migration files.
- Object definition diff checks pass for analytics MVs/views/functions.
- Index existence and expected query plans verified via `EXPLAIN ANALYZE`.

### Runtime verification
- `npm run test` includes lineup-lab suites.
- Add targeted integration tests for new endpoints and mode routing.
- Add deterministic optimizer tests for known-opponent mode.
- At the end of each numbered plan step, run and pass the `Recommend API E2E Loop (Mandatory for Every Step)` before moving forward.

### Product verification
- Sidebar availability controls correctly map to payload.
- Known-opponent input validation prevents partial/invalid submissions.
- Recommendation cards show model metadata (`mode`, staleness, objective, confidence).

### Operational verification
- Refresh workflow is documented and automated.
- Staleness warnings observed in staging when refresh is withheld.
- Rollback playbook tested.

---

## Suggested Sequence and Effort

1. Phase 0: 4-6 days
2. Phase 1: 5-7 days
3. Phase 2: 4-6 days
4. Phase 3: 6-9 days
5. Phase 4: 5-8 days (gated, may be partially skipped)
6. Phase 5: 2-3 days

Total: ~26-39 days, with quality gates allowing partial shipment earlier.

---

## Immediate Next Task (Recommended)

Start with **Phase 0.1 migration reconciliation** before any optimizer changes. Until that is complete, every downstream change risks being built on mismatched SQL definitions and unverifiable behavior.
