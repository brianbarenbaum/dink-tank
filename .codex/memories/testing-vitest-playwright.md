# Testing (Vitest + Playwright)

## Applies when
- Adding or modifying tests
- Changing code paths that should be covered by unit, component, or E2E tests

## Required actions
- Use Vitest for unit/component tests.
- Use Playwright for end-to-end and screenshot verification.
- Add regression tests for bug fixes.
- Keep tests deterministic and avoid network dependency unless explicitly required.

## Unit/component guidance (Vitest)
- Prefer behavior-driven assertions over implementation details.
- Use `describe/it/expect` from Vitest and `vi` for mocks/spies.
- Keep test setup local unless shared fixtures are clearly reusable.
- For async behavior, use `await`-based assertions and explicit timeout expectations.

## E2E guidance (Playwright)
- Use stable selectors (`getByRole`, `getByLabel`, `data-testid` only when needed).
- Capture screenshots for visual changes in `validation_screenshots/`.
- Keep base URL configurable via `PLAYWRIGHT_BASE_URL`.

## Before marking complete
- Run `npm run test` and `npm run typecheck` for code changes.
- Run `npm run test:e2e` when E2E-impacting changes are made.
