# LangGraph SQL Chat Optimization Plan (Latency-First, Single-Pass Persona)

## Summary
Replace the current single `createAgent` SQL flow with an explicit LangGraph pipeline in the Worker to reduce latency/tokens and improve consistency.  
The new flow will be:

1. `Selector` (deterministic, no LLM): choose relevant tables/columns from a cached schema index.
2. `SQL Gen` (LLM, minimal reasoning): generate one read-only SQL statement from pruned schema.
3. `Execute` (DB): run sanitized SQL with strict limits/timeouts.
4. `Answer` (LLM, single pass persona): convert result to final user response with strict style contract.

This preserves the external API contract `POST /api/chat -> { reply: string }` while improving speed, quality, and style consistency.

## Public API / Interface Changes
1. Keep request/response JSON unchanged:
   - Request: `{ messages: Array<{ role: "user" | "assistant"; content: string }> }`
   - Response: `{ reply: string }`
2. Add internal env config (new):
   - `AGENT_ORCHESTRATOR=legacy|graph` (default: `legacy` for safe rollout)
   - `GRAPH_SELECTOR_MAX_TABLES` (default: `4`)
   - `GRAPH_SELECTOR_MAX_COLUMNS_PER_TABLE` (default: `20`)
   - `GRAPH_MAX_ROWS` (default: `25`)
   - `GRAPH_MAX_HISTORY_MESSAGES` (default: `6`)
   - `GRAPH_SQL_MODEL` (default: `gpt-5-mini`)
   - `GRAPH_ANSWER_MODEL` (default: `gpt-5-mini`)
   - `GRAPH_ENABLE_TELEMETRY=true|false` (default: `true`)
3. Internal function contract change:
   - Introduce `runGraphSqlAgent(env, messages): Promise<string>`
   - Keep existing `runSqlAgent` for fallback during rollout.

## Implementation Plan

### 1. Baseline and feature-flag scaffolding
1. Capture baseline timings/tokens from current path in `worker/src/chat/sqlAgent.ts` via structured logs.
2. Extend `worker/src/env.ts` to parse new graph env vars with safe defaults.
3. Add orchestrator switch in `worker/src/index.ts`:
   - `legacy` -> existing `runSqlAgent`
   - `graph` -> new `runGraphSqlAgent`

### 2. Build schema index + deterministic selector
1. Create `worker/src/chat/schemaIndex.ts`:
   - Load schema once per pool URL (reuse existing cache behavior).
   - Build index:
     - table name tokens
     - column name tokens
     - optional synonym map (e.g., `wins -> win`, `pct -> percentage`).
2. Create `worker/src/chat/selector.ts`:
   - Input: latest user question + schema index.
   - Score tables by keyword/token overlap (question vs table/column tokens).
   - Select top N tables (`GRAPH_SELECTOR_MAX_TABLES`).
   - Prune columns per table (`GRAPH_SELECTOR_MAX_COLUMNS_PER_TABLE`).
3. Output compact schema context string for SQL generation node.

### 3. Implement LangGraph workflow
1. Add direct dependency `@langchain/langgraph` in `package.json` (explicit, not transitive reliance).
2. Create `worker/src/chat/sqlGraphAgent.ts` with typed graph state:
   - `messages`
   - `question`
   - `selectedSchema`
   - `sqlQuery`
   - `sqlResult`
   - `answer`
   - `attempt`
   - `telemetry`
3. Node specs:
   - `selectorNode` (deterministic): sets `selectedSchema`.
   - `sqlGenNode` (LLM): emits strict JSON `{ query: string }` only.
   - `executeNode` (DB): runs `sanitizeSqlQuery(query)` + compact JSON result.
   - `answerNode` (LLM): single-pass persona output from `question + sqlResult`.
4. Routing:
   - `START -> selector -> sqlGen -> execute -> answer -> END`
   - If execute fails with SQL error, allow one retry path `execute_error -> sqlGen -> execute` with capped attempts (`attempt <= 2`).

### 4. Prompt and output contracts
1. Replace broad system prompt with role-specific prompts:
   - `sqlGenPrompt`: SQL-only, no prose, one statement, explicit column selection, limit required.
   - `answerPrompt`: persona style guide + strict response shape (short summary + key evidence bullets).
2. Enforce structured output for SQL gen using schema validation (`zod`).
3. Keep answer generation single-pass (no separate rewrite node) for latency.

### 5. Execution hardening and token reduction
1. Keep existing `sanitizeSqlQuery` rules in `worker/src/chat/sqlSafety.ts`; extend as needed for edge cases.
2. Ensure DB result serialization is compact (no pretty formatting).
3. Truncate long text fields and cap rows before passing to answer model.
4. Trim message history to most recent `GRAPH_MAX_HISTORY_MESSAGES`.

### 6. Telemetry and observability
1. Add per-node timing logs:
   - `selector_ms`, `sql_gen_ms`, `execute_ms`, `answer_ms`, `total_ms`
2. Add token usage logs when available from model responses.
3. Add quality counters:
   - `sql_retry_count`
   - `query_blocked_count`
   - `empty_result_count`
4. Emit one structured log object per request (no PII/raw user dump).

### 7. Rollout strategy
1. Deploy with `AGENT_ORCHESTRATOR=legacy` first.
2. Enable `graph` in local/staging and compare metrics for fixed query set.
3. Flip production to `graph` only after acceptance thresholds are met.
4. Keep legacy path for one release cycle as rollback.

## Tests and Scenarios

### Unit tests
1. `tests/selector.test.ts`
   - relevant table ranking
   - irrelevant table exclusion
   - tie-break behavior
2. `tests/sql-graph-state.test.ts`
   - node state transitions
   - retry path and max-attempt stop
3. `tests/sql-prompt-contract.test.ts`
   - SQL gen returns parseable `{ query }`
4. Extend `tests/sql-safety.test.ts`
   - ensure generated edge queries are still blocked/limited properly.

### Integration tests
1. `tests/worker-chat-handler.test.ts`
   - orchestrator switch behavior (`legacy` vs `graph`)
   - graph failures map to existing error contract.
2. New `tests/sql-graph-agent.integration.test.ts`
   - mocked DB + mocked model for deterministic node outputs.

### E2E / runtime checks
1. Update `e2e/chat-backend-local.spec.ts` to run against `AGENT_ORCHESTRATOR=graph`.
2. Add latency regression script/test against a fixed prompt set (10-20 representative questions).

### Acceptance criteria
1. p95 latency improves by at least 30% vs baseline.
2. Prompt+completion tokens per request reduce by at least 40%.
3. SQL success rate (non-error execution) is >= baseline.
4. Persona/style rubric pass rate improves vs baseline for sampled outputs.

## Assumptions and Defaults Chosen
1. Primary optimization target is latency (already selected).
2. Persona control will be single-pass in answer node (already selected).
3. Selector is deterministic first (no extra model call) to avoid added latency.
4. `gpt-5-mini` remains model default; consistency will come from constraints/templates, not temperature tuning.
5. External API contract remains unchanged; all changes are internal + env-gated.
6. One SQL retry is allowed; more retries are disallowed to protect latency/cost.
