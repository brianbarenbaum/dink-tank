# Tailwind + shadcn-vue UI Conventions

## Applies when
- Editing styles, design tokens, or UI components
- Using shadcn-vue primitives/components

## Required actions
- Prefer shadcn-vue components/composition before creating custom primitives.
- Keep Tailwind classes readable and grouped by layout -> spacing -> typography -> color/state.
- Centralize design tokens in Tailwind/theme variables and avoid hard-coded one-off colors.
- Preserve semantic HTML and accessibility attributes when composing UI.

## Component rules
- Use variant patterns consistently for interactive components.
- Keep custom wrappers thin and behavior-focused.
- Validate responsive behavior for at least mobile and desktop breakpoints.
