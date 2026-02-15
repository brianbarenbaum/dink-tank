# Backend Chat SQL Worker Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-first backend chat service using a Cloudflare Worker + LangChain SQL Agent + Supabase Postgres + OpenAI API, exposed as `POST /api/chat` returning `{ reply: string }`, with read-only SQL guardrails and no authentication in this phase.

**Architecture:** Implement a Worker endpoint with a thin transport layer and a dedicated chat-agent service layer. The service layer initializes LangChain SQL tooling against Supabase via direct Postgres URL (`SUPABASE_DB_URL`), executes read-only SQL flows, and returns a single text answer. Run locally via `wrangler dev`, and route Vite frontend `/api/chat` through Vite proxy so frontend contract remains unchanged. Keep requests stateless: frontend passes recent message history each call; backend does not persist session memory.

**Tech Stack:** Cloudflare Workers (Wrangler), TypeScript, LangChain SQL Agent, OpenAI Chat Completions API, Supabase Postgres direct connection.

---

### Task 1: Scaffold Worker Runtime and Local Dev Wiring

**Files:**
- Create: `worker/src/index.ts`
- Create: `worker/wrangler.toml`
- Create: `worker/tsconfig.json`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `worker/README.md`

**Step 1: Write failing integration check for missing local endpoint**

```bash
curl -i http://127.0.0.1:8787/api/chat
# Expected before implementation: connection or 404 failure
```

**Step 2: Add worker project skeleton**

- Define `wrangler.toml` with local dev defaults.
- Add scripts:
  - `worker:dev` -> `wrangler dev worker/src/index.ts --config worker/wrangler.toml`
  - `worker:deploy:dry` (optional dry command)
- Update `vite.config.ts` devServer proxy:
  - `/api` -> `http://127.0.0.1:8787`

**Step 3: Implement minimal route stub**

- `POST /api/chat` returns `501` JSON placeholder.
- Non-matching routes return `404` JSON.

**Step 4: Run local smoke verification**

Run:

```bash
npm run worker:dev
curl -i -X POST http://127.0.0.1:8787/api/chat -H 'content-type: application/json' -d '{"messages":[]}'
```

Expected: endpoint responds (not connection failure).

**Step 5: Commit**

```bash
git add worker package.json vite.config.ts
git commit -m "feat(worker): scaffold cloudflare worker and local proxy wiring"
```

### Task 2: Define Request/Response Contracts and Validation

**Files:**
- Create: `worker/src/chat/types.ts`
- Create: `worker/src/chat/validation.ts`
- Create: `tests/worker-chat-validation.test.ts`

**Step 1: Write failing tests for request validation**

```ts
it("accepts valid chat payload", () => {
  const result = parseChatRequest({ messages: [{ role: "user", content: "hello" }] });
  expect(result.ok).toBe(true);
});

it("rejects unknown roles and empty content", () => {
  const result = parseChatRequest({ messages: [{ role: "system", content: "" }] });
  expect(result.ok).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/worker-chat-validation.test.ts`
Expected: FAIL with missing module.

**Step 3: Implement minimal contracts**

- Request type:
  - `{ messages: Array<{ role: "user" | "assistant"; content: string }> }`
- Response type:
  - `{ reply: string }`
- Validation:
  - messages required, max window (e.g., last 20), non-empty trimmed content.

**Step 4: Re-run targeted tests**

Run: `npm run test -- tests/worker-chat-validation.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add worker/src/chat/types.ts worker/src/chat/validation.ts tests/worker-chat-validation.test.ts
git commit -m "feat(worker): add chat payload contracts and validation"
```

### Task 3: Add Environment Contract and Secret Loading

**Files:**
- Create: `worker/src/env.ts`
- Modify: `worker/src/index.ts`
- Modify: `.env.example`
- Create: `tests/worker-env-contract.test.ts`

**Step 1: Write failing tests for env parsing**

- Required variables:
  - `OPENAI_API_KEY`
  - `SUPABASE_DB_URL`
- Optional runtime knobs:
  - `LLM_MODEL` (default)
  - `SQL_QUERY_TIMEOUT_MS`

**Step 2: Run failing test**

Run: `npm run test -- tests/worker-env-contract.test.ts`
Expected: FAIL missing module.

**Step 3: Implement env guard utility**

- Parse and validate bindings.
- Return structured error for missing vars.

**Step 4: Verify tests pass**

Run: `npm run test -- tests/worker-env-contract.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add worker/src/env.ts worker/src/index.ts .env.example tests/worker-env-contract.test.ts
git commit -m "feat(worker): add environment contract and binding validation"
```

### Task 4: Implement LangChain SQL Agent Service (Read-Only Guardrails)

**Files:**
- Create: `worker/src/chat/sqlAgent.ts`
- Create: `worker/src/chat/sqlSafety.ts`
- Create: `worker/src/chat/prompt.ts`
- Create: `tests/sql-safety.test.ts`

**Step 1: Write failing tests for SQL safety rules**

- Reject write/query-dangerous verbs:
  - `insert`, `update`, `delete`, `drop`, `alter`, `truncate`, `grant`, `revoke`, `create`.
- Allow readonly patterns:
  - `select`, `with ... select`, aggregate selects.

**Step 2: Run test to verify fail**

Run: `npm run test -- tests/sql-safety.test.ts`
Expected: FAIL until module exists.

**Step 3: Implement LangChain SQL agent wrapper**

- Initialize model with OpenAI API key + selected model.
- Initialize SQL database connection from `SUPABASE_DB_URL`.
- Constrain prompt/system instructions to read-only analytical behavior.
- Apply explicit SQL safety validator before execution; return guarded error text if rejected.

**Step 4: Run tests**

Run: `npm run test -- tests/sql-safety.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add worker/src/chat/sqlAgent.ts worker/src/chat/sqlSafety.ts worker/src/chat/prompt.ts tests/sql-safety.test.ts
git commit -m "feat(worker): add langchain sql agent with readonly safety guardrails"
```

### Task 5: Wire `POST /api/chat` End-to-End Handler

**Files:**
- Modify: `worker/src/index.ts`
- Create: `worker/src/chat/handler.ts`
- Create: `tests/worker-chat-handler.test.ts`

**Step 1: Write failing handler tests**

- valid payload -> `200 { reply }`
- invalid payload -> `400`
- missing env -> `500` with safe message
- SQL safety rejection -> `422` with safe user-facing message

**Step 2: Run failing tests**

Run: `npm run test -- tests/worker-chat-handler.test.ts`
Expected: FAIL until handler exists.

**Step 3: Implement handler orchestration**

- Parse JSON + validate payload.
- Build stateless context from request messages.
- Invoke SQL agent service.
- Return `{ reply: string }` only.
- No auth checks in this phase.

**Step 4: Re-run tests**

Run: `npm run test -- tests/worker-chat-handler.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add worker/src/index.ts worker/src/chat/handler.ts tests/worker-chat-handler.test.ts
git commit -m "feat(worker): implement /api/chat handler with sql-agent orchestration"
```

### Task 6: Local End-to-End Validation with Frontend Proxy

**Files:**
- Modify: `src/features/chat/chatClient.ts` (only if base URL toggle needed)
- Create: `e2e/chat-backend-local.spec.ts`
- Create: `docs/architecture/chat-backend-v1.md`

**Step 1: Write failing E2E that uses real local `/api/chat`**

- Launch Vite + Wrangler dev.
- Submit chat prompt from UI.
- Assert rendered assistant response from worker.

**Step 2: Run failing E2E**

Run: `npm run test:e2e -- e2e/chat-backend-local.spec.ts`
Expected: FAIL until worker is wired and running with env.

**Step 3: Add practical local runbook**

- Start worker: `npm run worker:dev`
- Start frontend: `npm run dev`
- Example curl to worker endpoint.
- Required env vars and where to set them.

**Step 4: Run E2E and manual curl validation**

Run:

```bash
npm run test:e2e -- e2e/chat-backend-local.spec.ts
curl -i -X POST http://127.0.0.1:8787/api/chat -H 'content-type: application/json' -d '{"messages":[{"role":"user","content":"Who has best win percentage?"}]}'
```

Expected: PASS E2E and `200` JSON reply from curl.

**Step 5: Commit**

```bash
git add e2e/chat-backend-local.spec.ts docs/architecture/chat-backend-v1.md src/features/chat/chatClient.ts
git commit -m "test(worker): validate local frontend-to-worker chat path"
```

### Task 7: Production-Readiness Notes (Deferred Auth)

**Files:**
- Modify: `worker/README.md`
- Modify: `docs/architecture/chat-backend-v1.md`

**Step 1: Document explicitly deferred auth**

- Frontend JWT/session checks deferred.
- Worker JWT verification deferred.
- No anonymous production exposure allowed until auth task lands.

**Step 2: Add next-phase checklist**

- Add Supabase JWT verification middleware in worker.
- Propagate user identity and apply row-level security-aware querying.
- Add request rate limiting and abuse protections.

**Step 3: Commit docs**

```bash
git add worker/README.md docs/architecture/chat-backend-v1.md
git commit -m "docs(worker): add deferred-auth and production hardening checklist"
```

## Explicit Non-Goals (This Plan)

- No frontend or worker auth/JWT enforcement yet.
- No conversation persistence in Supabase yet.
- No streaming/SSE responses yet.
- No deployment cutover to production Cloudflare Worker yet.

## Required Skills During Execution

- `@superpowers/test-driven-development`
- `@superpowers/verification-before-completion`
- `@context-7` (required when implementing LangChain/Workers APIs)
- `@typescript-development`
- `@testing-quality-gate`

## Verification Gate (Before Completion Claim)

Run:

```bash
npm run format:check
npm run lint:check
npm run test
npm run test:coverage
npm run test:e2e
npm run typecheck
```

Expected: all pass, with note that worker-local E2E requires local env vars present.
