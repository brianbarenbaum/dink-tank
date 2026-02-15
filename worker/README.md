# Chat Worker (Local)

## Local Run

1. Set required env vars in shell or `.dev.vars`:
   - `OPENAI_API_KEY`
   - `SUPABASE_DB_URL` (required only when `HYPERDRIVE` binding is not configured)
   - Optional local TLS workaround: `SUPABASE_DB_SSL_NO_VERIFY=true`
   - Optional for local debugging: `EXPOSE_ERROR_DETAILS=true`
2. Start worker:

```bash
npm run worker:dev
```

The local endpoint is `http://127.0.0.1:8787/api/chat`.

If your local Worker logs TLS trust errors when connecting to Supabase (`self signed certificate in certificate chain`), set `SUPABASE_DB_SSL_NO_VERIFY=true` in `worker/.dev.vars` for local development only.

## Hyperdrive (Recommended for Worker Runtime)

1. Create Hyperdrive in Cloudflare pointing at your Supabase Postgres host.
2. Add the generated binding ID in `worker/wrangler.toml`:
   - `[[hyperdrive]]`
   - `binding = "HYPERDRIVE"`
   - `id = "<your-id>"`
3. Deploy or run remote dev. The worker will prefer `env.HYPERDRIVE.connectionString` automatically.

## Deferred Authentication

- Frontend auth is intentionally not implemented in this phase.
- Worker JWT verification is intentionally not implemented in this phase.
- Do not expose this worker publicly in production until auth and rate limiting are added.

## Production Hardening Checklist (Next Phase)

- Add frontend Supabase session handling and authenticated request forwarding.
- Verify JWT in worker and map request identity to user/role context.
- Enforce read-only DB role and schema allowlist checks.
- Add request rate limits and abuse protection.
- Add structured telemetry for blocked queries and failed tool attempts.
