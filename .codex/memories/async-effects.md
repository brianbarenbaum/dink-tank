# Async Effects in Vue

When triggering async work from `watch`, `watchEffect`, lifecycle hooks, or composables, prevent stale requests from mutating reactive state after dependencies change.

- Use `AbortController` (preferred) or an invalidation flag and cancel/ignore outdated requests.
- In `watch`/`watchEffect`, use cleanup (`onInvalidate`) to cancel pending work before next run.
- Update reactive state only for the latest active request.
- Keep async logic in composables when reused by multiple components.
