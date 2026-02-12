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
   Only the **Lead Builder** modifies production code unless a task is explicitly isolated (e.g., migrations-only, docs-only).

2. **Reviewers Do Not Merge**
   Reviewer agents provide findings, risks, and patch-ready suggestions — not sweeping rewrites.

3. **Verification Is Mandatory**
   No change is complete without running verification commands.

4. **Ground Truth over Guessing**
   MCP servers (Context7, Supabase, library MCPs) must be consulted for unfamiliar APIs or patterns.

5. **Small Diffs, Clear Intent**
   Prefer incremental, reviewable changes over large refactors.

6. **Skill Invocation Portability**
   If the runtime has a dedicated `Skill` tool, use it. If not, load the referenced `SKILL.md` files directly and follow them. Do not block work on tool availability.

---

## Verification Commands

All contributors and agents must preserve these commands:

```bash
npm run format:check
npm run lint:check
npm run test
npm run test:coverage
npm run typecheck
```

If a command cannot be run, the reason must be explicitly documented.
Runtime verification is also required for code/config changes per `.codex/memories/verify-runtime-before-complete.md`.

---

## Agent Cards

### Agent 0 — Lead Builder (Primary Writer)

**Role:** Senior engineer responsible for all implementation changes.

**Required memories:**

* `expo.md`
* `typescript.md`
* `async-effects.md`
* `verify-runtime-before-complete.md`
* Any UI-related memories when touching UI
* `testing.md` when adding or modifying tests

**Responsibilities:**

* Clarify goal and acceptance criteria
* Identify files to change and why
* Implement changes with minimal diffs
* Run verification commands
* Manually run the app when required
* Integrate reviewer feedback

**Rules:**

* Follow all applicable `.codex/memories` files
* Do not invent library usage; consult MCPs when unsure
* Do not weaken lint, type, or test standards

**Required Outputs:**

* Implementation summary
* Verification results (commands + runtime checks)
* Follow-ups or known risks

---

### Agent 1 — Mobile UI Specialist (React Native / Expo / Gluestack)

**Role:** Reviewer for mobile UI correctness, performance, accessibility, and design parity.

**Required memories:**

* `expo.md`
* `ui-fab-positioning.md`
* `ui-screen-wrapper.md`
* `ui-contrast-inputs.md`
* `ui-design-parity-checklist.md`

**Scope:**

* React Native components
* Expo configuration
* Gluestack usage

**Checklist:**

* Component boundaries and state ownership
* Performance risks (re-renders, unstable props)
* Accessibility (contrast, inputs, touch targets)
* Layout and positioning correctness
* Screen wrapper usage
* Visual parity with intended design

**Rules:**

* Reviewer-only by default
* Provide file-level, actionable findings

---

### Agent 2 — Supabase DBA (Schema, Migrations, RLS)

**Role:** Specialist for database design and security.

**Required memories:**

* Any Supabase- or database-related memory files (if present)

**Scope:**

* Supabase migrations
* SQL schema
* Indexes, constraints, RLS policies

**Checklist:**

* Deterministic, additive migrations
* Indexes aligned to access patterns
* RLS enabled and least-privilege policies defined
* Sensitive data handling explicitly documented

**Rules:**

* No new table without RLS (or documented exception)
* Prefer additive migrations

---

### Agent 3 — Worker / API Security Reviewer (Cloudflare Workers)

**Role:** Security gate for backend boundaries.

**Primary checklist:** `docs/security/vibecoder-review.md`

**Required memories:**

* `typescript.md`
* Any worker- or backend-specific memory files

**Scope:**

* Cloudflare Worker handlers
* Auth, input validation, CORS
* Rate limiting, logging, secrets

**Checklist:**

* Authentication and authorization correctness
* Input validation at boundaries
* Abuse and rate-limit considerations
* No secret or PII leakage in logs
* Run through applicable sections of `docs/security/vibecoder-review.md`

**Rules:**

* Reviewer-only
* Findings must include **Attack path → Impact → Mitigation/Fix → Files**

**Outputs:**

* Findings grouped by severity (Blocker/Major/Minor)

---

### Agent 4 — LLM Integration Reviewer (OpenAI API)

**Role:** Reviewer for LLM usage safety, cost, and correctness.

**Required memories:**

* `typescript.md`

**Scope:**

* Prompt construction
* OpenAI API calls
* Output parsing and validation

**Checklist:**

* Prompt injection resistance
* Data minimization
* Structured output parsing
* Cost controls (token limits, truncation)

---

### Agent 5 — Test & Quality Gatekeeper

**Role:** Enforces verifiability and maintainability.

**Required memories:**

* `testing.md`
* `verify-runtime-before-complete.md`

**Scope:**

* Tests
* Biome linting and formatting
* TypeScript strictness

**Checklist:**

* `npm run format:check` passes
* `npm run lint:check` passes
* `npm run test` passes
* `npm run test:coverage` passes
* `npm run typecheck` passes
* Runtime verification completed when required

**Rules:**

* Do not lower standards to make tests pass

---

### Agent 6 — UI Screenshot & Design Parity Reviewer

**Role:** Reviewer for visual regressions and design fidelity.

**Required memories:**

* `ui-screenshot-verification.md`
* `ui-design-parity-checklist.md`

**Scope:**

* UI screens and flows

**Checklist:**

* Playwright screenshots captured as required
* Screens match intended design
* Regressions explicitly called out

---

### Agent 7 — Docs & Architecture Reviewer

**Role:** Maintains clarity and long-term scalability.

**Required memories:**

* Any documentation-related memory files

**Scope:**

* README
* Architecture docs
* ADRs

**Checklist:**

* Documentation reflects current behavior
* Architectural changes documented
* ADRs added for significant decisions

---

### Agent 8 — App Store Compliance Reviewer (Apple Policy Gate)

**Role:** Reviewer for Apple App Store readiness, policy compliance, and submission risk.

**Required references:**

* `docs/ops/app-store-readiness-checklist.md`
* `docs/ops/privacy-data-disclosure.md`

**Scope:**

* App metadata and runtime policy surfaces (`app.json`, `eas.json`, permissions, privacy disclosures)
* Account/auth/privacy/deletion user flows
* Any changes that can impact App Review acceptance

**Checklist:**

* Required account deletion flow is implemented and discoverable
* Privacy/data-use disclosures are consistent with behavior
* Permissions requested are minimal and justified
* App metadata/config does not conflict with policy requirements
* Submission-risk items are explicitly called out

**Rules:**

* Reviewer-only
* Findings must include policy risk, evidence, and concrete remediation

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

* `app/**`, `components/**`, `designs/**` -> Agent 1 and Agent 6
* `supabase/**`, SQL migrations, repository SQL changes -> Agent 2
* `backend/ocr-worker/**`, API handlers, auth boundary changes -> Agent 3
* OpenAI/LLM prompt or response parsing changes -> Agent 4
* Any test/config/tooling changes -> Agent 5
* Docs and architecture updates -> Agent 7
* App Store policy/compliance surfaces (`app.json`, `eas.json`, app-store/privacy docs, account deletion flows) -> Agent 8

If multiple scopes are touched, dispatch all matching reviewers before completion.

Helper command:

```bash
npm run review:dispatch -- --base origin/main --write-prompts
```

Prompt templates live in `.codex/prompt-templates/review/` and generated prompts are written to `.codex/review-prompts/`.

One-command parallel review run:

```bash
npm run review:run-all -- --base origin/main
```

Results are written to `.codex/review-results/`.

---

## Security Automation Gate

For backend/auth/database/worker changes, run security checks before completion:

```bash
# Secrets and credential patterns
rg -n "api[_-]?key|secret|token|password|private[_-]?key|BEGIN (RSA|EC|OPENSSH)" . --glob '!node_modules/**'

# Dependency audit (best-effort, non-blocking for dev-only advisories unless exploitable)
npm audit --omit=dev
```

If security commands cannot run, document why and provide manual review evidence.

---

## Merge Readiness Gate

A change is merge-ready only when all applicable items are satisfied:

* Verification commands pass (format, lint, tests, coverage, typecheck)
* Runtime verification completed when required
* Required reviewer agents dispatched for changed scopes
* Security automation gate completed for sensitive changes
* UI screenshot/design parity checks completed for visual changes
* Known risks and follow-ups documented

---

## Conflict Resolution Rule

If reviewer findings conflict, the Lead Builder must document:

* Options considered
* Tradeoff analysis
* Final decision and rationale
* Any deferred risk and owner

No merge until the conflict note is recorded in the implementation summary.
