# Runtime Verification Before Completion

## When
Before marking a task complete whenever code or config changed.

If the `verification-before-completion` skill applies, follow it first and treat this file as project-specific addenda.

## Required checks
- Ensure the Vite dev server runs (start if needed with `npm run dev`).
- Verify there are no terminal or browser-console runtime errors.
- Run `npm run test` when code paths with tests are touched.
- Run `npm run typecheck` after TypeScript/Vue code changes.

## Error classes to treat as blockers
- Build/module resolution errors
- Type errors surfaced during runtime tooling
- Uncaught runtime exceptions and render failures
- Failing test suites or broken critical user flows

## Scope
Prefer web runtime verification unless a change is backend-only.
