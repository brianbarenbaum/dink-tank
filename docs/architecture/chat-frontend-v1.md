# Chat Frontend v1 Architecture

## Scope

This document defines the v1 chat frontend behavior for the Cross Club Pickleball assistant UI.

- UI target: desktop + mobile terminal-inspired chat interface
- Transport mode: request-response only (non-streaming)
- Persistence mode: in-memory session state only (no localStorage)
- API integration: real frontend call to `POST /api/chat`

## API Contract

Endpoint: `POST /api/chat`

Request body:

```json
{
  "messages": [
    { "role": "user", "content": "Show me Team A win rate" },
    { "role": "assistant", "content": "Team A is at 62%" }
  ]
}
```

Response body:

```json
{
  "reply": "Team A has a 62% mixed doubles win rate over the last six matches."
}
```

## Auth Placeholder

Frontend transport supports an optional bearer token header:

- `Authorization: Bearer <supabase_access_token>`

Current implementation uses a placeholder token provider and is ready to connect to Supabase session retrieval later.

## State Model

- Chat messages and sending state are handled in frontend session memory.
- Data is reset on page refresh.
- `localStorage` is intentionally not used.

## Deferred Work

- Streaming chat transport and progressive token rendering
- Supabase-backed conversation persistence and retrieval
- Worker-side LangChain SQL agent/model integration
