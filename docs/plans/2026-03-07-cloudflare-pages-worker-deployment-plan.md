# Cloudflare Pages + Worker Deployment Plan

Date: 2026-03-07
Owner: Application Team
Status: Proposed deployment plan

## 1. Objective

Deploy the application to Cloudflare using:

- Cloudflare Pages for the Vite-built frontend
- Pages Functions for same-origin `/api/*` proxying
- a separate backend Cloudflare Worker for chat, auth, and lineup APIs
- Hyperdrive for backend Worker connectivity to Supabase Postgres

This plan is designed to preserve the current frontend contract, keep browser API calls same-origin, and minimize architectural churn from the current local-only setup.

## 2. Recommended Topology

### 2.1 Deployment Shape

Use the following production topology:

- Frontend deployed as a static Vite build on Cloudflare Pages
- Pages Functions handles `/api/*`
- Pages Functions forwards API requests to the backend Worker via Cloudflare service binding
- Backend Worker remains the application API runtime
- Backend Worker uses Hyperdrive to connect to Supabase Postgres

### 2.2 Why This Topology

This is the best fit for the current codebase because:

- frontend clients already call same-origin `/api/*`
- Vite local dev already models this shape through proxying
- browser CORS complexity is avoided in the primary deployment path
- CSP can remain strict with `connect-src 'self'`
- the backend Worker remains independently deployable and testable

### 2.3 Topologies Not Chosen

The plan does not target these as the primary architecture:

- Pages frontend plus public browser-facing Worker hostname
- single Worker serving both static assets and API

These remain possible fallback options, but are not the recommended path for this repository.

## 3. Current State

### 3.1 Frontend Assumptions

The frontend currently assumes:

- API requests go to same-origin `/api/*`
- no public API base URL is needed in production
- auth routes and feature flows rely on that same-origin contract
- CSP in `public/_headers` currently permits `connect-src 'self'`

### 3.2 Backend Assumptions

The backend Worker currently provides:

- `POST /api/chat`
- `GET /api/chat/config`
- auth endpoints under `/api/auth/*`
- lineup-lab endpoints under `/api/lineup-lab/*`
- JWT enforcement for all non-auth-bootstrap API routes
- environment-driven origin allowlisting
- Hyperdrive-aware database connection resolution

### 3.3 Missing Production Integration Layer

The repository currently does not include:

- a Pages project configuration
- a Pages Functions API proxy layer
- deployment automation for Pages and Worker together
- production/preview origin pattern handling for Pages preview URLs

## 4. Implementation Plan

### 4.1 Add a Pages Functions Proxy Layer

Add a Pages Function at `functions/api/[[path]].ts` that:

- receives all `/api/*` traffic on Pages
- forwards the full request to the backend Worker through a Cloudflare service binding
- preserves method, pathname, query string, headers, and request body
- returns the backend Worker response unchanged

Proxy behavior requirements:

- do not reshape JSON payloads
- do not reimplement auth logic in Pages Functions
- do not duplicate backend validation in Pages Functions
- preserve status codes and response headers from the backend Worker

Pages Functions should remain a transport layer only.

### 4.2 Preserve Frontend API Contract

Keep the frontend on same-origin `/api/*`.

Do not add `VITE_API_BASE_URL` in the recommended path.

No frontend transport refactor should be required for the initial Cloudflare deployment, other than any Pages-specific environment values already expected by the app.

### 4.3 Expand Origin Allowlisting for Pages

The backend Worker currently expects exact allowed origins. That is insufficient for Pages preview environments because preview hostnames can vary.

Update origin allowlisting so it supports:

- exact origin matches for stable environments
- wildcard hostname matching for Pages preview origins, such as `https://*.pages.dev` or a project-scoped equivalent

Requirements:

- exact matching behavior must remain supported
- wildcard support must be additive, not a breaking replacement
- preview Pages deployments must be accepted without disabling origin validation
- production should still use explicit stable origins where possible

### 4.4 Keep CSP Strict Under the Proxy Model

Because API traffic remains same-origin through Pages, retain the strict CSP model in `public/_headers`.

Requirements:

- `connect-src 'self'` should remain valid for deployed app traffic
- `_headers` should continue to govern static asset responses from Pages
- API security headers remain owned by the backend Worker response path
- preview Pages hostnames should be marked `noindex`

### 4.5 Keep Backend Worker as the System of Record for API Logic

The backend Worker remains responsible for:

- auth enforcement
n- Supabase JWT validation
- Turnstile verification
- SQL agent runtime
- lineup-lab recommendation and context endpoints
- error mapping and API response headers
- observability and logging

Pages Functions must not become a second application runtime.

## 5. Cloudflare Resource Setup

### 5.1 Pages Project

Create one Cloudflare Pages project for the frontend.

Build settings:

- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`

### 5.2 Backend Worker Services

Create separate backend Worker environments/services for:

- preview/staging
- production

The plan assumes:

- Pages Preview deploys talk to a preview Worker
- Pages Production deploys talk to a production Worker

### 5.3 Service Binding Between Pages and Worker

Bind the Pages project to the backend Worker using a Cloudflare service binding.

Requirements:

- Preview Pages environment binds to preview Worker
- Production Pages environment binds to production Worker
- Pages Functions proxy uses the binding instead of public internet fetches

### 5.4 Hyperdrive

Create Hyperdrive for the backend Worker and bind it in deployed environments.

Requirements:

- production should prefer Hyperdrive instead of direct raw DB URL usage
- preview should also use Hyperdrive if available for environment parity
- local development can continue using the existing local Worker flow

### 5.5 Turnstile

Configure Turnstile so the deployed frontend hostnames are valid challenge origins.

Allowed hostnames should include:

- the production `pages.dev` hostname
- preview `pages.dev` hostnames used during pre-production validation

## 6. Environment Variables and Secrets

### 6.1 Pages Public Variables

Configure Pages public environment variables:

- `VITE_CHAT_BACKEND_MODE=real`
- `VITE_AUTH_BYPASS=false`
- `VITE_AUTH_TURNSTILE_BYPASS=false`
- `VITE_TURNSTILE_SITE_KEY=<public turnstile site key>`

Do not place private secrets in `VITE_*` variables.

### 6.2 Backend Worker Required Secrets and Vars

Configure backend Worker with these required values:

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `AUTH_IP_HASH_SALT`
- `AUTH_TURNSTILE_SECRET`
- `AUTH_ALLOWED_ORIGINS`
- `APP_ENV=staging` for preview
- `APP_ENV=production` for production

### 6.3 Backend Worker Recommended Vars

Set these as needed:

- `LLM_MODEL`
- `LLM_REASONING_LEVEL`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL`
- `LANGFUSE_TRACING_ENVIRONMENT`
- lineup tuning vars if non-default optimizer scoring is desired

### 6.4 Deployment Safety Rules

Do not enable these in production:

- `AUTH_BYPASS_ENABLED`
- `AUTH_TURNSTILE_BYPASS`

Preview should also avoid them unless debugging a temporary bring-up issue.

## 7. CI/CD Plan

### 7.1 Source of Truth

Use GitHub-connected CI as the long-term deployment workflow.

### 7.2 Pages Deployment

Connect the repository to Cloudflare Pages so that:

- pull requests or preview branches produce preview deployments
- `main` produces the production Pages deployment

### 7.3 Worker Deployment

Add GitHub Actions for backend Worker deployment so that:

- preview branches deploy the preview Worker
- `main` deploys the production Worker

The Pages project and Worker deployments must remain environment-aligned.

### 7.4 First Bring-Up Order

Recommended first deployment order:

1. Create Hyperdrive
2. Create backend Worker preview and production environments
3. Configure backend Worker secrets and vars
4. Add Pages Functions proxy
5. Add wildcard origin support for Pages preview URLs
6. Create Pages project and bind it to the Worker
7. Deploy preview environment
8. Validate auth, chat, and lineup flows end-to-end
9. Promote to production

## 8. Validation Plan

### 8.1 Local Validation

Before Cloudflare rollout:

- keep local frontend + Worker flow working
- run backend Worker locally
- run Pages-compatible local validation if available
- validate that proxy behavior does not require frontend code changes

### 8.2 Automated Verification

Run the normal repository verification gates:

- `npm run format:check`
- `npm run lint:check`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`

### 8.3 Required Automated Test Coverage

Add or update tests for:

- wildcard origin matching behavior
- Pages proxy forwarding of method, path, query, headers, and body
- passthrough of backend response status codes and payloads
- deployed auth flows through the proxy path

### 8.4 Preview Environment Acceptance Checks

Validate on preview deployment:

- frontend loads on Pages
- `/api/chat/config` succeeds through proxy
- OTP request/verify flow succeeds with Turnstile enabled
- authenticated chat succeeds
- lineup-lab divisions/teams/matchups load successfully
- lineup recommendation requests succeed
- no browser CORS errors occur
- no auth bypass flags are active

### 8.5 Production Acceptance Checks

Validate on production deployment:

- production frontend loads correctly
- authenticated app usage works end-to-end
- Worker logs and Pages logs show healthy request flow
- static response headers are present
- preview URLs are not indexed

## 9. Out of Scope for Initial Rollout

The initial plan does not include:

- custom-domain cutover as a prerequisite for first deployment
- browser-direct public API hostname as the primary architecture
- consolidating static assets and API into one Worker runtime
- major frontend transport rewrites

These can be planned later once the `pages.dev` deployment is stable.

## 10. Default Decisions Chosen

The plan assumes the following defaults:

- deployment target is Cloudflare Pages plus backend Worker
- `/api/*` remains same-origin
- Pages Functions acts as a thin proxy only
- first rollout uses `pages.dev`
- GitHub-connected CI is the long-term deployment workflow
- preview and production use separate Worker environments
- Hyperdrive is the intended deployed database path

## 11. Implementation Follow-Up

The next step after approving this deployment plan is to create an implementation plan that specifies:

- exact files to add or modify
- precise Pages and Worker config artifacts
- environment variable mapping by environment
- CI workflow files and deployment commands
- test additions required to safely ship the deployment setup

## 12. Implementation Steps

### 12.1 Exact Files to Create

Create these files:

- `functions/api/[[path]].ts`
  - Pages Functions proxy for all `/api/*` requests
  - forwards requests to backend Worker through a service binding
- `wrangler.toml`
  - root-level Pages configuration for local Pages Functions development and service bindings
- `.github/workflows/deploy-worker-preview.yml`
  - deploys preview backend Worker from non-`main` branch activity
- `.github/workflows/deploy-worker-production.yml`
  - deploys production backend Worker from `main`
- `docs/deployment/cloudflare-pages-worker.md`
  - operator runbook for Pages, Worker, Hyperdrive, Turnstile, and secrets

### 12.2 Exact Files to Modify

Modify these files:

- `worker/src/runtime/auth/http.ts`
  - expand `AUTH_ALLOWED_ORIGINS` handling to support wildcard hostname patterns for Pages preview URLs
- `worker/wrangler.toml`
  - add explicit deploy environments for preview and production
  - keep Hyperdrive binding configuration here
- `package.json`
  - add scripts for local Pages development and Worker deploy helpers
- `public/_headers`
  - keep static asset security headers
  - add explicit `X-Robots-Tag: noindex` policy for preview deployments if implemented through header rules
- `.github/workflows/verify.yml`
  - keep verification job intact
  - ensure deployment workflows depend on this verification job or replicate the same quality gates before deploy
- `worker/README.md`
  - document deployed env vars, Pages proxy flow, and local Pages + Worker development

Optional modifications if needed during implementation:

- `src/env.d.ts`
  - only if new public `VITE_*` variables are introduced
- `vite.config.ts`
  - only if local development is expanded to support an integrated Pages dev command

### 12.3 Cloudflare Resources to Create

Create these Cloudflare resources:

- 1 Pages project
  - name: `dink-tank-web` or equivalent stable project name
  - production branch: `main`
  - build command: `npm run build`
  - output directory: `dist`
- 2 backend Worker deploy targets
  - preview service/environment
  - production service/environment
- 1 Hyperdrive instance
  - points at the Supabase Postgres host
  - bound to preview and production Worker deployments
- 1 Turnstile widget
  - used by the frontend auth flow
- 1 service binding from Pages Functions to backend Worker per environment
  - Pages Preview -> preview Worker
  - Pages Production -> production Worker

### 12.4 Cloudflare Dashboard Configuration Checklist

#### Pages Project

- Create the Pages project from the GitHub repository
- Set production branch to `main`
- Set build command to `npm run build`
- Set build output directory to `dist`
- Enable preview deployments for pull requests and branch pushes

#### Pages Environment Variables

Set in both Preview and Production unless noted otherwise:

- `VITE_CHAT_BACKEND_MODE=real`
- `VITE_AUTH_BYPASS=false`
- `VITE_AUTH_TURNSTILE_BYPASS=false`
- `VITE_TURNSTILE_SITE_KEY=<turnstile-site-key>`

Do not set private secrets as `VITE_*`.

#### Pages Service Binding

Configure a binding exposed to Pages Functions, for example:

- binding name: `API_BACKEND`
- Preview target: preview Worker
- Production target: production Worker

#### Worker Secrets and Variables

Required in Preview and Production:

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `AUTH_IP_HASH_SALT`
- `AUTH_TURNSTILE_SECRET`
- `AUTH_ALLOWED_ORIGINS`
- `APP_ENV`

Recommended:

- `LLM_MODEL`
- `LLM_REASONING_LEVEL`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL`
- `LANGFUSE_TRACING_ENVIRONMENT`
- lineup tuning vars if non-default behavior is desired

Forbidden for production:

- `AUTH_BYPASS_ENABLED=true`
- `AUTH_TURNSTILE_BYPASS=true`

#### Hyperdrive

- create Hyperdrive against Supabase Postgres
- attach binding name `HYPERDRIVE`
- use the binding in preview and production Worker environments

#### Turnstile

Allow these hostnames:

- production `pages.dev` hostname
- preview Pages hostnames used during rollout

### 12.5 Environment Variable Values by Environment

#### Pages Preview

- `VITE_CHAT_BACKEND_MODE=real`
- `VITE_AUTH_BYPASS=false`
- `VITE_AUTH_TURNSTILE_BYPASS=false`
- `VITE_TURNSTILE_SITE_KEY=<preview-or-shared-site-key>`

#### Pages Production

- `VITE_CHAT_BACKEND_MODE=real`
- `VITE_AUTH_BYPASS=false`
- `VITE_AUTH_TURNSTILE_BYPASS=false`
- `VITE_TURNSTILE_SITE_KEY=<production-site-key>`

#### Worker Preview

- `APP_ENV=staging`
- `AUTH_ALLOWED_ORIGINS=https://<project>.pages.dev,https://*.pages.dev`
- `SUPABASE_URL=<supabase-project-url>`
- `SUPABASE_ANON_KEY=<supabase-anon-key>`
- `OPENAI_API_KEY=<secret>`
- `AUTH_IP_HASH_SALT=<secret>`
- `AUTH_TURNSTILE_SECRET=<secret>`
- `LLM_MODEL=gpt-4.1-mini` unless intentionally changed
- `LLM_REASONING_LEVEL=medium` unless intentionally changed

#### Worker Production

- `APP_ENV=production`
- `AUTH_ALLOWED_ORIGINS=https://<project>.pages.dev`
- `SUPABASE_URL=<supabase-project-url>`
- `SUPABASE_ANON_KEY=<supabase-anon-key>`
- `OPENAI_API_KEY=<secret>`
- `AUTH_IP_HASH_SALT=<secret>`
- `AUTH_TURNSTILE_SECRET=<secret>`
- `LLM_MODEL=gpt-4.1-mini` unless intentionally changed
- `LLM_REASONING_LEVEL=medium` unless intentionally changed

### 12.6 Package Script Checklist

Add these scripts to `package.json`:

- `pages:dev`
  - runs local Pages development with Pages Functions
- `worker:deploy:preview`
  - deploys backend Worker preview environment
- `worker:deploy:production`
  - deploys backend Worker production environment

If needed, also add:

- `pages:deploy:preview`
- `pages:deploy:production`

These are optional if Cloudflare Pages Git integration is used directly for the frontend deploys.

### 12.7 GitHub Workflow Checklist

#### Keep Existing Verification

Preserve `.github/workflows/verify.yml` as the required quality gate.

#### Add Preview Worker Deployment Workflow

Create `.github/workflows/deploy-worker-preview.yml`:

- trigger on pull requests and non-`main` branch pushes
- run `npm ci`
- run `npm run format:check`
- run `npm run lint:check`
- run `npm run typecheck`
- run `npm run test`
- deploy preview Worker with Wrangler

#### Add Production Worker Deployment Workflow

Create `.github/workflows/deploy-worker-production.yml`:

- trigger on push to `main`
- run `npm ci`
- run verification gates
- deploy production Worker with Wrangler

GitHub repository secrets needed for deployment:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### 12.8 Pages Functions Proxy Implementation Checklist

In `functions/api/[[path]].ts`, implement:

- catch-all route for `/api/*`
- service binding lookup from `context.env.API_BACKEND`
- passthrough fetch using the incoming request URL path and query
- support for:
  - `GET`
  - `POST`
  - `OPTIONS`
  - auth headers
  - JSON request bodies
- no API contract transformation

The proxy must preserve:

- status code
- headers
- body

### 12.9 Worker Origin Matching Checklist

In `worker/src/runtime/auth/http.ts`, implement:

- support for exact origins
- support for wildcard hostname patterns
- safe matching rules that do not allow scheme downgrades
- predictable behavior for:
  - `https://app.pages.dev`
  - `https://branch.app.pages.dev`
  - disallowed unrelated origins

Matching must reject:

- `http://` when `https://` is expected
- unrelated lookalike hosts
- malformed origin values

### 12.10 Deployment Steps

#### Step 1: Prepare Cloudflare

1. Create or identify the Cloudflare account
2. Create Hyperdrive for Supabase Postgres
3. Create Turnstile widget
4. Create the Pages project
5. Prepare preview and production Worker targets

#### Step 2: Prepare Repository

1. Add Pages Functions proxy
2. Add root Pages config
3. Add Worker preview/production environment config
4. Add wildcard origin support
5. Add package scripts
6. Add deployment workflows
7. Update docs

#### Step 3: Configure Secrets and Bindings

1. Set Pages public env vars
2. Set Worker secrets and vars for preview
3. Set Worker secrets and vars for production
4. Bind Hyperdrive to Worker environments
5. Bind Pages Functions to preview and production Worker services
6. Configure Turnstile allowed hostnames

#### Step 4: Validate Locally

1. Run `npm run format:check`
2. Run `npm run lint:check`
3. Run `npm run typecheck`
4. Run `npm run test`
5. Run `npm run test:e2e`
6. Run local Worker
7. Run local Pages Functions dev flow
8. Verify `/api/*` works through the proxy path

#### Step 5: Deploy Preview

1. Deploy preview Worker
2. Push branch or open PR for Pages preview
3. Confirm preview Pages binds to preview Worker
4. Validate auth flow
5. Validate chat flow
6. Validate lineup-lab flow
7. Review Pages and Worker logs

#### Step 6: Deploy Production

1. Merge to `main`
2. Confirm production Worker deploy succeeds
3. Confirm production Pages deploy succeeds
4. Validate end-to-end production flow on `pages.dev`
5. Confirm no bypass flags are enabled
6. Confirm preview URLs remain `noindex`

### 12.11 Acceptance Checklist

The deployment work is complete only when all of the following are true:

- frontend is live on Cloudflare Pages
- `/api/chat/config` works through Pages proxy
- OTP request and verify work in deployed preview
- authenticated chat works in deployed preview
- lineup-lab context endpoints work in deployed preview
- lineup recommendations work in deployed preview
- preview and production Worker environments are separated
- Hyperdrive is bound and used in deployed Worker environments
- GitHub Actions can deploy backend Worker preview and production
- Cloudflare Pages can deploy frontend preview and production
- verification commands pass before deploy

### 12.12 Natural Next Implementation Order

Implement in this order:

1. wildcard origin matching
2. Pages Functions proxy
3. root Pages config
4. package scripts
5. Worker env split in `worker/wrangler.toml`
6. deployment workflows
7. documentation updates
8. preview deployment
9. production deployment
