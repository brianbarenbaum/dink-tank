# Testing (Jest + RNTL + Playwright)

## Applies when
- Adding/modifying tests anywhere
- Changing code paths that have tests or should have tests
- Modifying Gluestack components or expo-router screens that require mocking patterns

## Priority
- Jest-only is non-negotiable; do not introduce Vitest.

## Required actions
- Use Jest + RNTL for unit/component tests; Playwright for E2E/screenshots
- Follow the project test patterns described below
- Before completing relevant work: run `npm run test` (and `npm run test:coverage` when requested or warranted)


See `expo.md` for overall rules precedence and project-wide conventions.

Always use **Jest** for unit and component tests. Never use or introduce Vitest in this project. Playwright is used for E2E and screenshot verification.

## Unit and component tests

- **Jest** + React Native Testing Library. See `jest.config.js`, `npm test`.
- Use Jest APIs only: `jest.fn()`, `jest.mock()`, `jest.spyOn()`.
- Test layout: `__tests__/` next to the code under test; `*.test.ts` or `*.test.tsx`.
- Prefer built-in RNTL matchers; migrate off `@testing-library/jest-native` when convenient (it is deprecated; RNTL v12.4+ has built-in matchers).

## Project test patterns

- **Gluestack:** When testing components that use Gluestack UI, wrap the rendered tree with `GluestackUIProvider` and `config` from `@gluestack-ui/config` (see `components/__tests__/BookCard.test.tsx`, `app/__tests__/index.test.tsx`).
- **JSON imports:** When the code under test imports JSON (e.g. `data/books.json`), mock the module with `jest.mock("path/to/file.json", () => ({ __esModule: true, default: [...] }), { virtual: true })` so Jest can resolve it.
- **expo-router:** For screens that use `useRouter()`, mock `expo-router` to provide `push` and `back` (e.g. `jest.fn()`) so navigation can be asserted without running the router.
- **Context:** For screens that use a context (e.g. `useBooks()`), either wrap the test render with the real provider (e.g. `BooksProvider`) and mock the provider's data (e.g. `books.json`), or mock the context module and supply mock implementations of the hook's return value.
- **Screen wrapper:** For app screens, render inside `Screen` or ensure the test tree includes equivalent safe-area/background handling.
- **Fake timers and async:** When a test advances time with `jest.advanceTimersByTime()`, wrap the advance in `act()` so React state updates are flushed. For assertions that depend on async state (e.g. after a mocked API resolves), use `waitFor()`. For tests that need to assert a loading state, avoid resolving mocked promises immediately; use a deferred promise (or delayed resolve) so the loading UI is visible before the result is applied.

## E2E and screenshots

- **Playwright**: `scripts/screenshot-iphone14.ts`, `npm run screenshot:iphone14`.
- After layout/styling changes, run screenshot and compare to `designs/`.

## Before marking complete

- Run `npm test` when the task touched code that has tests.
