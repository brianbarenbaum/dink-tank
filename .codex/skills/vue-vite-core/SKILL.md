---
name: vue-vite-core
description: Standards for Vue 3 SFCs, Composition API patterns, and Vite build configuration.
version: 1.1.0
triggers:
  - file_patterns: ["src/**/*.vue", "src/composables/**/*.ts", "vite.config.ts"]
  - keywords: ["ref", "reactive", "script setup", "composition api", "composable", "vite"]
---

# Skill: Vue & Vite Core Architecture

## Intent
Standardizes the development of Vue 3 components and the Vite-driven build environment.

## Development Standards
- **SFC Pattern:** Exclusively use `<script setup lang="ts">`.
- **Logic Separation:** Keep component logic "thin." Move shared or complex logic into `composables/`.
- **Composition API:**
  - Type all `props` and `emits` using `defineProps<T>()` and `defineEmits<T>()`.
  - Keep props immutable.
  - Use `computed` for all derived state; reserve `watch` for side effects.
  - Clean up listeners/subscriptions in `onUnmounted`.
- **State Selection:** Use `ref` for primitives and `reactive` for grouped state where it improves clarity.
- When triggering async work from `watch`, `watchEffect`, lifecycle hooks, or composables, prevent stale requests from mutating reactive state after dependencies change.
  - Use `AbortController` (preferred) or an invalidation flag and cancel/ignore outdated requests.
  - In `watch`/`watchEffect`, use cleanup (`onInvalidate`) to cancel pending work before next run.
  - Update reactive state only for the latest active request.
  - Keep async logic in composables when reused by multiple components.

## Vite & Build Environment
- **Configuration:** Keep `vite.config.ts` minimal; avoid excessive plugin magic.
- **Environment:** Use `import.meta.env` for environment values. Only variables prefixed with `VITE_` are exposed to the client.
- **Pathing:** Use the `@/` path alias consistently for `src/` imports.
- **Performance:** Avoid dynamic imports unless they provide a measurable performance or route-splitting benefit.

## Definition of Done
- Component logic is composable.
- Code remains compatible with Strict TypeScript mode.
- Loading and error states are handled explicitly.
