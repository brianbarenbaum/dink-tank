---
name: ui-component-creation
description: Standards for scaffolding and styling Vue 3 components using shadcn-vue and Tailwind.
version: 1.0.0
dependencies: [tailwind-cli, shadcn-vue-cli]
triggers:
  - file_patterns: ["src/components/**/*.vue", "src/pages/**/*.vue"]
  - keywords: ["new component", "refactor UI", "add style"]
---

# Skill: UI Component Creation

## Intent
Use this skill when creating new UI components or refactoring existing Tailwind styles to ensure design consistency and accessibility.

## Constraints
- Do not use arbitrary Tailwind values (e.g., `top-[13px]`) unless absolutely necessary.
- Every component must be keyboard-navigable.

## Accessibility Checklist
- **Contrast:** Ensure WCAG AA compliance for text and UI states.
- **Interactivity:** Inputs/buttons must have accessible names and visible focus states.
- **Keyboard:** All interactive controls must be reachable via Tab.
- **Semantics:** Use proper landmarks/headings (`<main>`, `<h1>`, etc.).

## Step-by-Step Procedure

1. **Check for Primitives:** Check if the requested component exists in `@/components/ui`. If not, check `shadcn-vue` docs to see if it should be installed via CLI.
   
2. **Scaffold the Component:**
   - Use `<script setup lang="ts">`.
   - use `cn()` if present, otherwise plain class strings
   - Define Props using TypeScript interfaces.

3. **Apply Styling Layers:**
   Apply classes in this strict order:
   - **Layout:** `flex`, `grid`, `block`, `position`
   - **Sizing/Spacing:** `w-`, `h-`, `m-`, `p-`
   - **Typography:** `text-`, `font-`
   - **Visuals:** `bg-`, `border-`, `rounded-`
   - **States:** `hover:`, `focus:`, `dark:`

4. **Verify Accessibility:**
   - Ensure `aria-` labels are present for interactive elements.
   - Test color contrast using the Tailwind theme tokens.

5. **Definition of Done:**
   - Component is responsive.
   - `npm run typecheck` passes.
   - Component follows the "thin wrapper" pattern.
