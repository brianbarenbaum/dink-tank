# Supabase OTP Authentication Phase-1 Specification

Date: 2026-02-25
Owner: Application Team
Status: Approved specification for implementation planning

## 1. Objective

Implement phase-1 authentication for the application using Supabase email one-time passwords (OTP), with full Worker API enforcement and strict XSS hardening required for release.

This specification defines functional requirements, security requirements, API contracts, runtime behavior, testing, and explicit out-of-scope items.

## 2. Scope

### 2.1 In Scope

- Supabase email OTP code authentication (code entry flow only).
- Open sign-in policy (any email can authenticate).
- Auto-create user on first successful OTP authentication.
- Full authentication enforcement on Worker `/api/*` routes, except explicit auth bootstrap routes.
- Vue Router integration for auth routes and protected-route guard behavior.
- Turnstile challenge on OTP request endpoint.
- Server-authoritative OTP abuse controls (rate limit, cooldown, lockout) in Worker.
- JWT verification in Worker using Supabase JWKS with local cache and rotation support.
- Strict XSS hardening controls as release requirements.
- Local-required auth E2E verification (not CI-required in phase 1).

### 2.2 Out of Scope (Phase 1)

- OAuth/social providers.
- Role-based access control (RBAC/admin roles).
- HttpOnly cookie session architecture.
- WebAuthn/passkeys.
- CI-mandated auth E2E pipeline gating.

## 3. Functional Requirements

### 3.1 Authentication Method

- Authentication method is email OTP code entry only.
- Magic-link callback authentication is not supported in phase 1.
- OTP code validity target is 10 minutes.
- OTP codes are single-use and invalidated immediately on successful verification.

### 3.2 Access Policy

- Any authenticated user is authorized for phase-1 features.
- No role differentiation in phase 1.
- Unauthenticated users are blocked from all protected app routes.

### 3.3 Route Model

- Introduce Vue Router.
- Public routes:
  - `/auth/login`
  - `/auth/verify`
- Protected routes:
  - `/` and all application feature routes.
- Deep-link behavior:
  - If unauthenticated user hits protected route, capture intended path.
  - After successful OTP verification, return user to intended path.
  - Fallback destination is `/`.

### 3.4 Session UX

- Auth bootstrap loading state must block protected shell rendering until session resolution completes.
- Multi-tab auth state synchronization is required (sign-in, sign-out, refresh failure).
- Sign-out scope is current session only.
- No "remember me" option in phase 1.
- Resend OTP enabled after 60 seconds.

## 4. Security Requirements (Mandatory Release Gates)

### 4.1 Browser Session Model

- Session model: bearer access/refresh tokens persisted in browser storage.
- Phase 1 explicitly does not implement HttpOnly cookie sessions.

### 4.2 XSS Hardening

All items in this section are mandatory before release:

- Enforced blocking CSP from day 1 (not report-only).
- Nonce-free strict CSP:
  - No inline scripts.
  - No inline styles.
  - No `unsafe-eval`.
- Explicit ban on dynamic code execution/eval-style patterns.
- Trusted Types is deferred in phase 1.
- Prohibit unsafe HTML rendering patterns (including unreviewed `v-html` usage).
- Do not log access tokens, refresh tokens, or sensitive auth payloads.
- Security headers must be present for auth/protected responses.
- Auth-related responses must include `Cache-Control: no-store`.

### 4.3 Error Privacy and Enumeration Resistance

- Auth errors must be generic and non-enumerating across OTP request and verify.
- Unauthorized access to protected API routes returns generic `401` auth error.

### 4.4 Origin and Deployment Safety

- Allowed browser origins are explicit allowlists per environment.
- Local allowed origin: `http://localhost:5173`.
- Staging and production origins are required pre-release inputs.
- Startup/deploy must hard-fail when required auth/security env vars are missing.
- Non-prod auth bypass/rollback flag is allowed.
- Production auth bypass is not allowed.

## 5. Abuse Prevention Requirements

### 5.1 Turnstile

- Cloudflare Turnstile is required for OTP request endpoint.
- Enforcement is fail-closed: OTP request is rejected if Turnstile verification is unavailable or fails.
- Turnstile is required on OTP request only (not OTP verify).

### 5.2 Server-Authoritative Limits

Enforce in Worker (not client-only), backed by Supabase Postgres:

- OTP request limit per email: `3` per `15` minutes.
- OTP request limit per IP: `20` per `15` minutes.
- OTP verify failures:
  - 5-second cooldown after each failed attempt.
  - Lock verification for 5 minutes after 5 failed attempts.

### 5.3 Privacy of Network Identifiers

- Store salted hash of IP only.
- Do not store raw IP addresses.

### 5.4 Retention

- Retain audit/abuse records for 30 days.

## 6. API and Runtime Contract

### 6.1 Auth Endpoints (Unversioned in Phase 1)

- `POST /api/auth/otp/request`
- `POST /api/auth/otp/verify`
- `GET /api/auth/session`
- `POST /api/auth/signout`
- `POST /api/auth/refresh`

### 6.2 Endpoint Behavior

- Frontend calls Worker auth endpoints only (no direct Supabase OTP calls from browser).
- Worker centralizes:
  - Turnstile verification
  - rate limiting/cooldowns/lockouts
  - generic error strategy
  - structured auth audit logging
- OTP verify accepts email + 6-digit code only.
- Login success requires verified-email session semantics from Supabase OTP flow.
- Emails are normalized for logging and abuse-control keys.

### 6.3 Session Bootstrapping

- `GET /api/auth/session` is required.
- Used at app boot to validate and normalize current session state.

### 6.4 JWT Verification

Worker JWT validation requirements for protected routes:

- Signature validation against Supabase JWKS.
- JWKS fetched and cached locally with key rotation support.
- Validate claims:
  - `exp`
  - `nbf` and `iat` sanity when present
  - expected `iss`
  - expected `aud` (configured via env)
  - non-empty `sub`

Revocation semantics in phase 1:

- JWT-only revocation behavior (no per-request remote active-user check).
- Disabled/deleted users may retain access until token lifecycle boundaries (expiry/refresh path).

### 6.5 Token Refresh

- Proactive refresh at 60 seconds before token expiry.
- Fallback strategy: on `401`, attempt one refresh and retry request once.
- If retry fails, clear local session state and redirect to login.

## 7. Data and Logging Requirements

### 7.1 Audit Logging

Minimal structured auth audit events required:

- OTP request: success/failure
- OTP verify: success/failure
- Sign-out
- Token refresh failure

Each event should include:

- request id
- hashed/normalized email (where available)
- timestamp
- event type/status

### 7.2 Storage for Abuse State

- Use Supabase Postgres tables for counters/lockouts/audit records.
- No Cloudflare KV or Durable Objects required in phase 1.

## 8. Frontend Integration Requirements

- Replace current non-auth shell flow with router-aware auth gating.
- Auth pages:
  - `/auth/login` for email step
  - `/auth/verify` for OTP step
- Protected app remains rooted at `/`.
- Preserve existing app shell and features behind auth boundary.
- Development mock mode remains available only in development via env flag.
- Mock mode must be disabled in production.

## 9. Testing and Acceptance Criteria

### 9.1 Required Test Coverage (Phase 1)

Unit tests:

- Route guards (public/protected redirect behavior).
- Auth state transitions and bootstrap loading behavior.

API tests:

- OTP request/verify contracts.
- Turnstile fail-closed behavior.
- Rate limit/cooldown/lockout enforcement.
- JWT claim validation and protected-route rejection behavior.

E2E tests (local-required, not CI-required in phase 1):

- Successful OTP login flow.
- Deep-link redirect and post-login return.
- Generic auth error presentation.
- Sign-out behavior.
- Refresh fallback path on `401`.
- Lockout behavior after repeated verify failures.

### 9.2 Security Checklist Gate (Must Pass)

- CSP enforced in blocking mode.
- No unsafe HTML injection patterns in auth-related UI paths.
- No token logging.
- `Cache-Control: no-store` on auth responses.
- Production/staging allowed origins and required auth env vars documented and configured before release.

## 10. Environment Requirements

Phase 1 specification applies to:

- local
- staging
- production

Current known value:

- Local frontend origin: `http://localhost:5173`

Required pre-release values:

- Staging frontend origin(s)
- Production frontend origin(s)
- JWT issuer/audience config
- Turnstile keys/secrets
- Any remaining required auth env vars

## 11. Non-Goals and Follow-Up Candidates

Future phases may add:

- HttpOnly cookie-based session architecture.
- OAuth providers.
- RBAC/admin authorization layers.
- Trusted Types CSP hardening.
- CI enforcement for auth E2E.

