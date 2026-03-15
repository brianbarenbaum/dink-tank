# Invite Code Operations

This app uses invite-gated first-time enrollment on top of Supabase email OTP:

- Already-approved emails sign in with email OTP only.
- First-time emails must present the current invite code before the Worker will send an OTP.
- Only one invite code can be active at a time.
- Deactivating an invite code does not remove access from already-approved emails.
- In-progress enrollments can still finish until their short pending-enrollment TTL expires.

## Required Environment Variables

The backend-only npm commands read from `$HOME/.config/dink-tank/env` first, then fall back to the current shell environment.

They require:

- `SUPABASE_DB_URL`, or
- `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`
- `AUTH_INVITE_CODE_HASH_SECRET`

When the scripts fall back to `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`, they also default `SUPABASE_DB_SSL_NO_VERIFY=true` unless you explicitly set `SUPABASE_DB_SSL_NO_VERIFY` yourself. This matches the existing local Worker TLS workaround for Supabase.

## Invite Hash Secret

On the first `npm run auth:invite:create`, the script will:

1. Open `$HOME/.config/dink-tank/env`
2. Create the file if it does not exist
3. Generate `AUTH_INVITE_CODE_HASH_SECRET` if it is missing
4. Append it to that file and use it immediately in the same run

So the normal admin workflow is just:

```bash
npm run auth:invite:create
```

If you ever need to create the secret manually, use:

```bash
openssl rand -hex 32
```

And store it in:

```bash
AUTH_INVITE_CODE_HASH_SECRET=<paste-generated-secret>
```

inside `$HOME/.config/dink-tank/env`.

This must remain stable for the environment. Do not regenerate it for each invite code, because the Worker and the npm scripts both need the same value to hash and verify invite codes consistently.

Optional:

- `SUPABASE_DB_SSL_NO_VERIFY=true`
  Use only for local TLS workarounds.
- `SQL_QUERY_TIMEOUT_MS=25000`
  Defaults to `25000`.

## Create Or Rotate The Active Code

Create a new reusable invite code and automatically deactivate the previous active code:

```bash
npm run auth:invite:create
```

Or override the default expiration:

```bash
npm run auth:invite:create -- --expires-at 2026-04-01T00:00:00Z
```

If `--expires-at` is omitted, the command defaults to `30` days from the time it runs.

Behavior:

- `--expires-at`, when provided, must be a future ISO-8601 timestamp.
- The command prints the plaintext invite code exactly once.
- Only the hash is stored in the database.
- The newly created code becomes the only active code.

## Deactivate The Active Code

Deactivate the one active invite code, if present:

```bash
npm run auth:invite:deactivate
```

Behavior:

- New first-time enrollments stop immediately.
- Already-approved emails can still sign in with OTP.
- Pending enrollments that already passed invite validation can still finish until their pending enrollment expires.

## Login Flow Summary

1. User enters an email on `/auth/login`.
2. Worker checks `POST /api/auth/login/start`.
3. If the email is approved, the client requests OTP immediately.
4. If the email is not approved, the login page reveals the invite-code field.
5. After a valid invite code is submitted, the Worker creates a short-lived pending enrollment and sends OTP.
6. The verify page accepts OTP only.
7. Successful OTP verification inserts the email into the approved-email list and clears the pending enrollment.
