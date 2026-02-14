# Vue Starter Kit Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert this Expo/Gluestack-focused Codex starter into a Vite + Vue 3 + Tailwind + shadcn-vue + Vitest + Playwright starter kit with matching agent workflow, memories, templates, docs, and automation.

**Architecture:** Keep the repository as a workflow/template skeleton (not a full app). Replace React Native/Expo assumptions with web-first Vue conventions, keep Codex multi-agent review automation, and standardize verification gates around Biome (or equivalent), TypeScript, Vitest, and Playwright. Use minimal diffs where possible, but fully rewrite files whose current purpose is stack-specific.

**Tech Stack:** Vue 3, Vite, TypeScript, Tailwind CSS, shadcn-vue, Vitest, Playwright, Codex review automation scripts.

---

### Task 1: Baseline stack contract and naming alignment

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Modify: `scripts/create-github-template.sh`

**Step 1: Rename template identity and stack language**
- Update starter naming from `codex-expo-starter` to Vue/Vite naming.
- Replace all mentions of Expo, React Native, Gluestack, NativeWind, Jest with Vue/Vite equivalents.

**Step 2: Define canonical verification commands in package scripts**
- Add/confirm scripts for:
  - `format:check`
  - `lint:check`
  - `typecheck`
  - `test` (Vitest)
  - `test:coverage` (Vitest coverage)
  - `test:e2e` (Playwright)
- Keep existing review automation commands.

**Step 3: Align bootstrap script messaging**
- Update `create-github-template.sh` commit message/repo default name to Vue starter language.

**Step 4: Verification**
Run:
```bash
npm run review:dispatch
```
Expected: script runs successfully and reflects updated file set without Expo-specific references in output.

**Step 5: Commit**
```bash
git add README.md package.json scripts/create-github-template.sh
git commit -m "chore: align starter identity and base scripts for vite vue"
```

### Task 2: Rewrite core agent workflow for web Vue stack

**Files:**
- Modify: `.codex/AGENTS.md`
- Modify: `AGENTS.md`

**Step 1: Replace stack-bound sections in `.codex/AGENTS.md`**
- Update Agent 0 required memories from Expo to Vue/Vite/Tailwind/testing memories.
- Replace Agent 1 from “Mobile UI Specialist” to “Web UI Specialist (Vue + shadcn-vue + Tailwind)”.
- Replace App Store compliance agent with a relevant web-focused reviewer (e.g., “Web Security, Privacy & Accessibility Reviewer”) or explicitly mark optional/removable if not used.

**Step 2: Update mandatory dispatch rules**
- Replace `app/**`/mobile paths with Vue paths (`src/**`, `components/**`, `pages/**`, `composables/**`, `tests/**`, `e2e/**`, config files).
- Keep security and docs dispatch rules where applicable.

**Step 3: Update verification commands in `.codex/AGENTS.md`**
- Ensure required command list includes Vitest and Playwright:
  - `npm run format:check`
  - `npm run lint:check`
  - `npm run test`
  - `npm run test:coverage`
  - `npm run test:e2e`
  - `npm run typecheck`

**Step 4: Keep top-level `AGENTS.md` pointer stable**
- Confirm entry-point file still correctly points to `.codex/AGENTS.md` and memories.

**Step 5: Commit**
```bash
git add .codex/AGENTS.md AGENTS.md
git commit -m "docs: migrate codex agent workflow to vue web stack"
```

### Task 3: Replace/introduce memories for Vue/Vite best practices

**Files:**
- Delete: `.codex/memories/expo.md`
- Delete: `.codex/memories/ui-fab-positioning.md` (unless generalized)
- Delete: `.codex/memories/ui-screen-wrapper.md` (replace with Vue layout memory)
- Delete: `.codex/memories/ui-contrast-inputs.md` (replace with web a11y memory)
- Delete: `.codex/memories/ui-design-parity-checklist.md` (replace with design parity for web)
- Create: `.codex/memories/vite-vue.md`
- Create: `.codex/memories/vue-composition-api.md`
- Create: `.codex/memories/tailwind-shadcn-vue.md`
- Create: `.codex/memories/testing-vitest-playwright.md`
- Create: `.codex/memories/web-accessibility-ui-checklist.md`
- Modify: `.codex/memories/testing.md`
- Modify: `.codex/memories/verify-runtime-before-complete.md`
- Modify: `.codex/memories/ui-screenshot-verification.md` (Playwright web pathing)
- Keep and review: `.codex/memories/typescript.md`, `.codex/memories/async-effects.md`

**Step 1: Define memory taxonomy**
- Separate framework memory (`vite-vue.md`) from UI system memory (`tailwind-shadcn-vue.md`) and test memory (`testing-vitest-playwright.md`).
- Keep memories small and non-overlapping.

**Step 2: Encode accepted best practices**
- Vite/Vue: plugin-vue, path aliases, env via `import.meta.env` + `VITE_` prefix.
- Vue 3: `<script setup>`, composables, prop/emits typing, avoid overusing global stores.
- Tailwind/shadcn-vue: token consistency, component composition, class variance authority conventions where used.
- Vitest: jsdom/unit strategy, mocking patterns, coverage expectations.
- Playwright: deterministic e2e, trace/video policy, screenshot location and naming standards.

**Step 3: Update runtime verification memory**
- Replace Expo startup guidance with Vite dev server + browser console checks.
- Require running `npm run test` and `npm run typecheck` when code changes occur.

**Step 4: Commit**
```bash
git add .codex/memories
git commit -m "docs: replace expo memories with vite vue and testing standards"
```

### Task 4: Rewrite reviewer prompt templates for new stack

**Files:**
- Modify: `.codex/prompt-templates/review/agent-1-mobile-ui.md`
- Modify: `.codex/prompt-templates/review/agent-5-test-quality.md`
- Modify: `.codex/prompt-templates/review/agent-6-ui-parity.md`
- Modify: `.codex/prompt-templates/review/agent-8-web-security-privacy-accessibility.md` (replace or repurpose)
- Review and keep as-needed: agents 2/3/4/7 templates

**Step 1: Update stack-specific review scope text**
- Agent 1: Vue components, Tailwind classes, shadcn-vue composition, responsive web a11y.
- Agent 5: Vitest + Playwright + typecheck + lint/format gates.
- Agent 6: web screenshots, design parity across desktop/mobile breakpoints.

**Step 2: Handle Agent 8 strategy explicitly**
- Option A (recommended): repurpose to “Web Delivery Compliance” (headers, CSP, auth/session/privacy docs, deployment hygiene).
- Option B: remove agent 8 and renumbering avoidance strategy (leave slot reserved to prevent script churn).

**Step 3: Commit**
```bash
git add .codex/prompt-templates/review
 git commit -m "docs: retarget reviewer prompt templates for vue web stack"
```

### Task 5: Update review dispatch and runner scripts for Vue paths/tooling

**Files:**
- Modify: `scripts/review-dispatch.sh`
- Modify: `scripts/review-run-all.sh`

**Step 1: Update path matching rules in dispatch script**
- Map UI changes from mobile folders to Vue project layout:
  - `src/components/**`, `src/pages/**`, `src/layouts/**`, `src/App.vue`
- Map testing/config triggers:
  - `vitest.config.*`, `playwright.config.*`, `tailwind.config.*`, `postcss.config.*`, `vite.config.*`, `components.json`, `src/**/*.test.*`, `e2e/**`

**Step 2: Update script help text/examples**
- Remove Expo-specific references and ensure descriptions match Vue starter behavior.

**Step 3: Preserve parallel reviewer execution semantics**
- Keep model override behavior and output directories unchanged unless intentionally redesigned.

**Step 4: Verification**
Run:
```bash
bash scripts/review-dispatch.sh --write-prompts
bash scripts/review-run-all.sh --mode uncommitted --agents 5,7
```
Expected: prompts/results generated with updated agent scope and no broken template references.

**Step 5: Commit**
```bash
git add scripts/review-dispatch.sh scripts/review-run-all.sh
git commit -m "chore: align review automation with vue project layout"
```

### Task 6: Update setup workflow, MCP config guidance, and template checklist

**Files:**
- Modify: `scripts/setup.sh`
- Modify: `.codex/config.toml`
- Modify: `docs/template-customization-checklist.md`

**Step 1: Remove gluestack MCP install assumptions**
- `setup.sh` should install root dependencies only (or optional MCP servers that still apply).

**Step 2: Refresh MCP config comments**
- Keep Context7 and Supabase examples if still relevant, but remove Expo-oriented framing.
- Add note for optional libraries/docs MCPs relevant to Vue ecosystem if desired.

**Step 3: Update checklist to Vue-specific validation**
- Include checks for Vitest/Playwright configs, Tailwind + shadcn-vue setup sanity, and review script mapping.

**Step 4: Commit**
```bash
git add scripts/setup.sh .codex/config.toml docs/template-customization-checklist.md
git commit -m "docs: refresh setup and customization checklist for vue starter"
```

### Task 7: Refresh env template, gitignore, and CI verification gates

**Files:**
- Modify: `.env.example`
- Modify: `.gitignore`
- Modify: `.github/workflows/verify.yml`

**Step 1: Replace env variable guidance for Vite/web**
- Keep shared API tokens (Context7/OpenAI/Supabase) as needed.
- Add placeholders for web app vars using `VITE_` prefix examples.

**Step 2: Expand `.gitignore` for web build/test artifacts**
- Add typical Vite/Playwright artifacts:
  - `dist/`
  - `.vite/`
  - `playwright-report/`
  - `test-results/`
  - `*.tsbuildinfo`
- Keep existing Codex runtime artifact exclusions.

**Step 3: Upgrade CI workflow from smoke to verification gate**
- Add commands (as scripts exist): format/lint/typecheck/test/test:coverage.
- Add Playwright job or keep e2e optional with explicit condition/documented reason.

**Step 4: Commit**
```bash
git add .env.example .gitignore .github/workflows/verify.yml
git commit -m "ci: align env ignore and verification gates with vite vue tooling"
```

### Task 8: README and starter docs finalization

**Files:**
- Modify: `README.md`
- Create: `docs/checklists/vue-starter-readiness.md`
- Create: `docs/checklists/testing-stack-checklist.md`

**Step 1: Rewrite README to be the canonical onboarding doc**
- Include starter purpose, included assets, setup, customization order, and verification commands.
- Include section “How to adapt memories and agents for your app domain”.

**Step 2: Add explicit readiness checklists**
- Checklist 1: starter adoption readiness (agent files, memories, scripts, CI, env).
- Checklist 2: testing readiness (Vitest unit coverage + Playwright e2e baseline).

**Step 3: Cross-link docs**
- Link from README to docs checklists and plan file location.

**Step 4: Commit**
```bash
git add README.md docs/checklists
 git commit -m "docs: add vue starter onboarding and readiness checklists"
```

### Task 9: End-to-end verification and migration sign-off

**Files:**
- Modify (if needed): any files with stale Expo/Jest/Gluestack references found by grep

**Step 1: Run stack-reference sweeps**
Run:
```bash
rg -n "Expo|React Native|Gluestack|NativeWind|Jest|expo-router|app store" .
```
Expected: no stale references except intentionally retained historical notes.

**Step 2: Run verification suite**
Run:
```bash
npm run format:check
npm run lint:check
npm run test
npm run test:coverage
npm run typecheck
npm run review:dispatch
```
If `test:e2e` is configured and runnable in CI/local:
```bash
npm run test:e2e
```

**Step 3: Runtime sanity check guidance**
- Ensure documented runtime check references Vite dev flow (`npm run dev`) and browser console monitoring.

**Step 4: Final commit**
```bash
git add -A
git commit -m "chore: complete migration of codex starter from expo to vite vue"
```

---

## Recommended execution strategy

1. Execute Tasks 1-3 first to establish stack truth in AGENTS/memories.
2. Execute Tasks 4-5 next so reviewer automation matches new rules early.
3. Execute Tasks 6-8 to align setup/docs/CI.
4. Execute Task 9 as the final quality gate.

## Risk notes

- Highest risk is partial migration where memory files and dispatch scripts disagree on stack assumptions.
- Secondary risk is CI/script drift where `package.json` scripts do not match AGENTS verification commands.
- Mitigation: make AGENTS command list and package scripts the single source of truth, then validate by running all gates.
