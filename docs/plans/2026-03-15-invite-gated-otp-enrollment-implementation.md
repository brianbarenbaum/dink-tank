# Invite-Gated OTP Enrollment Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace open email OTP sign-in with invite-gated first-time enrollment while preserving OTP-only sign-in for already-approved emails and backend-only invite-code management.

**Architecture:** Add a small authorization layer in front of the existing Supabase OTP flow. Use a new login-start preflight endpoint to determine whether an email is already approved, private auth tables for invite codes / approved emails / pending enrollments, worker-side gating for OTP request and verify, and owner-only npm scripts that create or deactivate the single active reusable invite code while storing only its hash. Keep invite-code entry on the login page only when needed; the verify page remains OTP-only.

**Tech Stack:** TypeScript, Vue 3, Pinia, Vitest, Cloudflare Worker runtime, Supabase Postgres, `pg`, npm scripts, Node `crypto`

**Relevant Skills:** @test-driven-development @vue-vite-core @state-management-pinia @typescript-development @testing-quality-gate

**Execution Note:** Run implementation from a dedicated worktree created with @using-git-worktrees before modifying runtime files.

---

### Task 1: Lock the auth contract with worker tests

**Files:**
- Modify: `tests/worker-auth-handler.test.ts`
- Modify: `worker/src/runtime/auth/types.ts`
- Modify: `worker/src/runtime/index.ts`

**Step 1: Add failing login-start tests**

Add handler coverage for a new `POST /api/auth/login/start` flow with request body:

```ts
interface AuthLoginStartBody {
	email: string;
}
```

and response body:

```ts
type AuthLoginStartResponse =
	| { status: "approved" }
	| { status: "invite_required" };
```

Required tests:
- approved email returns `200 { status: "approved" }`
- unapproved email returns `200 { status: "invite_required" }`
- `handleFetch()` recognizes `/api/auth/login/start` as a public auth route

**Step 2: Add failing OTP request / verify invite-gate tests**

Add worker tests proving:
- `handleOtpRequest()` sends OTP for approved emails with no invite code
- `handleOtpRequest()` rejects unapproved emails without invite context
- `handleOtpRequest()` accepts an unapproved email plus a valid active invite code, creates a pending enrollment, and sends OTP
- `handleOtpRequest()` allows resend for an unapproved email when an unexpired pending enrollment already exists
- `handleOtpVerify()` approves an unapproved email only when a pending enrollment exists
- `handleOtpVerify()` rejects unapproved emails with missing or expired pending enrollment
- `handleOtpVerify()` still succeeds when a pending enrollment was created before the active invite code was later deactivated

**Step 3: Run targeted tests to verify failure**

Run:

```bash
npm run test -- tests/worker-auth-handler.test.ts
```

Expected: new auth tests fail because the login-start route, invite-code validation, approved-email checks, and pending-enrollment logic do not exist yet.

**Step 4: Commit the red tests**

```bash
git add tests/worker-auth-handler.test.ts worker/src/runtime/auth/types.ts worker/src/runtime/index.ts
git commit -m "test: lock invite-gated auth contract"
```

### Task 2: Add the private auth tables and constraints

**Files:**
- Create: `supabase/migrations/<timestamp>_add_auth_invite_gate_tables.sql`

**Step 1: Create the invite-code table**

Add `auth_private.auth_invite_codes` with these columns:

```sql
id bigint generated always as identity primary key,
code_hash text not null unique,
active boolean not null default true,
expires_at timestamptz not null,
created_at timestamptz not null default now(),
deactivated_at timestamptz
```

Add:
- partial unique index that allows only one `active = true` row at a time
- index on `(active, expires_at)`

**Step 2: Create approved-email and pending-enrollment tables**

Add:

```sql
create table auth_private.auth_approved_emails (
  email_normalized text primary key,
  approved_at timestamptz not null default now(),
  invite_code_id bigint references auth_private.auth_invite_codes(id)
);

create table auth_private.auth_pending_enrollments (
  email_normalized text primary key,
  invite_code_id bigint not null references auth_private.auth_invite_codes(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
```

Add indexes on:
- `auth_pending_enrollments (expires_at)`
- `auth_approved_emails (approved_at desc)`

**Step 3: Apply the same auth-private protection pattern**

In the migration:
- enable RLS on all three tables
- add deny-all restrictive policies matching the existing `auth_private` tables

**Step 4: Apply the migration and inspect advisors**

Use:
- `mcp__supabase__apply_migration`
- `mcp__supabase__get_advisors`

Expected: migration applies cleanly and no auth-private tables are left without deny-all RLS.

**Step 5: Commit the schema**

```bash
git add supabase/migrations/<timestamp>_add_auth_invite_gate_tables.sql
git commit -m "feat: add auth invite gate tables"
```

### Task 3: Add repository helpers for invite codes, approved emails, and pending enrollments

**Files:**
- Modify: `worker/src/runtime/auth/repository.ts`
- Modify: `worker/src/runtime/auth/types.ts`

**Step 1: Introduce a repository env type**

Refactor repository DB access to use a narrower env contract so both the worker and npm scripts can reuse it:

```ts
interface AuthRepositoryEnv {
	SUPABASE_DB_URL: string;
	SUPABASE_DB_SSL_NO_VERIFY: boolean;
	SQL_QUERY_TIMEOUT_MS: number;
}
```

**Step 2: Add approved-email helpers**

Implement exact repository functions:
- `isApprovedEmail(env, emailNormalized): Promise<boolean>`
- `insertApprovedEmail(env, { emailNormalized, inviteCodeId }): Promise<void>`

**Step 3: Add invite-code helpers**

Implement exact repository functions:
- `findActiveInviteCodeByHash(env, codeHash): Promise<{ id: number; expiresAt: Date } | null>`
- `createInviteCode(env, { codeHash, expiresAt }): Promise<{ id: number; expiresAt: Date }>`
- `deactivateActiveInviteCode(env): Promise<{ id: number } | null>`

`createInviteCode()` must deactivate any currently active code inside the same transaction before inserting the new active row.

**Step 4: Add pending-enrollment helpers**

Implement exact repository functions:
- `getPendingEnrollment(env, emailNormalized): Promise<{ inviteCodeId: number; expiresAt: Date } | null>`
- `upsertPendingEnrollment(env, { emailNormalized, inviteCodeId, expiresAt }): Promise<void>`
- `deletePendingEnrollment(env, emailNormalized): Promise<void>`

Update `cleanupExpiredAuthRecords()` to delete expired rows from `auth_private.auth_pending_enrollments`.

**Step 5: Run the worker auth tests**

Run:

```bash
npm run test -- tests/worker-auth-handler.test.ts
```

Expected: repository-related tests still fail, but missing-function and missing-query failures should be gone.

**Step 6: Commit the repository layer**

```bash
git add worker/src/runtime/auth/repository.ts worker/src/runtime/auth/types.ts
git commit -m "feat: add auth invite gate repository helpers"
```

### Task 4: Add invite-code hashing, normalization, and env plumbing

**Files:**
- Modify: `worker/src/runtime/env.ts`
- Modify: `worker/src/runtime/index.ts`
- Modify: `worker/src/runtime/auth/crypto.ts`
- Modify: `tests/worker-env-contract.test.ts`
- Create: `tests/invite-code-crypto.test.ts`

**Step 1: Add a dedicated invite-code hash secret**

Add `AUTH_INVITE_CODE_HASH_SECRET` to the worker env contract and make it required anywhere auth is enabled. Do not reuse `AUTH_IP_HASH_SALT` for invite codes.

**Step 2: Add invite-code helpers**

Implement:

```ts
export const normalizeInviteCode = (value: string): string => ...
export const hashInviteCode = async (secret: string, value: string): Promise<string> => ...
export const generateInviteCode = (): string => ...
```

Behavior:
- uppercase
- trim whitespace
- remove separators like spaces and hyphens before hashing
- generate a human-shareable grouped code (for example `DTNK-XXXX-XXXX-XXXX`)

**Step 3: Add failing env and crypto tests**

Cover:
- env parsing rejects missing `AUTH_INVITE_CODE_HASH_SECRET`
- normalization treats `dtnk-abcd-1234` and `DTNKABCD1234` as equivalent
- generated invite codes are non-empty, grouped, and hashable

**Step 4: Run focused tests**

Run:

```bash
npm run test -- tests/worker-env-contract.test.ts tests/invite-code-crypto.test.ts
```

Expected: fail first, then pass once env and crypto helpers are implemented.

**Step 5: Commit the env and crypto work**

```bash
git add worker/src/runtime/env.ts worker/src/runtime/index.ts worker/src/runtime/auth/crypto.ts tests/worker-env-contract.test.ts tests/invite-code-crypto.test.ts
git commit -m "feat: add invite code env and crypto helpers"
```

### Task 5: Implement the worker-side invite-gated auth flow

**Files:**
- Modify: `worker/src/runtime/auth/handler.ts`
- Modify: `worker/src/runtime/auth/types.ts`
- Modify: `worker/src/runtime/index.ts`
- Modify: `worker/src/runtime/auth/repository.ts`
- Modify: `tests/worker-auth-handler.test.ts`

**Step 1: Add the login-start handler**

Create `handleAuthLoginStart()` with this contract:

```ts
POST /api/auth/login/start
{ email }
-> 200 { status: "approved" | "invite_required" }
```

Behavior:
- validate email format
- normalize email
- return `approved` if email exists in `auth_approved_emails`
- otherwise return `invite_required`
- no OTP send
- no Turnstile requirement

**Step 2: Extend OTP request input**

Extend request typing to:

```ts
interface OtpRequestBody {
	email: string;
	turnstileToken: string | null;
	inviteCode?: string | null;
}
```

**Step 3: Update OTP request gating**

Implement this exact order in `handleOtpRequest()`:
- validate email and Turnstile only when the request is actually going to send OTP
- if email is approved, send OTP as today
- else if an unexpired pending enrollment already exists for that email, allow resend and send OTP
- else if `inviteCode` is present, normalize and hash it, validate against the one active non-expired invite code, create/update a pending enrollment expiring at `min(now + pending_enrollment_ttl, invite_code.expires_at)`, then send OTP
- else reject generically and do not send OTP

Keep existing OTP request rate limiting and audit logging in place for actual send attempts.

**Step 4: Update OTP verify gating**

Implement this exact order in `handleOtpVerify()`:
- if email is already approved, verify OTP as today
- otherwise require an unexpired pending enrollment before calling Supabase verify
- on successful verify for an unapproved email:
  - insert into `auth_approved_emails`
  - delete the pending enrollment
  - return the session payload and auth cookies
- on failed verify:
  - keep the pending enrollment so resend still works until it expires

**Step 5: Add audit details for invite-gated behavior**

Extend existing auth audit details so failures and approvals are inspectable without inventing a second audit system. At minimum record:
- `invite_required`
- `invite_code_invalid`
- `pending_enrollment_created`
- `approved_email_inserted`

**Step 6: Run targeted worker tests**

Run:

```bash
npm run test -- tests/worker-auth-handler.test.ts tests/worker-env-contract.test.ts tests/invite-code-crypto.test.ts
```

Expected: pass.

**Step 7: Commit the worker flow**

```bash
git add worker/src/runtime/auth/handler.ts worker/src/runtime/auth/types.ts worker/src/runtime/index.ts worker/src/runtime/auth/repository.ts tests/worker-auth-handler.test.ts
git commit -m "feat: gate first-time auth behind invite codes"
```

### Task 6: Lock and implement the frontend login flow

**Files:**
- Create: `tests/auth-login-page.test.ts`
- Modify: `src/features/auth/authClient.ts`
- Modify: `src/features/auth/types.ts`
- Modify: `src/stores/auth.ts`
- Modify: `src/pages/AuthLoginPage.vue`
- Modify: `src/pages/AuthVerifyPage.vue`

**Step 1: Add failing login-page tests**

Add component coverage for:
- initial submit with email only calls login-start first
- `status: "invite_required"` reveals an invite-code field on the login page and does not navigate
- submit with email + invite code calls OTP request and navigates to `/auth/verify` only after OTP is sent
- approved-email flow still navigates directly to `/auth/verify`

**Step 2: Add frontend auth client contract**

Add exact client methods and result types:

```ts
type LoginStartResult = { status: "approved" | "invite_required" };
type OtpRequestResult = { status: "otp_sent"; resendAfterSeconds: number };
```

Required client methods:
- `startLogin({ email })`
- `requestOtp({ email, turnstileToken, inviteCode })`

Only persist `pendingEmail` when OTP was actually sent.

**Step 3: Update the login page flow**

Implement this UX in `src/pages/AuthLoginPage.vue`:
- first submit sends email to `startLogin`
- if approved, continue into existing Turnstile + OTP request flow
- if invite required, reveal a required invite-code input on the same page and keep the user there
- second submit sends email + invite code through the existing Turnstile gate, then routes to `/auth/verify`

**Step 4: Keep the verify page OTP-only**

Do not add an invite-code field to `src/pages/AuthVerifyPage.vue`. Only adjust resend behavior if needed so resend works for a pending enrollment without requiring the invite code again.

**Step 5: Run focused frontend tests**

Run:

```bash
npm run test -- tests/auth-login-page.test.ts tests/router-auth-guard.test.ts tests/smoke.test.ts
```

Expected: new login-page tests fail first, then pass once the auth client, store, and page flow are updated.

**Step 6: Commit the frontend flow**

```bash
git add tests/auth-login-page.test.ts src/features/auth/authClient.ts src/features/auth/types.ts src/stores/auth.ts src/pages/AuthLoginPage.vue src/pages/AuthVerifyPage.vue
git commit -m "feat: add invite-gated login flow"
```

### Task 7: Add owner-only npm commands for invite-code rotation

**Files:**
- Create: `scripts/auth/shared.ts`
- Create: `scripts/auth/invite-create.ts`
- Create: `scripts/auth/invite-deactivate.ts`
- Modify: `package.json`
- Modify: `worker/src/runtime/auth/repository.ts`
- Modify: `worker/src/runtime/auth/crypto.ts`

**Step 1: Add a minimal script env parser**

In `scripts/auth/shared.ts`, parse only the values the scripts need:

```ts
SUPABASE_DB_URL
SUPABASE_DB_SSL_NO_VERIFY
SQL_QUERY_TIMEOUT_MS (default 25000)
AUTH_INVITE_CODE_HASH_SECRET
```

Do not reuse the full worker env parser because it requires unrelated runtime secrets like `OPENAI_API_KEY`.

**Step 2: Implement create command**

`scripts/auth/invite-create.ts` should:
- require `--expires-at <ISO-8601>`
- generate a new invite code with `generateInviteCode()`
- hash it with `AUTH_INVITE_CODE_HASH_SECRET`
- deactivate the existing active code in the same transaction
- insert the new active code
- print the plaintext code exactly once plus the expiration timestamp

Expose it as:

```bash
npm run auth:invite:create -- --expires-at 2026-04-01T00:00:00Z
```

**Step 3: Implement deactivate command**

`scripts/auth/invite-deactivate.ts` should:
- deactivate the one active code if present
- print whether a code was deactivated or there was nothing active

Expose it as:

```bash
npm run auth:invite:deactivate
```

**Step 4: Add targeted script coverage where practical**

If the create/deactivate logic grows beyond a few lines, extract the command core into testable functions and cover them with Vitest. If the scripts remain thin wrappers, keep automated coverage focused on the shared crypto/repository layer and document manual command verification instead of adding brittle script tests.

**Step 5: Commit the script layer**

```bash
git add scripts/auth/shared.ts scripts/auth/invite-create.ts scripts/auth/invite-deactivate.ts package.json worker/src/runtime/auth/repository.ts worker/src/runtime/auth/crypto.ts
git commit -m "feat: add invite code management commands"
```

### Task 8: Document the operational flow and env requirements

**Files:**
- Create: `docs/operations/auth-invite-codes.md`
- Modify: `worker/README.md`
- Modify: `.codex/memories/repo-map.md` (only if runtime entry points materially change)

**Step 1: Add the invite-code operations runbook**

Document:
- required env vars for npm commands
- create command example
- deactivate command example
- rule that only one active code exists at a time
- rule that deactivating a code does not affect already-approved emails
- rule that in-progress pending enrollments can finish until their short TTL expires

**Step 2: Update worker auth docs**

Add:
- `AUTH_INVITE_CODE_HASH_SECRET`
- new public endpoint `POST /api/auth/login/start`
- revised login flow summary

Update `.codex/memories/repo-map.md` only if you decide the new auth start route is important enough to add to the stable debugging guide.

**Step 3: Commit docs**

```bash
git add docs/operations/auth-invite-codes.md worker/README.md .codex/memories/repo-map.md
git commit -m "docs: add invite code auth operations runbook"
```

### Task 9: Run automated and manual verification

**Files:**
- None

**Step 1: Run focused automated suites**

Run:

```bash
npm run test -- tests/worker-auth-handler.test.ts tests/worker-env-contract.test.ts tests/invite-code-crypto.test.ts tests/auth-login-page.test.ts tests/router-auth-guard.test.ts tests/smoke.test.ts
```

Expected: pass.

**Step 2: Run repo-required verification**

Run:

```bash
npm run format:check
npm run lint:check
npm run typecheck
npm run test
npm run test:coverage
npm run test:e2e
```

Expected: all pass. If auth E2E remains manual-only, existing E2E suites must still pass unchanged.

**Step 3: Perform manual auth verification with a real Supabase project**

Prereqs:
- local worker env includes `AUTH_INVITE_CODE_HASH_SECRET`
- Turnstile bypass enabled locally if needed
- one active invite code created via npm command

Run:

```bash
npm run worker:dev
npm run dev
```

Manual checks:
- existing approved email path: email -> OTP send -> verify page -> sign in without invite field
- new email path: email -> invite-code prompt -> valid invite -> OTP send -> verify page -> sign in -> second login no longer asks for invite code
- invalid invite path: OTP is not sent and approval is not granted
- code deactivation path: new unapproved email can no longer begin enrollment
- in-progress path: start enrollment, deactivate the code, then finish enrollment successfully with the already-issued OTP within the pending-enrollment TTL

**Step 4: Record verification outcomes in branch memory**

Update:
- `.codex/memories/active-branches/<branch>.md`

Include:
- commands actually run
- whether manual auth verification passed
- any remaining risks or follow-ups

**Step 5: Final commit**

```bash
git status --short
```

Confirm only intended files changed, then commit the final implementation batch.
