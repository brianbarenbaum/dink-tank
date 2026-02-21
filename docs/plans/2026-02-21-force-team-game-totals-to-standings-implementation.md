# Force Team Game Totals To Standings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure team-level game totals use `public.vw_team_standings` as canonical source, and explicitly disambiguate `match` vs `game` so the agent does not answer match totals when asked about games.

**Architecture:** Add intent-level routing guards in the catalog selector and explicit prompt ontology policy (`match` != `game`). Keep lineup workflows for boxscore/court detail and explicit playoff-inclusive recomputation only. Add regression tests for both semantics and the Flemington Blue 3.0 scenario.

**Tech Stack:** TypeScript, Vitest, runtime catalog selector, SQL prompt contract tests, existing worker SQL-agent orchestration.

---

### Task 1: Red tests for game-vs-match semantics and canonical source routing

**Files:**
- Modify: `tests/catalog-selector.test.ts`
- Modify: `tests/sql-prompt-contract.test.ts`

**Step 1: Add failing selector test for team game total intent**

Add test case in `tests/catalog-selector.test.ts`:
- Input: `How many games has Flemington Blue 3.0 won this season?`
- Expected primary selected view: `public.vw_team_standings`

**Step 2: Add failing selector test for team match total intent**

Add test case:
- Input: `How many matches has Flemington Blue 3.0 won this season?`
- Expected primary selected view: `public.vw_team_standings`
- Add assertion later that SQL should use `wins/losses/draws` for match intent (prompt policy check).

**Step 3: Add failing prompt contract tests for ontology and source policy**

In `tests/sql-prompt-contract.test.ts`, assert prompt includes rules:
- `A match consists of multiple games.`
- `When user asks for games, return game-level totals (game_record/game fields).`
- `When user asks for matches, return match-level totals (wins/losses/draws).`
- `Do not derive default season game totals from vw_match_game_lineups_scores unless explicitly requested (playoffs/lineup recompute).`

**Step 4: Run tests to verify RED**

```bash
npm run test -- tests/catalog-selector.test.ts tests/sql-prompt-contract.test.ts
```

Expected: newly added assertions fail before implementation.

**Step 5: Commit red tests**

```bash
git add tests/catalog-selector.test.ts tests/sql-prompt-contract.test.ts
git commit -m "test: add red coverage for game-vs-match semantics and standings source"
```

---

### Task 2: Implement standings-first routing for team game totals

**Files:**
- Modify: `worker/src/runtime/catalog/catalog.selector.ts`

**Step 1: Add focused regex for team game-total intent**

Detect prompts containing:
- team cue (`team token/name`, club/team words)
- game-total cue (`how many games`, `total games`, `games won/lost`, `game record`)
- season cue (`this season`, `season`, inherited season context)

Exclude lineup-detail cues:
- `lineup`, `court`, `boxscore`, `who played`, `game-by-game`.

**Step 2: Force primary view to standings for default game totals**

Set forced primary view to `public.vw_team_standings` for this intent.

**Step 3: Preserve lineup routing for explicit recomputation/detail**

If prompt explicitly requests lineup rows/court detail/recompute-including-playoffs, allow `vw_match_game_lineups_scores` routing.

**Step 4: Run selector tests to verify GREEN**

```bash
npm run test -- tests/catalog-selector.test.ts
```

**Step 5: Commit selector changes**

```bash
git add worker/src/runtime/catalog/catalog.selector.ts tests/catalog-selector.test.ts
git commit -m "feat: enforce standings-first routing for team game totals"
```

---

### Task 3: Add match-vs-game ontology and canonical source guard to SQL prompt

**Files:**
- Modify: `worker/src/runtime/prompt.ts`
- Modify: `tests/sql-prompt-contract.test.ts`

**Step 1: Add explicit ontology block**

In `buildSqlSystemPrompt`, add deterministic lines:
- `Match-level metrics: wins/losses/draws/record.`
- `Game-level metrics: game_record/game totals from standings or explicit lineup recomputation.`
- `A match consists of multiple games.`

**Step 2: Add source preference rules**

Add rule text:
- Team season game totals default to `vw_team_standings`.
- `vw_match_game_lineups_scores` is for lineup/court detail or explicit playoff-inclusive recomputation.

**Step 3: Add response labeling rule**

Require final answer to include metric type label:
- `Metric type: game-level` or `Metric type: match-level`.

**Step 4: Run prompt contract tests**

```bash
npm run test -- tests/sql-prompt-contract.test.ts
```

**Step 5: Commit prompt changes**

```bash
git add worker/src/runtime/prompt.ts tests/sql-prompt-contract.test.ts
git commit -m "feat: add match-vs-game ontology and canonical source rules"
```

---

### Task 4: Add regression tests for intent boundaries

**Files:**
- Create: `tests/standings-vs-lineups-intent.test.ts`

**Step 1: Add default game-total intent test**

Input:
- `How many games has Flemington Blue 3.0 won this season?`
Expected:
- selector chooses `vw_team_standings` first.

**Step 2: Add default match-total intent test**

Input:
- `How many matches has Flemington Blue 3.0 won this season?`
Expected:
- selector chooses `vw_team_standings` first.

**Step 3: Add explicit playoff-inclusive recomputation test**

Input:
- `Including playoffs, recompute from lineup game rows how many games has Flemington Blue won?`
Expected:
- `vw_match_game_lineups_scores` remains eligible/selected.

**Step 4: Add explicit lineup detail intent test**

Input:
- `Show game-by-game lineup scores for Flemington Blue 3.0`
Expected:
- `vw_match_game_lineups_scores` selected.

**Step 5: Run tests**

```bash
npm run test -- tests/standings-vs-lineups-intent.test.ts tests/catalog-selector.test.ts
```

**Step 6: Commit regression tests**

```bash
git add tests/standings-vs-lineups-intent.test.ts tests/catalog-selector.test.ts
git commit -m "test: cover game-vs-match and standings-vs-lineups intent boundaries"
```

---

### Task 5: Optional consistency harness for semantics (non-production)

**Files:**
- Create: `tests/standings-lineups-consistency.test.ts`

**Step 1: Add fixture-based semantic consistency tests**

Encode expectations:
- Regular-season lineup aggregation == `vw_team_standings.game_record`
- All-games lineup aggregation can be higher due to playoffs
- Match totals (`wins/losses/draws`) are not interchangeable with game totals

**Step 2: Run tests**

```bash
npm run test -- tests/standings-lineups-consistency.test.ts
```

**Step 3: Commit optional harness**

```bash
git add tests/standings-lineups-consistency.test.ts
git commit -m "test: document game-vs-match and playoff scope semantics"
```

---

### Task 6: Verification and rollout checks

**Files:**
- None

**Step 1: Targeted verification suite**

```bash
npm run test -- tests/catalog-selector.test.ts tests/sql-prompt-contract.test.ts tests/standings-vs-lineups-intent.test.ts
npm run typecheck
```

**Step 2: Wider regression checks**

```bash
npm run test -- tests/worker-chat-scope-normalization.test.ts tests/sql-agent-reasoning.test.ts
```

**Step 3: Runtime smoke scenarios (manual)**

Validate `/api/chat` with:
1. `How many games has Flemington Blue 3.0 won this season?`
   - Expect game-level standings-derived value (`225` currently).
2. `How many matches has Flemington Blue 3.0 won this season?`
   - Expect match-level standings-derived value (`9` currently).
3. `Including playoffs, recompute from lineup game rows ...`
   - Expect higher game-level lineup-derived value (`261` currently).

**Step 4: Selector reason and response label sanity**

- Confirm selector reason indicates standings-forced intent for default totals.
- Confirm final answer includes `Metric type` label.

---

### Task 7: Documentation updates

**Files:**
- Modify: `worker/README.md`

**Step 1: Document ontology and canonical source policy**

Add concise section:
- `match` vs `game` definitions
- canonical source for team season game totals = `vw_team_standings`
- lineup view usage = detail/recompute only

**Step 2: Document playoff semantics**

Clarify:
- standings `game_record` corresponds to regular-season team games
- lineup aggregation can include playoffs unless filtered

**Step 3: Commit docs**

```bash
git add worker/README.md
git commit -m "docs: clarify match-vs-game ontology and standings source policy"
```

