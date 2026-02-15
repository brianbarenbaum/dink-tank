# Chat Worker (Local)

## Local Run

1. Set required env vars in shell or `.dev.vars`:
   - `OPENAI_API_KEY`
   - `SUPABASE_DB_URL`
2. Start worker:

```bash
npm run worker:dev
```

The local endpoint is `http://127.0.0.1:8787/api/chat`.

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
