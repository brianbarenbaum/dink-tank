# Chat Request Lifecycle

This document describes the live runtime path for `POST /api/chat` and where to debug each class of failure.

## Request Path

1. `worker/src/runtime/index.ts` routes `POST /api/chat`.
2. `worker/src/runtime/handler.ts` parses JSON, validates shape, creates `RequestContext`, maps errors to HTTP status.
3. `worker/src/runtime/sqlAgent.ts` selects catalog context, builds system prompt, invokes model + SQL tool.
4. `worker/src/runtime/sql/sqlExecutor.ts` sanitizes query and executes read-only SQL.
5. `worker/src/observability/langfuseTelemetry.ts` emits best-effort Langfuse trace.

## Sequence Diagram

```mermaid
sequenceDiagram
  participant C as Client
  participant I as runtime/index.ts
  participant H as runtime/handler.ts
  participant V as runtime/validation.ts
  participant S as catalog.selector/context
  participant A as runtime/sqlAgent.ts
  participant Q as sqlExecutor + sqlSafety
  participant DB as Supabase Postgres
  participant L as observability/langfuseTelemetry.ts

  C->>I: POST /api/chat
  I->>H: handleChatRequest(request, env)
  H->>V: parseChatRequest(payload)
  alt invalid payload
    V-->>H: validation error
    H-->>C: 400 invalid_request
  else valid payload
    H->>A: runSqlAgent(env, messages, requestContext)
    A->>S: selectCatalogContext(question, confidenceMin)
    S-->>A: selectedViews + catalogContext + reason
    A->>Q: execute_sql(query)
    Q->>Q: sanitizeSqlQuery()
    alt blocked SQL
      Q-->>A: SqlSafetyError(code)
      A-->>H: error
      H-->>C: 422 query_blocked
    else allowed SQL
      Q->>DB: SELECT/WITH query
      DB-->>Q: rows
      Q-->>A: JSON rows
      A->>L: emitLangfuseTelemetry(best-effort)
      L-->>A: emit result (ok/fail)
      A-->>H: final reply text
      H-->>C: 200 {reply}
    end
  end
```

## Happy Path Flowchart

```mermaid
flowchart LR
  C[Client POST /api/chat] --> I[index.ts route]
  I --> H[handler.ts parse + validate]
  H --> S[catalog selector + context]
  S --> P[build SQL system prompt]
  P --> A[LangChain SQL agent]
  A --> Q[execute_sql tool]
  Q --> DB[(Supabase Postgres)]
  DB --> A
  A --> R[final natural-language reply]
  A --> L[Langfuse trace emit best-effort]
  R --> H
  H --> C2[200 JSON reply]
```

## Error Mapping

- `400 invalid_json`: body is not parseable JSON.
- `400 invalid_request`: payload shape fails validation (`messages` invalid).
- `422 query_blocked`: typed SQL safety violation (`SqlSafetyError`).
- `500 chat_failed`: model/tool/runtime error outside SQL safety.
- `500 misconfigured_env`: required runtime env not present.

## Debugging Guide

- Input validation issues:
  - `worker/src/runtime/validation.ts`
- SQL blocked unexpectedly:
  - `worker/src/runtime/sql/sqlSafety.ts`
  - `worker/src/runtime/sql/sqlErrors.ts`
- Wrong view selection/prompt context:
  - `worker/src/runtime/catalog/catalog.selector.ts`
  - `worker/src/runtime/catalog/catalog.context.ts`
  - `worker/src/runtime/catalog/catalog.data.ts`
- Telemetry missing:
  - `worker/src/observability/langfuseTelemetry.ts`
  - Check warning logs with `message = "langfuse_emit_failed"` and `requestId`.
