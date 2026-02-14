# Agent Roles & Workflow (AGENTS.md)

This repository uses an **agentic engineering workflow** designed to optimize for:

* clean, readable, well-documented code
* strong security boundaries
* scalable architecture
* verifiable correctness

**One agent writes code by default. All other agents act as reviewers and gates.**

---

## Core Principles

1. **One Writer Rule**
   Only the **Lead Builder** modifies production code unless a task is explicitly isolated (e.g., tests-only, docs-only).

2. **Reviewers Do Not Merge**
   Reviewer agents provide findings, risks, and patch-ready suggestions, not sweeping rewrites.

3. **Verification Is Mandatory**
   No change is complete without running verification commands.

4. **Ground Truth over Guessing**
   MCP servers (Context7, Supabase, library MCPs) must be consulted for unfamiliar APIs or patterns.

5. **Small Diffs, Clear Intent**
   Prefer incremental, reviewable changes over large refactors.

6. **Skill Invocation Portability**
   If the runtime has a dedicated `Skill` tool, use it. If not, load the referenced `SKILL.md` files directly and follow them.

---

## Verification Commands

All contributors and agents must preserve these commands:

```bash
npm run format:check
npm run lint:check
npm run test
npm run test:coverage
npm run test:e2e
npm run typecheck
```

If a command cannot be run, the reason must be explicitly documented.
Runtime verification is also required for code/config changes per `.codex/memories/verify-runtime-before-complete.md`.

---

## Agent Cards

### Agent 0 - Lead Builder (Primary Writer)

**Role:** Senior engineer responsible for all implementation changes.

**Required memories:**

* `vite-vue.md`
* `vue-composition-api.md`
* `pinia.md` when introducing or changing shared state stores
* `tailwind-shadcn-vue.md`
* `typescript.md`
* `async-effects.md`
* `verify-runtime-before-complete.md`
* `testing-vitest-playwright.md` when adding or modifying tests

**Responsibilities:**

* Clarify goal and acceptance criteria
* Identify files to change and why
* Implement changes with minimal diffs
* Run verification commands
* Integrate reviewer feedback

---

### Agent 1 - Frontend UI & UX Reviewer (Vue + shadcn-vue + Tailwind)

**Role:** Reviewer for UI correctness, responsiveness, accessibility, and design parity.

**Required memories:**

* `vite-vue.md`
* `tailwind-shadcn-vue.md`
* `web-accessibility-ui-checklist.md`
* `ui-screenshot-verification.md`

**Scope:**

* Vue SFC components
* Tailwind utility usage
* shadcn-vue component composition

---

### Agent 2 - Supabase DBA (Schema, Migrations, RLS)

**Role:** Specialist for database design and security.

**Scope:**

* Supabase migrations
* SQL schema
* Indexes, constraints, RLS policies

---

### Agent 3 - Application Security Reviewer

**Role:** Security gate across the full application surface.

**Scope:**

* Frontend auth/session flows and route protection
* API and backend boundaries
* Input validation and output hardening
* Security headers, secrets handling, and sensitive logging

**Required checklist:**

* `docs/security/vibecoder-review.md` (applicable sections)

**Rules:**

* Findings must include **Attack path -> Impact -> Mitigation/Fix -> Files**

---

### Agent 4 - LLM Integration Reviewer

**Role:** Reviewer for LLM usage safety, cost, and correctness.

**Scope:**

* Prompt construction
* OpenAI API calls
* Output parsing and validation

---

### Agent 5 - Test & Quality Gatekeeper

**Role:** Enforces verifiability and maintainability.

**Required memories:**

* `testing-vitest-playwright.md`
* `verify-runtime-before-complete.md`

**Checklist:**

* `npm run format:check` passes
* `npm run lint:check` passes
* `npm run test` passes
* `npm run test:coverage` passes
* `npm run test:e2e` passes (or documented rationale if intentionally skipped)
* `npm run typecheck` passes

---

### Agent 6 - UI Screenshot & Design Parity Reviewer

**Role:** Reviewer for visual regressions and design fidelity.

**Required memories:**

* `ui-screenshot-verification.md`
* `web-accessibility-ui-checklist.md`

---

### Agent 7 - Docs & Architecture Reviewer

**Role:** Maintains clarity and long-term scalability.

**Scope:**

* README
* Architecture docs
* ADRs
* Agent/memory docs

---

### Agent 8 - Web Delivery & Accessibility Compliance Reviewer

**Role:** Reviewer for web release safety and policy-aligned delivery posture.

**Scope:**

* Security headers and CSP posture
* Privacy/auth/session handling documentation
* Accessibility and legal/compliance-sensitive UX surfaces
* Deployment-risk config changes

**Rules:**

* Reviewer-only
* Findings must include risk, evidence, and concrete remediation

---

## Standard Review Output Format

All reviewer agents must use this output structure for every finding:

* `Severity` (Blocker/Major/Minor)
* `File:line`
* `Risk`
* `Evidence`
* `Mitigation/Fix`

Empty reviews must explicitly state: `No findings`.

---

## Mandatory Dispatch Rules

The Lead Builder must trigger the following reviewers based on changed files:

* `src/components/**`, `src/pages/**`, `src/layouts/**`, `src/App.vue` -> Agent 1 and Agent 6
* `supabase/**`, SQL migrations, repository SQL changes -> Agent 2
* `api/**`, `backend/**`, `server/**`, `src/lib/auth/**`, `src/router/**`, `middleware/**`, `docs/security/**`, auth/session/security config changes -> Agent 3
* OpenAI/LLM prompt or response parsing changes -> Agent 4
* Any test/config/tooling changes -> Agent 5
* Docs and architecture updates -> Agent 7
* Delivery/compliance surfaces (`vite.config.*`, headers/CSP/server config, privacy/auth docs, accessibility-critical flows) -> Agent 8

If multiple scopes are touched, dispatch all matching reviewers before completion.

Helper command:

```bash
npm run review:dispatch -- --base origin/main --write-prompts
```

Prompt templates live in `.codex/prompt-templates/review/` and generated prompts are written to `.codex/review-prompts/`.

One-command parallel review run:

```bash
npm run review:base
```

Results are written to `.codex/review-results/`.

---

## Security Automation Gate

For backend/auth/database changes, run security checks before completion:

```bash
rg -n "api[_-]?key|secret|token|password|private[_-]?key|BEGIN (RSA|EC|OPENSSH)" . --glob '!node_modules/**'
npm audit --omit=dev
```

If security commands cannot run, document why and provide manual review evidence.

---

## Merge Readiness Gate

A change is merge-ready only when all applicable items are satisfied:

* Verification commands pass (format, lint, tests, coverage, e2e, typecheck)
* Runtime verification completed when required
* Required reviewer agents dispatched for changed scopes
* Security automation gate completed for sensitive changes
* UI screenshot/design parity checks completed for visual changes
* Known risks and follow-ups documented
