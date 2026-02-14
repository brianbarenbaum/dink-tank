---
name: state-management-pinia
description: Advanced state management using Pinia with setup-store patterns and strict TypeScript integration.
version: 1.0.0
triggers:
  - file_patterns: ["src/stores/**/*.ts", "src/stores/**/*.js"]
  - keywords: ["pinia", "store", "useStore", "defineStore", "global state"]
---

# Skill: Pinia State Management

## Intent
Use this skill when global state is required, when local logic becomes mutation-heavy, or when state must persist across routes.

## Core Procedures

### 1. Decision Framework
- **Local First:** Always start with Vue Composition API (`ref`, `reactive`) or local composables.
- **Promote to Pinia:** Migrate only when state is shared, persistent, or involves complex multi-step business rules.

### 2. Store Architecture (Setup-Style)
- **Pattern:** Use the `defineStore('id', () => { ... })` syntax.
- **Typing:** Use explicit TypeScript interfaces for State, Getters, and Actions.
- **Responsibility:** Keep stores domain-focused (One store per bounded context).

### 3. Implementation Rules
- **Minimal State:** Keep state normalized and serializable. Avoid deep nesting where possible.
- **Side Effects:** All async flows and API calls **must** live in actions, not components.
- **Derived State:** Use `computed()` as getters to prevent duplicated state.
- **Coupling:** Avoid deeply nested store dependencies; compose them via action calls if necessary.

### 4. Persistence & Testing
- **Persistence:** Use an explicit strategy (e.g., opt-in keys via `pinia-plugin-persistedstate`).
- **Testing:** Test store actions and business rules in isolation using Vitest.

## Definition of Done
- Store is exported using the `use[Name]Store` convention.
- All actions are properly typed.
- Component-only state remains local to the SFC.
