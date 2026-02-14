# Vite + Vue 3 Conventions

## Applies when
- Changing `src/**`, `index.html`, `vite.config.*`, or app bootstrap/runtime config
- Adding or modifying Vue components, routes, or build-time environment usage

## Required actions
- Use Vue 3 Single File Components and prefer `<script setup lang="ts">`.
- Keep Vite config minimal and explicit; avoid hidden plugin magic.
- Use `import.meta.env` for runtime environment values and only expose variables prefixed with `VITE_`.
- Use path aliases consistently (for example `@/`) when configured.

## Project standards
- Keep component logic composable and move shared logic to `composables/`.
- Prefer local component/composable state first; adopt Pinia when state becomes cross-route, multi-component, or mutation-heavy.
- Avoid dynamic imports unless they provide clear route or performance value.
- Ensure changes remain compatible with strict TypeScript mode.
