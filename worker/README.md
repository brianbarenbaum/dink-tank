# Chat Worker (Local)

## Local Run

1. Set required env vars in shell or `.dev.vars`:
   - `OPENAI_API_KEY`
   - `SUPABASE_DB_URL` (required only when `HYPERDRIVE` binding is not configured)
   - Optional reasoning default when extended thinking is enabled: `LLM_REASONING_LEVEL=low|medium|high` (default `medium`)
   - Optional local TLS workaround: `SUPABASE_DB_SSL_NO_VERIFY=true`
   - Optional for local debugging: `EXPOSE_ERROR_DETAILS=true`
2. Start worker:

```bash
npm run worker:dev
```

The local endpoint is `http://127.0.0.1:8787/api/chat`.

If your local Worker logs TLS trust errors when connecting to Supabase (`self signed certificate in certificate chain`), set `SUPABASE_DB_SSL_NO_VERIFY=true` in `worker/.dev.vars` for local development only.

### Recommended Hyperdrive Local Development (No `--remote`)

For day-to-day local development, use local Wrangler runtime with a Hyperdrive local connection string. This still connects to your remote Supabase database, but avoids the extra latency and instability of remote preview mode.

1. Export a Hyperdrive local connection string in your shell:

```bash
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgresql://<user>:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require"
```

2. Run local dev without `--remote`:

```bash
npx wrangler dev --config worker/wrangler.toml
```

Why this is recommended:
- It keeps the Worker runtime local for fast feedback loops.
- It still uses your remote Supabase Postgres instance.
- It avoids remote-preview transport issues that can produce long request stalls during local debugging.

## Code Map

- `worker/src/runtime/` is the live `/api/chat` runtime path.
- `worker/src/observability/` contains runtime telemetry helpers.
- `worker/eval/` contains eval-only runners, libs, datasets, and artifacts.
- `worker/docs/request-lifecycle.md` documents the runtime request flow and error mapping.

## Hyperdrive (Recommended for Worker Runtime)

1. Create Hyperdrive in Cloudflare pointing at your Supabase Postgres host.
2. Add the generated binding ID in `worker/wrangler.toml`:
   - `[[hyperdrive]]`
   - `binding = "HYPERDRIVE"`
   - `id = "<your-id>"`
3. Deploy for production usage. Remote dev remains available for targeted troubleshooting. The worker will prefer `env.HYPERDRIVE.connectionString` automatically.

Notes:
- Use local runtime + `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` for routine development.
- If you explicitly need remote preview behavior for debugging, `wrangler dev --remote` remains available.

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

## Golden Eval Runner (Langfuse Dataset)

Run all 30 golden questions from your Langfuse dataset and link outputs as a dataset run:

```bash
npm run eval:golden
```

Run bounded optimization loops (max 5 loops per run) that evaluate, capture low-score failures, and apply guarded prompt-hint updates:

```bash
npm run eval:optimize
```

Required env vars for the runner:
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL`
- `OPENAI_API_KEY` (recommended for LLM-as-a-Judge evaluator; otherwise heuristic fallback is used)

Optional env vars:
- `LANGFUSE_TRACING_ENVIRONMENT` (default `default`)
- `CHAT_EVAL_API_URL` (default `http://127.0.0.1:8787/api/chat`)
- `EVAL_DATASET_NAME` (default `golden_30`)
- `EVAL_RUN_NAME` (default timestamped)
- `EVAL_RUN_DESCRIPTION`
- `EVAL_REQUEST_TIMEOUT_MS` (default `60000`)
- `EVAL_EXPECTED_ITEM_COUNT` (default `30`)
- `EVAL_DATASET_LIMIT` (optional, positive integer; runs first N items only, e.g. `10` or `15`)
- `EVAL_MAX_CONCURRENCY` (default `1`)
- `EVAL_EXPERIMENT_NAME` (default `golden_30_eval`)
- `EVAL_JUDGE_MODEL` (default `gpt-4.1-mini`)

Optimization runner optional env vars:
- `EVAL_OPTIMIZE_MAX_LOOPS` (default `5`, hard-capped to `5`)
- `EVAL_OPTIMIZE_TARGET_SCORE` (default `0.85`)
- `EVAL_OPTIMIZE_MIN_DELTA` (default `0.02`)
- `EVAL_OPTIMIZE_MAX_PATCHES_PER_LOOP` (default `3`)
- `EVAL_OPTIMIZE_AUTO_APPLY` (default `true`)

Optimization artifacts are written to:
- `worker/eval/artifacts/<run-name>/loop-<n>-raw.json`
- `worker/eval/artifacts/<run-name>/loop-<n>-analysis.json`
- `worker/eval/artifacts/<run-name>/leaderboard.json`
