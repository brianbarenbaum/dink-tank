# Follow-Up Context Continuity Plan (Question Refiner + State + SQL Edit)

## Summary
Improve multi-turn chat continuity so follow-up questions inherit scope (team/division/player/season) from prior turns. Add deterministic state tracking, a targeted question refiner, and a follow-up SQL edit path before normal SQL generation.

## Goals
- Keep follow-up questions in the same conversational thread.
- Reduce incorrect scope expansion on follow-ups (e.g. ranking for everyone vs prior team subset).
- Preserve current latency gains by using deterministic steps first and model calls only when needed.

## Scope
- Worker graph orchestration (`worker/src/chat/sqlGraphAgent.ts`).
- New context modules for state and follow-up detection/refinement.
- Env/config wiring for feature flags.
- Unit tests for follow-up behavior and contracts.

## Architecture Changes
1. Add `conversation_state` support to graph state.
2. Add `follow_up_detector` node (deterministic heuristic).
3. Add `question_refiner` node (small model, JSON contract).
4. Add `sql_edit` node (edit last SQL if follow-up + prior SQL exists).
5. Route SQL generation against refined question when used.
6. Keep selector/entity resolver/circuit-breaker behavior.

## Conversation State Model
- `activeTeamName?: string`
- `activeDivisionName?: string`
- `activePlayerName?: string`
- `activeSeasonNumber?: number`
- `activeSeasonYear?: number`
- `activeMetric?: string`
- `lastIntent?: string`
- `lastSelectedViews: string[]`
- `lastSqlQuery?: string`
- `confidence: number`

## Node Logic
### follow_up_detector (deterministic)
- Inputs: latest user question + prior user turns + conversation state.
- Outputs:
  - `isFollowUp`
  - `needsRefine`
  - `followUpReason`

### question_refiner (LLM, gated)
- Invoked only if `needsRefine=true`.
- Output JSON:
  - `standalone_question`
  - `used_state_fields: string[]`
  - `ambiguity_detected: boolean`
  - `clarifying_question?: string`
- If ambiguity true + clarifying_question present, route to answer with clarification.

### sql_edit (LLM, gated)
- Invoked only if:
  - `isFollowUp=true`
  - `conversation_state.lastSqlQuery` exists
- Produces edited SQL constrained to selected views.
- Fallback: if edit fails, proceed to normal `sql_gen`.

## Feature Flags
- `GRAPH_ENABLE_FOLLOWUP_CONTEXT` (default `true`)
- `GRAPH_ENABLE_QUESTION_REFINER` (default `true`)
- `GRAPH_ENABLE_SQL_EDIT_FOLLOWUPS` (default `true`)
- `GRAPH_REFINER_MODEL` (default `gpt-4.1-mini`)
- `GRAPH_REFINER_TIMEOUT_MS` (default `3000`)

## Telemetry Additions
- `followUpDetected: boolean`
- `followUpReason: string`
- `refinerUsed: boolean`
- `refinerMs: number`
- `sqlEditUsed: boolean`
- `sqlEditMs: number`
- `stateCarryoverUsed: boolean`
- `clarifyCount: number`

## Test Plan
1. Follow-up detector:
   - Detect follow-up in short metric-only turns.
   - Do not over-trigger for standalone explicit questions.
2. Question refiner:
   - Produces valid JSON contract.
   - Injects prior scope correctly.
3. State carryover:
   - Team/division from previous turn applied to follow-up.
4. SQL edit path:
   - Preserves prior WHERE scope when follow-up asks for different metric.
5. End-to-end graph state tests:
   - Clarifying question route for ambiguous follow-up.

## Acceptance Criteria
- Follow-up ranking questions remain scoped to prior team/division context.
- No regression in SQL safety and view-only constraints.
- p95 latency increase <= 10% from current graph baseline.
- Existing tests remain green.

