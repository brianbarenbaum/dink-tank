# Observability

Files in this directory are runtime telemetry helpers used by the live Worker path.

Current integration: Langfuse trace emission.

## Behavior Contract

- Telemetry is best-effort and must never fail chat responses.
- `emitLangfuseTelemetry(...)` returns a status object:
  - `ok: true` on successful ingestion.
  - `ok: false` with `reason` for disabled/misconfigured/http/network/timeout cases.
- Runtime logs warnings for telemetry failures (`langfuse_emit_failed`) with request correlation metadata.

## Where To Debug

- HTTP status failures from Langfuse ingestion:
  - `worker/src/observability/langfuseTelemetry.ts`
- Missing Langfuse config:
  - `worker/src/runtime/env.ts`
- Request-level correlation:
  - `worker/src/runtime/requestContext.ts`
  - `worker/src/runtime/runtimeLogger.ts`
