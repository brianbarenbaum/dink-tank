# Testing Stack Checklist (Vitest + Playwright)

Use this when validating test readiness in a project based on this starter.

- Vitest config exists and matches intended test directories.
- At least one unit/smoke test runs via `npm run test`.
- Coverage command runs via `npm run test:coverage`.
- Playwright config exists and base URL strategy is documented.
- E2E command is wired (`npm run test:e2e`) and deterministic.
- UI changes include screenshot verification strategy (see `validation_screenshots/`).
- Test artifacts are ignored in git (`coverage/`, `playwright-report/`, `test-results/`).
