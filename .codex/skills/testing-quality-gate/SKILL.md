---
name: testing-quality-gate
description: Full-stack testing workflow using Vitest for units/components and Playwright for E2E/Visual verification.
version: 1.0.0
triggers:
  - file_patterns: ["**/*.test.ts", "**/*.spec.ts", "tests/**/*", "playwright.config.ts"]
  - keywords: ["vitest", "playwright", "test", "coverage", "e2e"]
---

# Skill: Testing & Quality Gate

## Intent
Ensures all changes are verified for correctness, regressions, and UI fidelity before completion.

## Unit & Component Testing (Vitest)
- **Philosophy:** Prefer behavior-driven assertions over implementation details.
- **Setup:** Use `describe/it/expect` and `vi` for mocks. Keep setups local to the test file unless fixtures are truly global.
- **Async:** Use `await`-based assertions and explicit timeout expectations for reactive changes.
- **Regression:** New bug fixes **must** include a corresponding regression test.

## E2E & Visual Testing (Playwright)
- **Selectors:** Use stable, accessible selectors (`getByRole`, `getByLabel`). Use `data-testid` only as a last resort.
- **Visuals:** Capture screenshots for visual changes in `validation_screenshots/`.
- **Environment:** Keep the base URL configurable via `PLAYWRIGHT_BASE_URL`.
- **Isolation:** Tests must be deterministic and avoid network dependencies unless specifically required.

## Visual Regression (Playwright)
- **Output:** Save images to `validation_screenshots/` at project root.
- **Naming:** Use clear filenames: `<route>-<interaction>-<viewport>.png`.
- **Command:** `PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test`
- **Rule:** Re-capture screenshots after any parity issues are fixed to confirm the "Golden Image."

## Mandatory Execution (The Gate)
Before marking any task as complete, the following must pass:
  * `npm run format:check` passes
  * `npm run lint:check` passes
  * `npm run test` passes
  * `npm run test:coverage` passes
  * `npm run test:e2e` passes (or documented rationale if intentionally skipped)
  * `npm run typecheck` passes


## Definition of Done
- Tests pass locally.
- Test coverage is maintained or improved (`npm run test:coverage`).
- Failures are documented with manual evidence if scripts cannot run.
