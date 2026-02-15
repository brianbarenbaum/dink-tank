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
