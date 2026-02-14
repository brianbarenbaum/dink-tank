# Web Security Baseline (Vite + Vue Starter)

Use this checklist when preparing a real deployment from this starter.

## 1) Security headers

- Set `Content-Security-Policy` and avoid `unsafe-inline`/`unsafe-eval` in production.
- Set `X-Content-Type-Options: nosniff`.
- Set `Referrer-Policy` (for example `strict-origin-when-cross-origin`).
- Set `Permissions-Policy` with only required browser features.
- Set `X-Frame-Options: DENY` unless framing is explicitly required.

## 2) Session and auth handling

- Keep session/JWT secrets in server-side environment variables only.
- Use secure cookies (`HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`) for session tokens.
- Enforce server-side authorization checks on every privileged endpoint.
- Use short token lifetimes and explicit refresh/revocation strategy.

## 3) CORS and API boundaries

- Use an explicit CORS allowlist for production origins.
- Reject wildcard CORS for authenticated routes.
- Validate and sanitize all request inputs on the server.
- Return generic error messages for auth/permission failures.

## 4) Frontend environment safety

- Treat all `VITE_*` environment variables as public.
- Never place API keys, private tokens, or service-role credentials in `VITE_*`.
- Keep `.env` out of git and maintain `.env.example` with placeholders only.

## 5) Release verification

- Run full verification gates before merge:
  - `npm run format:check`
  - `npm run lint:check`
  - `npm run typecheck`
  - `npm run test`
  - `npm run test:coverage`
  - `npm run test:e2e`
- Run a pre-release secret scan:
  - `rg -n "api[_-]?key|secret|token|password|private[_-]?key|BEGIN (RSA|EC|OPENSSH)" . --glob '!node_modules/**' --glob '!docs/**' --glob '!.codex/**' --glob '!package-lock.json'`
