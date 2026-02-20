# Runtime

Files in this directory are the live request path for `POST /api/chat`.

Entry point: `worker/src/runtime/index.ts`.

## Core Flow

1. `index.ts`: routes and environment parsing.
2. `handler.ts`: request parsing + validation + HTTP error mapping.
3. `sqlAgent.ts`: catalog selection, prompt build, agent invoke, telemetry call.
4. `sql/`: read-only SQL safety and execution modules.
5. `catalog/`: catalog data, selection logic, and context serializer.

## File Map

- `env.ts`: parse/validate Worker environment vars.
- `requestContext.ts`: per-request correlation fields (`requestId`, `startMs`, `path`).
- `runtimeLogger.ts`: structured request-scoped logs.
- `validation.ts`: API payload validation.
- `prompt.ts`: SQL system prompt contract.
- `sql/sqlErrors.ts`: typed SQL safety errors.
- `sql/sqlSafety.ts`: read-only SQL sanitizer.
- `sql/sqlExecutor.ts`: pooled DB execution for sanitized SQL.
- `catalog/catalog.data.ts`: static AI catalog entries.
- `catalog/catalog.selector.ts`: ranking + confidence gating.
- `catalog/catalog.context.ts`: prompt context builder.
- `catalog/catalog.ts`: compatibility export barrel.

## Debug Pointers

- Unexpected `422 query_blocked`: inspect `sql/sqlSafety.ts`.
- Unexpected selected views: inspect `catalog/catalog.selector.ts`.
- Prompt context missing columns/samples: inspect `catalog/catalog.context.ts`.
- Missing telemetry: inspect logs for `langfuse_emit_failed` with `requestId`.

## Lifecycle Doc

See `worker/docs/request-lifecycle.md` for the full sequence diagram and error map.
