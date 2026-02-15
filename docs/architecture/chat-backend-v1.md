# Chat Backend v1 (Worker + LangChain SQL)

## Scope

Local-first backend for chat intelligence:

- Cloudflare Worker endpoint: `POST /api/chat`
- LangChain SQL agent
- OpenAI model via API key
- Supabase Postgres via direct DB URL
- Stateless requests (no conversation persistence)
- No auth in this phase

## Request / Response

Request:

```json
{
  "messages": [
    { "role": "user", "content": "Who is leading in win percentage?" }
  ]
}
```

Response:

```json
{
  "reply": "..."
}
```

## Local Runbook

1. Install dependencies:

```bash
npm install
```

2. Set env in shell or `.dev.vars` for worker:

- `OPENAI_API_KEY`
- `SUPABASE_DB_URL`
- Optional: `LLM_MODEL`
- Optional: `SQL_QUERY_TIMEOUT_MS`

3. Start worker:

```bash
npm run worker:dev
```

4. Start frontend (separate terminal):

```bash
npm run dev
```

5. Verify worker endpoint directly:

```bash
curl -i -X POST http://127.0.0.1:8787/api/chat -H 'content-type: application/json' -d '{"messages":[{"role":"user","content":"Who has best win percentage?"}]}'
```

6. Optional local E2E:

```bash
RUN_LOCAL_BACKEND_E2E=1 WORKER_BASE_URL=http://127.0.0.1:8787 npm run test:e2e -- e2e/chat-backend-local.spec.ts
```

## Security Guardrails (Current)

- SQL sanitizer enforces read-only behavior and blocks DML/DDL keywords.
- Worker returns safe error payloads for blocked queries or runtime failures.

## Deferred (Next Phase)

- Frontend auth with Supabase session
- Worker JWT verification and user-bound access control
- Persistent conversation memory in Supabase
- Rate limiting / abuse controls
