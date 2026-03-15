# Branch: login-passcode

## Goal

Restrict the existing Supabase email OTP login flow to a small invited group without adding per-user passwords.

## Current Status

- Invite-gated first-time enrollment is implemented.
- Approved emails continue to sign in with email OTP only.
- First-time emails must pass `POST /api/auth/login/start`, submit the active invite code, and then complete OTP verification.
- Exactly one active reusable invite code is supported at a time.
- Invite management is backend-only through npm commands.

## Implemented Changes

- Worker auth flow
  - Added `POST /api/auth/login/start`
  - Added invite-gated OTP request handling
  - Added pending-enrollment support so invite validation happens before OTP send
  - Added approved-email insertion on successful first-time OTP verify
- Database
  - Added `auth_private.auth_invite_codes`
  - Added `auth_private.auth_approved_emails`
  - Added `auth_private.auth_pending_enrollments`
  - Applied deny-all RLS to the new auth-private tables
- Frontend
  - Login page now performs login-start first
  - Invite-code field appears only for unapproved emails
  - Verify page remains OTP-only
- Ops tooling
  - Added `npm run auth:invite:create -- --expires-at <ISO>`
  - Added `npm run auth:invite:deactivate`
  - Added invite-code operations runbook
  - `auth:invite:create` now defaults expiration to 30 days when `--expires-at` is omitted
  - Invite scripts now read `$HOME/.config/dink-tank/env`, create it if needed, seed `AUTH_INVITE_CODE_HASH_SECRET` when missing, and use it immediately in the same run
  - Invite scripts now accept either `SUPABASE_DB_URL` or `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` for database access, matching the local worker setup
  - When invite scripts fall back to `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`, they now default `SUPABASE_DB_SSL_NO_VERIFY=true` unless explicitly overridden, matching the existing local Supabase TLS workaround
  - `npm run worker:dev` now runs through `scripts/worker-dev.ts`, which syncs `AUTH_INVITE_CODE_HASH_SECRET` into the real worker dev vars file before starting Wrangler
  - Local runtime continues to prefer Hyperdrive; the incorrect direct-URL preference change was reverted
  - Auth repository now honors `SQL_QUERY_TIMEOUT_MS` directly and retries transient auth read failures once
  - Runbook documents the auto-seeding flow plus the manual fallback for `AUTH_INVITE_CODE_HASH_SECRET`

## Key Files

- `worker/src/runtime/auth/handler.ts`
- `worker/src/runtime/auth/repository.ts`
- `worker/src/runtime/auth/crypto.ts`
- `worker/src/runtime/env.ts`
- `worker/src/runtime/index.ts`
- `src/pages/AuthLoginPage.vue`
- `src/stores/auth.ts`
- `scripts/auth/invite-create.ts`
- `scripts/auth/invite-deactivate.ts`
- `supabase/migrations/20260315122000_add_auth_invite_gate_tables.sql`
- `docs/operations/auth-invite-codes.md`

## Verification

Automated verification completed successfully:

- `npm run test -- tests/worker-auth-handler.test.ts tests/worker-env-contract.test.ts tests/invite-code-crypto.test.ts tests/auth-login-page.test.ts tests/router-auth-guard.test.ts tests/smoke.test.ts`
- `npm run format:check`
- `npm run lint:check`
- `npm run typecheck`
- `npm run test`

Follow-up verification after the ops tweak:

- `npm run test -- tests/auth-invite-script-helpers.test.ts`
- `npm run test -- tests/auth-repository-timeout.test.ts`
- `npm run test -- tests/worker-auth-handler.test.ts`
- `npm run format:check`
- `npm run typecheck`
- escalated non-mutating DB check using `loadAuthScriptEnv()` + `isApprovedEmail()` confirmed the updated loader reaches the real Supabase pooler successfully with `sslNoVerify=true`
- escalated sync check confirmed `/home/brian/.config/dink-tank/worker.dev.vars` now contains `AUTH_INVITE_CODE_HASH_SECRET=...`

Results:

- `format:check` passed
- `lint:check` passed
- `typecheck` passed
- `npm run test` passed with `63` files and `318` tests green

## Remaining Work / Risks

- Manual end-to-end verification with a real Supabase project is still pending:
  - create invite code
  - first-time enrollment with invite code + email OTP
  - repeat login for approved email with OTP only
  - deactivate invite code and confirm approved email still logs in while new enrollment is blocked

## Linked Artifacts

- Plan: `docs/plans/2026-03-15-invite-gated-otp-enrollment-implementation.md`
- Plan: `docs/plans/2026-03-15-local-worker-db-transport-stabilization.md`
- Runbook: `docs/operations/auth-invite-codes.md`

## Follow-up Direction

- Current debugging conclusion: local timeout instability is in the local Worker DB transport path, not the auth SQL.
- The direct-DB local stabilization experiment was rolled back at the user's request.
- Current local-development direction is to keep using Hyperdrive locally and work around the unstable connection behavior for now.
- New execution plan saved at `docs/plans/2026-03-15-local-worker-db-transport-stabilization.md`.
- Current blocker:
  - local Hyperdrive-backed Worker development remains unstable
  - the reverted direct-DB local experiment had failed consistently with `Connection terminated unexpectedly` while plain Node `pg` to the same URL remained stable
- Rollback checkpoint:
  - runtime DB selection restored to Hyperdrive-first behavior
  - `worker:dev` no longer backfills Hyperdrive env vars from direct DB URLs
  - docs no longer describe direct DB URLs as the default local-development path
