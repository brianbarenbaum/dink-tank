---
name: typescript-development
description: Strict TypeScript conventions, naming standards, and architectural patterns.
version: 1.0.0
triggers:
  - file_patterns: ["**/*.ts", "**/*.tsx"]
  - keywords: ["interface", "type", "generics", "enum", "tsconfig", "refactor ts"]
---

# Skill: TypeScript Development

## Intent
Ensures strict type safety, consistent naming, and robust error handling across the codebase.

## Core Procedures

### 1. Type Definitions & Strictness
- **Prefer Interfaces:** Use `interface` for object definitions; use `type` for unions, intersections, and mapped types.
- **Safety First:** Avoid `any`. Prefer `unknown` with type guards. Use `readonly` for immutable properties.
- **Library Overrides:** When a library type excludes a runtime-supported value, use the narrowest possible type assertion and add a one-line comment explaining why.

### 2. Naming Conventions
- **Types/Interfaces:** `PascalCase`.
- **Variables/Functions:** `camelCase`.
- **Constants:** `UPPER_CASE`.
- **Booleans:** Use auxiliary verbs (e.g., `isLoading`, `hasError`).
- **Vue Props:** Prefix component prop interfaces with `Props` (e.g., `ButtonProps`).

### 3. Functions & Async Logic
- **Explicit Returns:** Public functions must have explicit return types.
- **Async Pattern:** Prefer `async/await` over raw `.then()` Promises.
- **Arrow Functions:** Use for callbacks and class methods.

### 4. Code Organization
- Keep definitions close to usage.
- Use barrel exports (`index.ts`) for organizing modules.
- Place globally shared types in `@/types/`.
- Co-locate component props within the `.vue` file or an adjacent `.ts` file.

### 5. Advanced Patterns & Error Handling
- **Pattern Usage:** Use **Builder** for complex objects, **Repository** for data access, and **Factory** for object creation.
- **Result Type:** Use Result types (Success/Failure) for operations that can fail.
- **Error Types:** Create custom error classes for domain-specific errors.
- **Discriminated Unions:** Leverage these for state-dependent logic safety.

## Definition of Done
- `npm run typecheck` passes with zero errors.
- No `any` types introduced.
- Function overloads are documented if used.
