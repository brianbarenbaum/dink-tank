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
Runtime verification is also required for code/config changes per `.codex/skills/testing-quality-gate/SKILL.md`.

---

## Agent Cards

### Agent 0 - Lead Builder (Primary Writer)

**Role:** Senior engineer responsible for all implementation changes.

**Skill Routing:**
- Trigger `vue-vite-core` for `.vue` and composable/runtime architecture changes.
- Trigger `state-management-pinia` for store logic.
- Trigger `typescript-development` for TypeScript-heavy logic changes.
- Trigger `ui-component-creation` for structure/composition/accessibility of components.
- Trigger `responsive-ui` for breakpoint/layout/touch-target behavior.
- Trigger `testing-quality-gate` before finalizing any task.

**Responsibilities:**

* Clarify goal and acceptance criteria
* Identify files to change and why
* Implement changes with minimal diffs
* Run verification commands
* Integrate reviewer feedback

---

### Agent 1 - Frontend UI & UX Reviewer (Vue + shadcn-vue + Tailwind)

**Role:** Reviewer for UI correctness, responsiveness, accessibility, and design parity.

**Instructions:** Whenever a component is changed, review against `responsive-ui` and `ui-component-creation` criteria.

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
**Directive:** Invoke `testing-quality-gate`. Ensure all unit and E2E suites pass with no regressions.

---

### Agent 6 - UI Screenshot & Design Parity Reviewer
**Role:** Reviewer for visual regressions.
**Directive:** Follow visual regression criteria in `testing-quality-gate` and compare `validation_screenshots/` against design references.

---

### Agent 7 - Docs & Architecture Reviewer

**Role:** Maintains clarity and long-term scalability.

**Scope:**

* README
* Architecture docs
* ADRs
* Agent/skill docs

---

### Agent 8 - Web Security, Privacy & Accessibility Reviewer

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
