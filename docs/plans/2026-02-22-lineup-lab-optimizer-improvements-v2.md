# Lineup Lab Optimizer Improvements v2 Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve Lineup Lab recommendation quality and trustworthiness by fixing data/migration integrity first, then adding statistically defensible modeling and product features in risk-controlled phases.

**Architecture:** This plan treats Lineup Lab as a pipeline with four hard boundaries: data freshness/integrity, feature construction, optimization, and product controls. We stabilize each boundary before adding model complexity. Every phase has explicit entry criteria, exit criteria, and rollback paths. As of `2026-02-23`, product IA is split into two top-level tabs: `Chat` and `Lineup Lab`. `Chat` remains the default landing tab and is fully independent; Lineup Lab workflows do not render in chat transcript and are not sent to chat.

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
- Modify/Create: `src/features/lineup-lab/components/ScheduleMetadataHeader.vue`
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

**Outcome:** Provide deterministic response mode for captain decision support, implemented in a standalone Lineup Lab tab (not chat-coupled), with UI delivered before backend mode routing.

**UI source of truth:** `docs/plans/2026-02-23-lineup-lab-known-opponent-ui-spec.md`

**Execution Status (2026-02-23):**
- `2.1` Completed with standalone `Chat`/`Lineup Lab` tabs, chat-lineup state isolation, and migrated lineup UI shell in `src/features/lineup-lab/**`.
- `2.2` Completed with sidebar mode toggle, blind/known interaction contract, opponent input/output boundary labeling, and metadata header wiring.
- `2.3` Completed with strict mode-aware request validation and known-opponent `opponentRounds` schema enforcement.
- `2.4` Completed with deterministic known-opponent optimizer routing (`recommendPairSetsKnownOpponent`) and handler/service test coverage.
- `2.5` Completed with Lineup Lab-only API payload wiring, response rendering on schedule/metadata surfaces, and no chat transcript lineup payload emission.
- Verification evidence captured with passing runs for:
  - `npx playwright test e2e/lineup-lab-ui-mock.spec.ts`
  - `npx playwright test e2e/lineup-lab-ui-visual.spec.ts`
  - Real Recommend API E2E loop at `http://127.0.0.1:8787` for both `mode: "blind"` and `mode: "known_opponent"` (HTTP 200 + valid payload shape).

### 2.1 Standalone Lineup Lab tab and layout migration (UI-first)

**Files:**
- Modify: `src/App.vue`
- Create/Modify: `src/features/lineup-lab/**` (tab shell, left control panel, roster panels, schedule board)
- Modify: `src/features/chat/**` to remove lineup-lab-specific UI coupling and keep chat behavior standalone
- Create/Modify: `docs/plans/2026-02-23-lineup-lab-known-opponent-ui-spec.md`
- Create/Modify: component tests for top-tab navigation and isolation between chat/lineup states

**Tasks:**
1. Add top-level tab navigation: `Chat` and `Lineup Lab`.
2. Ensure `Chat` is the default tab on app entry.
3. Move all lineup controls and recommendation rendering to Lineup Lab tab.
4. Keep chat state and lineup state independent (no transcript cards, no chat message side effects from lineup actions).
5. Implement the new layout direction from `designs/lineup_lab_new.png` as the primary UI shell.
6. Create/update and validate the UI spec as part of implementation (not post-hoc documentation), including mode behavior, anti-confusion rules, required test hooks, and Playwright completion gates.

**Exit criteria:**
- Users can switch between `Chat` and `Lineup Lab` without state leakage.
- Chat view behaves as a standalone chat interface.
- Lineup Lab view has enough surface area for known-opponent workflow.
- UI spec document is updated to match the implemented behavior before Phase 2.2 begins.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

### 2.2 Mode toggle, roster behavior, and schedule interaction contract (UI-first)

**Files:**
- Modify/Create: `src/features/lineup-lab/components/LineupLabSidebar.vue`
- Create: `src/features/lineup-lab/components/OpponentLineupInput.vue`
- Modify/Create: `src/features/lineup-lab/components/ScheduleConfigurationBoard.vue`
- Modify/Create: `src/features/lineup-lab/useLineupLabController.ts`
- Create/Modify: component tests for mode behavior and interaction affordances

**Tasks:**
1. Add mode toggle under `Matchup` in left panel: `Blind` vs `Response to Opponent`.
2. Always render Opponent Roster panel.
3. In `Blind` mode:
   - Opponent roster entries are visible but not draggable.
   - Schedule cards do not render opponent drop targets.
4. In `Response to Opponent` mode:
   - Opponent roster entries become draggable/selectable for assignment.
   - Schedule cards render opponent-side input targets for each game slot.
5. Enforce explicit visual boundary between input and output to avoid confusion:
   - Opponent assignment area labeled as captain input.
   - Our lineup area labeled as optimizer output (read-only until calculate result is returned).
6. Render metadata at the top of the schedule configuration (as shown in design): expected wins, conservative wins, matchup win %, game confidence, matchup confidence.

**Exit criteria:**
- Mode behavior matches the above contract across desktop/mobile.
- Blind mode does not expose interactive opponent assignment controls.
- Users can distinguish opponent input from optimizer output with no ambiguous editable states.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

### 2.3 Request/validation model expansion (backend starts after UI)

**Files:**
- Modify: `worker/src/runtime/lineupLab/types.ts`
- Modify: `worker/src/runtime/lineupLab/validation.ts`
- Modify: `tests/lineup-lab-validation.test.ts`

**Tasks:**
1. Add `mode: "blind" | "known_opponent"` to request schema.
2. Add strict `opponentRounds` schema for known-opponent mode.
3. Validate slot pattern, round count, slot count, and player UUID integrity.
4. Keep blind-mode payload valid without opponent round assignments.

**Exit criteria:**
- Validation errors are explicit and mode-specific.
- Known-opponent payload contract matches UI interaction model.


**Step-end verification (mandatory):**
- Run the `Recommend API E2E Loop (Mandatory for Every Step)` in this plan with a real `POST /api/lineup-lab/recommend` request.
- If the response is not HTTP `200` or returns an error payload, stop, fix the root cause, and repeat this verification.
- Proceed to the next plan step only after this loop succeeds.

---

### 2.4 Deterministic optimizer path

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

### 2.5 Frontend API wiring in standalone Lineup Lab

**Files:**
- Modify: `src/features/lineup-lab/lineupLabClient.ts` (or move from chat namespace)
- Modify: `src/features/lineup-lab/useLineupLabController.ts`
- Modify: `src/features/lineup-lab/types.ts`
- Create/Modify: integration tests for mode switching, payload shape, and response rendering

**Tasks:**
1. Wire mode and opponent rounds into POST body from Lineup Lab tab only.
2. Ensure payload generation honors blind/known mode contract.
3. Render backend outputs in the schedule surface and metadata header (not chat cards).

**Exit criteria:**
- Known-opponent workflow is fully usable end-to-end in Lineup Lab tab.
- No lineup recommendation payloads are emitted to chat transcript.


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
- Modify: `src/features/lineup-lab/components/LineupLabSidebar.vue`
- Modify: `src/features/lineup-lab/lineupLabClient.ts`
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
       "mode":"blind",
       "availablePlayerIds":["<8-or-more-even-player-uuids>"],
       "objective":"MAX_EXPECTED_WINS",
       "maxRecommendations":3,
       "downsideQuantile":0.2,
       "scenarioLimit":12
     }'
   ```
5. Passing condition is strict: HTTP `200` plus valid JSON response shape (`requestId` string and `recommendations` array).
6. For known-opponent verification steps, rerun the same request with `"mode":"known_opponent"` and a valid `opponentRounds` payload that matches slot-pattern validation.
7. If the request fails (non-200, runtime exception, invalid payload shape, or empty critical fields), do not continue to the next plan step. Fix the root cause and rerun this exact loop until it passes.

---

## Cross-Phase Rules (Mandatory)

1. No claim of “better recommendations” without holdout metrics.
2. No new write endpoint without auth + RLS tests.
3. No optimizer search-budget increase without latency benchmark evidence.
4. No SQL object changes without migration parity checks against a fresh DB.
5. Every numbered plan step must end by passing the `Recommend API E2E Loop (Mandatory for Every Step)` with a real `POST /api/lineup-lab/recommend` call.
6. Any Lineup Lab UI step is incomplete until Playwright passes for both behavioral spec checks and design parity checks; implementers must continue iterating until those checks pass.

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
- Lineup Lab left-panel availability controls correctly map to payload.
- Mode toggle under `Matchup` enforces blind/known interaction differences.
- Known-opponent input validation prevents partial/invalid submissions.
- Metadata is displayed at the top of schedule configuration (`expectedWins`, `conservativeWins`, `matchupWin%`, `gameConfidence`, `matchupConfidence`).
- Chat transcript remains independent and does not render lineup recommendation cards.
- Run and pass: `npx playwright test e2e/lineup-lab-ui-mock.spec.ts`.
- Run and pass: `npx playwright test e2e/lineup-lab-ui-visual.spec.ts` against approved baselines derived from `designs/lineup_lab_new.png`.
- Do not mark UI work complete if either Playwright UI suite is failing.

### Operational verification
- Refresh workflow is documented and automated.
- Staleness warnings observed in staging when refresh is withheld.
- Rollback playbook tested.

---

## Suggested Sequence and Effort

1. Phase 0: 4-6 days
2. Phase 1: 5-7 days
3. Phase 2: 6-8 days (includes UI shell migration to standalone tab before backend mode delivery)
4. Phase 3: 6-9 days
5. Phase 4: 5-8 days (gated, may be partially skipped)
6. Phase 5: 2-3 days

Total: ~28-41 days, with quality gates allowing partial shipment earlier.

---

## Immediate Next Task (Recommended)

Start with **Phase 2.1 standalone Lineup Lab tab/layout migration**, then complete **Phase 2.2 UI interaction contract** before backend mode routing (`2.3+`). This preserves UI clarity and prevents rework while known-opponent contracts are finalized.
