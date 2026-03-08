# Chat SQL Allowlist Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce chat-only SQL relation allowlisting with `422 query_blocked` responses while leaving lineup-lab behavior unchanged.

**Architecture:** Add relation allowlist enforcement inside the shared SQL executor behind an explicit opt-in flag so chat can enable it and lineup-lab can continue using its own repository/query path without allowlist checks. Reuse the existing approved-relations inventory and relation parser, and surface blocked relation access through the existing `SqlSafetyError` pathway.

**Tech Stack:** TypeScript, Vitest, Cloudflare Worker runtime, `pg`, `node-sql-parser`

---

### Task 1: Lock the intended behavior with tests

**Files:**
- Modify: `tests/sql-executor-logging.test.ts`
- Modify: `tests/worker-chat-handler.test.ts`

**Step 1: Write failing executor tests**

Add a test proving `executeReadOnlySqlRows()` rejects a read-only query that references a non-allowlisted relation when allowlisting is enabled, and a companion test proving the same query still runs when allowlisting is disabled.

**Step 2: Run targeted tests to verify failure**

Run:
```bash
npm run test -- tests/sql-executor-logging.test.ts tests/worker-chat-handler.test.ts
```

Expected: new tests fail because the executor does not yet enforce relation allowlisting.

### Task 2: Implement chat-only allowlist enforcement

**Files:**
- Modify: `worker/src/runtime/sql/sqlErrors.ts`
- Modify: `worker/src/runtime/sql/sqlExecutor.ts`
- Modify: `worker/src/runtime/handler.ts`

**Step 1: Add a typed SQL safety error code**

Add a new `SqlSafetyErrorCode` for non-allowlisted relation access so blocked relation checks travel through the existing typed safety-error path.

**Step 2: Add executor allowlist support**

Teach `executeReadOnlySqlRows()` / `executeReadOnlySql()` to accept an optional relation-allowlist mode. When enabled, parse referenced relations and reject any query that touches relations outside the approved set before opening the DB query.

**Step 3: Preserve chat-only scope**

Keep the default executor behavior unchanged. Update only chat’s runtime path to enable relation allowlisting. Do not route lineup-lab through this enforcement.

### Task 3: Verify 422 response mapping

**Files:**
- Modify: `tests/worker-chat-handler.test.ts`

**Step 1: Add/adjust handler coverage**

Verify blocked non-allowlisted relations return `422 query_blocked`, matching the existing SQL safety failure behavior.

**Step 2: Run targeted tests**

Run:
```bash
npm run test -- tests/sql-executor-logging.test.ts tests/worker-chat-handler.test.ts tests/sql-approved-relations.test.ts tests/sql-relation-parser-evaluation.test.ts
```

Expected: all pass.

### Task 4: Final validation

**Files:**
- None

**Step 1: Run focused regression checks**

Run:
```bash
npm run test -- tests/sql-executor-logging.test.ts tests/worker-chat-handler.test.ts tests/sql-approved-relations.test.ts tests/sql-relation-parser-evaluation.test.ts tests/sql-safety.test.ts
```

Expected: pass with no lineup-lab regressions introduced.
