# Scoped Term Dictionary Injection Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve SQL question understanding for shorthand scope phrases (for example `3.0 Northwest`) by injecting compact, query-scoped division/pod metadata into the SQL system prompt, with team metadata included only when team intent is detected.

**Architecture:** Add a lightweight runtime metadata resolver that parses user intent, queries season-scoped division/pod/team lists from Supabase, and emits a compact "term dictionary" block for prompt injection. Keep the existing catalog selector as-is for view selection; this enhancement augments prompt grounding only. Use strict gating so team lists are only injected for team-intent prompts to avoid prompt bloat.

**Tech Stack:** TypeScript, Vitest, Node Postgres (`pg`), existing worker runtime prompt builder and SQL agent orchestration.

---

### Task 1: Red tests for scoped metadata prompt injection

**Files:**
- Modify: `tests/sql-prompt-contract.test.ts`
- Create: `tests/sql-scope-metadata.test.ts`

**Step 1: Add failing prompt contract test for metadata section**

Add a new assertion in `tests/sql-prompt-contract.test.ts` verifying `buildSqlSystemPrompt` can render a metadata section when provided:

```ts
expect(prompt).toContain("Scoped term dictionary");
expect(prompt).toContain("Recognized divisions");
expect(prompt).toContain("Recognized pods");
```

**Step 2: Add failing resolver tests for detection + gating**

Create `tests/sql-scope-metadata.test.ts` with focused unit tests for:
- division/pod extraction from shorthand (`Compare Avg PPG of 3.0 Northwest and 3.0 Southeast`)
- conditional team inclusion only for team-intent query (`Show Bounce Philly schedule`)
- no team list for non-team pod comparison query
- graceful empty metadata behavior when no scoped terms found

**Step 3: Run tests to verify RED**

Run:

```bash
npm run test -- tests/sql-prompt-contract.test.ts tests/sql-scope-metadata.test.ts
```

Expected: failures for missing prompt field and missing resolver implementation.

**Step 4: Commit red tests**

```bash
git add tests/sql-prompt-contract.test.ts tests/sql-scope-metadata.test.ts
git commit -m "test: add red coverage for scoped metadata prompt injection"
```

---

### Task 2: Implement scope metadata parser and formatter (minimal)

**Files:**
- Create: `worker/src/runtime/scopeMetadata.ts`
- Modify: `worker/src/runtime/types.ts`

**Step 1: Define metadata contract types**

Add types in `worker/src/runtime/types.ts`:

```ts
export interface ScopedMetadata {
  seasonLabel: string;
  divisions: string[];
  podsByDivision: Record<string, string[]>;
  teamsByDivision?: Record<string, string[]>;
  includeTeams: boolean;
}

export interface ScopeParseResult {
  inferredDivisionTerms: string[];
  inferredPodTerms: string[];
  inferredSeasonYear?: number;
  teamIntent: boolean;
}
```

**Step 2: Implement parser utilities**

In `worker/src/runtime/scopeMetadata.ts`, implement:
- `parseScopeTerms(question: string): ScopeParseResult`
- normalization helpers (`normalizeToken`, directional alias handling like `north west -> northwest`)
- `hasTeamIntent(question: string): boolean` using conservative regex cues (`team`, `schedule`, `opponent`, known team-like phrase patterns)

**Step 3: Implement prompt-block formatter**

In `worker/src/runtime/scopeMetadata.ts`, implement:

```ts
export const formatScopedMetadataBlock = (meta: ScopedMetadata | null): string => { ... }
```

Behavior:
- return empty string for `null`
- include only non-empty sections
- keep output compact and deterministic order

**Step 4: Run targeted tests for GREEN**

```bash
npm run test -- tests/sql-scope-metadata.test.ts
```

Expected: new resolver tests pass.

**Step 5: Commit parser/formatter**

```bash
git add worker/src/runtime/scopeMetadata.ts worker/src/runtime/types.ts tests/sql-scope-metadata.test.ts
git commit -m "feat: add scoped metadata parser and formatter"
```

---

### Task 3: Add DB-backed metadata lookup (season-scoped)

**Files:**
- Modify: `worker/src/runtime/sql/sqlExecutor.ts`
- Modify: `worker/src/runtime/scopeMetadata.ts`
- Create: `tests/sql-scope-metadata-db.test.ts`

**Step 1: Expose internal read-only row query helper**

Add helper in `worker/src/runtime/sql/sqlExecutor.ts` to return rows (not JSON text) for internal runtime lookups:

```ts
export const executeReadOnlySqlRows = async (
  env: WorkerEnv,
  query: string,
): Promise<Array<Record<string, unknown>>> => { ... }
```

Use existing `sanitizeSqlQuery` and pool reuse.

**Step 2: Implement metadata lookup function**

In `worker/src/runtime/scopeMetadata.ts`, add:

```ts
export const resolveScopedMetadata = async (
  env: WorkerEnv,
  question: string,
): Promise<ScopedMetadata | null> => { ... }
```

Query strategy:
- derive season scope: current season by default; explicit year if present
- query distinct `division_name`, `pod`, and optionally `team_name` from `public.vw_team_standings`
- if teamIntent = false, skip team query entirely
- filter by inferred division when present to keep pod/team lists small
- cap each list (e.g., `LIMIT 30`) and sort deterministicly

**Step 3: Add DB-lookup unit test with mocked executor**

Create `tests/sql-scope-metadata-db.test.ts` and mock `executeReadOnlySqlRows` to assert:
- team query path is called only for team-intent prompts
- non-team prompt fetches divisions + pods only
- emitted structure matches expected `ScopedMetadata`

**Step 4: Run tests to verify GREEN**

```bash
npm run test -- tests/sql-scope-metadata-db.test.ts tests/sql-scope-metadata.test.ts
```

**Step 5: Commit DB lookup integration**

```bash
git add worker/src/runtime/sql/sqlExecutor.ts worker/src/runtime/scopeMetadata.ts tests/sql-scope-metadata-db.test.ts
 git commit -m "feat: add season-scoped metadata lookup for prompt injection"
```

---

### Task 4: Inject scoped metadata into SQL prompt and telemetry

**Files:**
- Modify: `worker/src/runtime/prompt.ts`
- Modify: `worker/src/runtime/sqlAgent.ts`
- Modify: `tests/sql-prompt-contract.test.ts`

**Step 1: Extend prompt input contract**

Update `buildSqlSystemPrompt` input type to accept:

```ts
scopedMetadataBlock?: string;
```

Render section only when non-empty:
- header: `Scoped term dictionary:`
- include explanatory rule line: "If a recognized term matches a division/pod/team label, treat it as that scope unless user overrides."

**Step 2: Wire resolver into agent execution**

In `worker/src/runtime/sqlAgent.ts`:
- call `resolveScopedMetadata(env, inputMessage)` before prompt construction
- pass formatted block into `buildSqlSystemPrompt`
- add telemetry fields (bounded):
  - `scopedMetadataChars`
  - `scopedDivisionsCount`
  - `scopedPodsCount`
  - `scopedTeamsIncluded`

**Step 3: Verify prompt contract green**

```bash
npm run test -- tests/sql-prompt-contract.test.ts
```

**Step 4: Commit prompt wiring**

```bash
git add worker/src/runtime/prompt.ts worker/src/runtime/sqlAgent.ts tests/sql-prompt-contract.test.ts
 git commit -m "feat: inject scoped term dictionary into SQL system prompt"
```

---

### Task 5: Add behavior regression tests for shorthand pod comparisons

**Files:**
- Modify: `tests/catalog-selector.test.ts`
- Create: `tests/worker-chat-scope-normalization.test.ts`

**Step 1: Add a routing regression for shorthand pod phrase**

In `tests/catalog-selector.test.ts`, add/adjust case for:
- `Compare the Avg PPG of 3.0 Northwest and 3.0 Southeast`
- ensure selected primary view remains `public.vw_team_standings`

**Step 2: Add end-to-end-ish runtime test for prompt enrichment**

Create `tests/worker-chat-scope-normalization.test.ts`:
- mock metadata resolver output for `3.0` + pods `Northwest`, `Southeast`
- assert generated system prompt includes scoped metadata block
- assert no team list included for non-team question

**Step 3: Run tests**

```bash
npm run test -- tests/catalog-selector.test.ts tests/worker-chat-scope-normalization.test.ts
```

**Step 4: Commit regression coverage**

```bash
git add tests/catalog-selector.test.ts tests/worker-chat-scope-normalization.test.ts
 git commit -m "test: add shorthand division/pod scope normalization coverage"
```

---

### Task 6: Supabase + repository verification gate

**Files:**
- None

**Step 1: Run local verification commands (targeted first)**

```bash
npm run test -- tests/sql-prompt-contract.test.ts tests/sql-scope-metadata.test.ts tests/sql-scope-metadata-db.test.ts tests/catalog-selector.test.ts tests/worker-chat-scope-normalization.test.ts
npm run typecheck
npm run lint:check
```

**Step 2: Optional full verification**

```bash
npm run test
```

**Step 3: Runtime smoke check with local worker**

Run worker locally and confirm prompt-inference behavior for both:
- shorthand pod query (no teams in metadata)
- explicit team query (teams included)

**Step 4: Document verification evidence in PR notes**
- include failing->passing test evidence for TDD cycle
- include before/after example prompts and resulting SQL scopes

---

### Task 7: Post-deploy safety checks and tuning

**Files:**
- Modify: `worker/eval/config/optimizationHints.ts` (only if needed)
- Optional docs note: `worker/README.md`

**Step 1: Evaluate token budget impact**
- measure average `scopedMetadataChars`
- verify prompts stay within acceptable context budget

**Step 2: Add bounds/tuning constants (if needed)**
- max divisions
- max pods per division
- max teams per division when included

**Step 3: Validate ambiguity handling**
- if token maps to multiple pods/divisions, ensure model is prompted to ask one targeted clarification

**Step 4: Commit tuning/doc updates**

```bash
git add worker/eval/config/optimizationHints.ts worker/README.md
 git commit -m "chore: tune scoped metadata injection bounds and docs"
```
