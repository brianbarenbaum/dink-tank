# Vue Composition API Best Practices

## Applies when
- Writing or editing Vue components and composables

## Required actions
- Prefer `<script setup>` and type all props/emits.
- Keep props immutable and use explicit `defineEmits` contracts.
- Use computed values for derived state and watchers only for side effects.
- Put reusable async/data logic in composables with clear return shapes.

## Patterns
- Use `ref` for primitives and `reactive` for grouped state when it improves clarity.
- Expose small, focused composables with explicit names and narrow responsibilities.
- Handle loading/error states explicitly in composables and components.
- Clean up subscriptions/listeners in `onUnmounted`.
