# Pinia Best Practices

## Applies when
- State management is needed across routes/components
- Local state logic becomes complex, mutation-heavy, or hard to reason about

## Decision rule
- Start with Vue Composition API local/composable state.
- Move to Pinia when state is shared, persistent, or involves multi-step actions/business rules.

## Required actions
- Use setup-style stores with explicit TypeScript typing.
- Keep state minimal, normalized, and serializable where possible.
- Put side effects and async flows in store actions, not scattered across components.
- Use getters for derived state instead of duplicating computed values.
- Keep stores domain-focused (one bounded responsibility per store).

## Usage guidelines
- Components consume stores and keep UI-only state local.
- Avoid deeply nested store coupling; compose stores carefully through actions.
- Keep persistence strategy explicit (for example, opt-in persisted keys only).
- Test store actions and business rules with Vitest.
