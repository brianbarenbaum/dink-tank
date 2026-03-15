# Repository Map

This file is the stable architecture and debugging map for the repo. It should answer, "Where do I start looking?" without becoming a file-by-file inventory.

## Application Shape

- Frontend bootstraps in `src/main.ts`
- Global route shell lives in `src/pages/ProtectedShellPage.vue`
- Router and auth gating live in `src/router/index.ts`
- Root app is intentionally thin in `src/App.vue`

The authenticated shell currently exposes three main tabs:

1. Chat
2. Data Browser
3. Lineup Lab

## Frontend Entry Points

### Auth

- Pages:
  - `src/pages/AuthLoginPage.vue`
  - `src/pages/AuthVerifyPage.vue`
- Store:
  - `src/stores/auth.ts`
- Client:
  - `src/features/auth/authClient.ts`
- Worker auth runtime:
  - `worker/src/runtime/auth/handler.ts`
  - `worker/src/runtime/auth/repository.ts`

Use these when debugging login redirects, login-start invite gating, OTP flows, local auth bypass, session bootstrap, or 401 retry behavior.

### Chat

- Controller:
  - `src/features/chat/useChatController.ts`
- Transport/client:
  - `src/features/chat/chatClient.ts`
  - `src/features/chat/useChatTransport.ts`
- Main UI:
  - `src/features/chat/components/ChatShell.vue`
  - `src/features/chat/components/ChatTranscript.vue`
  - `src/features/chat/components/ChatComposer.vue`

Use these for transcript behavior, send flow, model label, extended thinking toggle, or chat rendering issues.

### Data Browser

- Controller:
  - `src/features/chat/data-browser/useDataBrowserController.ts`
- Client:
  - `src/features/chat/data-browser/chatDataBrowserClient.ts`
- Sidebar tree:
  - `src/features/chat/components/DataBrowserTree.vue`
  - `src/features/data-browser/components/DataBrowserSidebarContent.vue`
- Main panel:
  - `src/features/data-browser/components/DataBrowserTabShell.vue`

Use these for season/division/team tree loading, direct-query cards, pagination/sorting, and tab-separated data-browser behavior.

### Lineup Lab

- Controller:
  - `src/features/lineup-lab/useLineupLabController.ts`
- Client:
  - `src/features/lineup-lab/lineupLabClient.ts`
- Main panel:
  - `src/features/lineup-lab/components/LineupLabTabShell.vue`
- Supporting UI:
  - `src/features/lineup-lab/components/*`

Use these for availability selection, known-opponent assignments, calculate flow, and roster/sidebar parity issues.

## Worker Runtime

- Worker entrypoint:
  - `worker/src/runtime/index.ts`
- Chat request handler:
  - `worker/src/runtime/handler.ts`
- SQL agent:
  - `worker/src/runtime/sqlAgent.ts`
- SQL execution and safety:
  - `worker/src/runtime/sql/sqlExecutor.ts`
  - `worker/src/runtime/sql/sqlSafety.ts`
- Worker env parsing:
  - `worker/src/runtime/env.ts`

### Worker subdomains

- Auth:
  - `worker/src/runtime/auth/*`
- Data Browser:
  - `worker/src/runtime/dataBrowser/*`
- Lineup Lab:
  - `worker/src/runtime/lineupLab/*`
- Catalog/scope selection:
  - `worker/src/runtime/catalog/*`
  - `worker/src/runtime/scopeMetadata.ts`

Use the worker runtime when frontend requests fail, 401s appear, SQL is blocked, or context/query selection looks wrong.

## Data and Ingestion

- Ingestion runbook:
  - `data-ingestion/README.md`
- SQLite local validation:
  - `data-ingestion/sqlite/*`
- Supabase migrations:
  - `supabase/migrations/*`
- Schema/ERD references:
  - `docs/database/*`

Use these when debugging missing data, stale analytics objects, or schema assumptions.

## Local Runtime

- Frontend dev server:
  - `npm run dev`
- Worker dev server:
  - `npm run worker:dev`
- Frontend proxies `/api` to local worker through `vite.config.ts`
- Worker config lives in `worker/wrangler.toml`

## Verification Commands

Primary verification commands:

```bash
npm run format:check
npm run lint:check
npm run typecheck
npm run test
npm run test:coverage
npm run test:e2e
```

## Debugging Guide

### Login or route protection broken

Check:

- `src/router/index.ts`
- `src/stores/auth.ts`
- `worker/src/runtime/auth/handler.ts`

### Chat request fails or gives wrong answer

Check:

- `src/features/chat/chatClient.ts`
- `worker/src/runtime/handler.ts`
- `worker/src/runtime/sqlAgent.ts`
- `worker/src/runtime/sql/sqlExecutor.ts`
- `worker/docs/request-lifecycle.md`

### Data Browser tree or direct-query issues

Check:

- `src/features/chat/components/DataBrowserTree.vue`
- `src/features/chat/data-browser/useDataBrowserController.ts`
- `worker/src/runtime/dataBrowser/contextHandler.ts`
- `worker/src/runtime/dataBrowser/handler.ts`
- `worker/src/runtime/dataBrowser/repository.ts`

### Lineup recommendation or context issues

Check:

- `src/features/lineup-lab/useLineupLabController.ts`
- `worker/src/runtime/lineupLab/contextHandler.ts`
- `worker/src/runtime/lineupLab/handler.ts`
- `worker/src/runtime/lineupLab/repository.ts`
- `worker/src/runtime/lineupLab/optimizer.ts`

### Security/auth/cors/header issues

Check:

- `worker/src/runtime/auth/http.ts`
- `public/_headers`
- `docs/security/web-baseline.md`

## Design and Test References

- Design references:
  - `designs/*`
- Playwright specs:
  - `e2e/*`
- Vitest suite:
  - `tests/*`

When debugging UI regressions, always pair the relevant Vue components with the matching Vitest and Playwright coverage.
