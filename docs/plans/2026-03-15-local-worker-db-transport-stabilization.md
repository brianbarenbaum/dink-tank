# Local Worker DB Transport Stabilization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stabilize local Worker development by removing the default dependency on Hyperdrive for local database access while leaving deployed environment behavior unchanged.

**Architecture:** Local Wrangler development should use direct database URLs from `.dev.vars` instead of `env.HYPERDRIVE.connectionString`. This keeps the local Worker on the simplest proven-stable path: `local Worker -> Supabase connection string`, while staging/production continue to prefer Hyperdrive. Keep the change focused on runtime DB selection and local developer workflow; do not change production transport behavior in this plan.

**Tech Stack:** Cloudflare Workers, Wrangler, TypeScript, `pg`, Vitest, Supabase Postgres

---

## Scope And Assumptions

- Local stabilization means `APP_ENV=local` Worker requests should use `SUPABASE_DB_URL` and `CHAT_SUPABASE_DB_URL` directly.
- The initial local target is the already-proven connection string in `.dev.vars`, which currently points at Supabase’s pooler host.
- Production and staging should continue to prefer Hyperdrive bindings.
- Do not redesign app-side pooling in this plan.
- Do not change SQL behavior, auth behavior, or database schema in this plan.

### Task 1: Lock The Intended Local Routing In Tests

**Files:**
- Modify: `tests/worker-chat-handler.test.ts`

**Step 1: Write the failing test**

Add a test that proves local env prefers direct URLs over Hyperdrive:

```ts
it("prefers direct database urls in local even when Hyperdrive bindings exist", () => {
  const urls = resolveRuntimeDatabaseUrls({
    APP_ENV: "local",
    HYPERDRIVE: {
      connectionString: "postgres://shared-hyperdrive@localhost:5432/postgres",
    },
    CHAT_HYPERDRIVE: {
      connectionString: "postgres://chat-hyperdrive@localhost:5432/postgres",
    },
    SUPABASE_DB_URL: "postgres://shared-direct@localhost:5432/postgres",
    CHAT_SUPABASE_DB_URL: "postgres://chat-direct@localhost:5432/postgres",
  });

  expect(urls.supabaseDbUrl).toBe(
    "postgres://shared-direct@localhost:5432/postgres",
  );
  expect(urls.chatSupabaseDbUrl).toBe(
    "postgres://chat-direct@localhost:5432/postgres",
  );
});
```

Add a second test that proves non-local env still prefers Hyperdrive:

```ts
it("continues to prefer Hyperdrive outside local", () => {
  const urls = resolveRuntimeDatabaseUrls({
    APP_ENV: "production",
    HYPERDRIVE: {
      connectionString: "postgres://shared-hyperdrive@localhost:5432/postgres",
    },
    CHAT_HYPERDRIVE: {
      connectionString: "postgres://chat-hyperdrive@localhost:5432/postgres",
    },
    SUPABASE_DB_URL: "postgres://shared-direct@localhost:5432/postgres",
    CHAT_SUPABASE_DB_URL: "postgres://chat-direct@localhost:5432/postgres",
  });

  expect(urls.supabaseDbUrl).toBe(
    "postgres://shared-hyperdrive@localhost:5432/postgres",
  );
  expect(urls.chatSupabaseDbUrl).toBe(
    "postgres://chat-hyperdrive@localhost:5432/postgres",
  );
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tests/worker-chat-handler.test.ts
```

Expected: the new local-preference assertion fails because `resolveRuntimeDatabaseUrls()` currently prefers Hyperdrive unconditionally.

**Step 3: Commit**

```bash
git add tests/worker-chat-handler.test.ts
git commit -m "test: capture local direct db preference"
```

### Task 2: Implement Local Direct DB Resolution

**Files:**
- Modify: `worker/src/runtime/index.ts`
- Test: `tests/worker-chat-handler.test.ts`

**Step 1: Write minimal implementation**

Update `resolveRuntimeDatabaseUrls()` so it checks `APP_ENV` first:

```ts
const isLocal = env.APP_ENV?.trim().toLowerCase() === "local";

if (isLocal) {
  return {
    supabaseDbUrl: env.SUPABASE_DB_URL ?? env.HYPERDRIVE?.connectionString,
    chatSupabaseDbUrl:
      env.CHAT_SUPABASE_DB_URL ??
      env.CHAT_HYPERDRIVE?.connectionString,
  };
}

return {
  supabaseDbUrl: env.HYPERDRIVE?.connectionString ?? env.SUPABASE_DB_URL,
  chatSupabaseDbUrl:
    env.CHAT_HYPERDRIVE?.connectionString ?? env.CHAT_SUPABASE_DB_URL,
};
```

Keep the fallback to Hyperdrive in local only if a direct URL is absent, so the function stays robust for incomplete local envs.

**Step 2: Run test to verify it passes**

Run:

```bash
npm run test -- tests/worker-chat-handler.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add worker/src/runtime/index.ts tests/worker-chat-handler.test.ts
git commit -m "feat: use direct db urls in local worker runtime"
```

### Task 3: Remove Local Hyperdrive Startup Coupling

**Files:**
- Modify: `package.json`
- Modify: `scripts/worker-dev.ts`
- Modify: `worker/README.md`

**Step 1: Write the failing workflow check**

Document the intended local workflow before editing code:

- `npm run worker:dev` should work when `.dev.vars` contains direct DB URLs and does not rely on `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`.
- `worker:dev` should continue to sync `AUTH_INVITE_CODE_HASH_SECRET` into the worker dev vars file if that helper is still needed.

No new automated test is required here; this task is validated with a manual runtime check after implementation.

**Step 2: Write minimal implementation**

Simplify local startup so routine local dev no longer depends on Hyperdrive env export behavior:

- If `scripts/worker-dev.ts` remains, keep only the secret-sync behavior that is actually needed for local auth.
- Do not require it to bootstrap local Hyperdrive env vars.
- Update `package.json` only if the startup command needs to change to make local behavior obvious and predictable.

**Step 3: Run the local startup check**

Run:

```bash
npm run worker:dev
```

Expected:

- Wrangler starts without requiring `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`
- local Worker binds to `127.0.0.1:8787`
- no Hyperdrive-local bootstrap error appears

**Step 4: Commit**

```bash
git add package.json scripts/worker-dev.ts worker/README.md
git commit -m "chore: decouple local worker startup from hyperdrive"
```

### Task 4: Update Local Runtime Documentation

**Files:**
- Modify: `worker/README.md`
- Modify: `docs/operations/auth-invite-codes.md`
- Modify: `docs/architecture/chat-backend-v1.md`

**Step 1: Write the documentation changes**

Update docs so they say:

- routine local development uses direct DB URLs
- Hyperdrive remains the preferred deployed transport
- `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` is optional and no longer required for normal local app development
- auth invite scripts can still operate with direct DB URLs

Add a short local env example:

```bash
SUPABASE_DB_URL=postgresql://<supabase-pooler-or-direct-host>
CHAT_SUPABASE_DB_URL=postgresql://<optional-chat-url>
SUPABASE_DB_SSL_NO_VERIFY=true
APP_ENV=local
```

**Step 2: Review the docs for consistency**

Check that no doc still claims Hyperdrive local is the routine default for app development.

**Step 3: Commit**

```bash
git add worker/README.md docs/operations/auth-invite-codes.md docs/architecture/chat-backend-v1.md
git commit -m "docs: document direct db local worker development"
```

### Task 5: Verify Local Runtime End To End

**Files:**
- Verify runtime behavior only

**Step 1: Start the local Worker**

Run:

```bash
npm run worker:dev
```

Expected: local Worker starts cleanly with direct DB URLs.

**Step 2: Run repeated login-start requests**

Run:

```bash
node -e 'const run=async()=>{for(let i=0;i<5;i+=1){const started=Date.now();const r=await fetch("http://127.0.0.1:8787/api/auth/login/start",{method:"POST",headers:{"content-type":"application/json","origin":"http://localhost:5173"},body:JSON.stringify({email:`local-check-${i}@example.com`})});console.log(JSON.stringify({i,status:r.status,duration_ms:Date.now()-started,body:await r.text()}));}};run().catch((err)=>{console.error(err);process.exit(1);});'
```

Expected:

- all 5 requests return `200`
- no alternating `Query read timeout`
- durations stay in the sub-second range

**Step 3: Run targeted automated verification**

Run:

```bash
npm run test -- tests/worker-chat-handler.test.ts tests/worker-auth-handler.test.ts tests/data-browser-handler.test.ts tests/lineup-lab-handler.test.ts
npm run typecheck
npm run format:check
```

Expected: PASS

**Step 4: Run full verification**

Run:

```bash
npm run test
```

Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "test: verify stable local direct db worker runtime"
```

## Out Of Scope

- Changing deployed environment transport
- Changing Hyperdrive production configuration
- Reworking app-side `pg.Pool` usage for production
- Migrating the app to Supabase HTTP APIs
- Replacing Supabase pooler with a local database clone

## Success Criteria

- Local `worker:dev` no longer depends on Hyperdrive for normal app development.
- Repeated local `login/start` requests stop alternating between success and timeout.
- Auth, chat, data browser, and lineup-lab all continue to use the same local direct DB transport path.
- Production and staging still prefer Hyperdrive bindings.
