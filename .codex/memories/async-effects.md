# Async work from useEffect

When triggering async work (e.g. API search) from `useEffect` in response to user input or a debounced value, prevent stale results from updating state after the effect has been torn down or dependencies have changed.

- Use a **cancellation guard**: set a boolean (e.g. `cancelled`) or use `AbortController` inside the effect, and in the effect's cleanup set `cancelled = true` (or `abort()`). In the async callback (e.g. `.then()`), only call state setters if `!cancelled` (or the request was not aborted).
- Example: `app/add-book.tsx` (search effect with `cancelled` and cleanup return).
