---
name: context-7
description: Use when implementing or debugging code that depends on third-party libraries/frameworks and accurate, current documentation is required.
---

# Context7 Documentation Workflow

## Overview
Use Context7 as the default source for up-to-date library/framework documentation before making implementation decisions.

## When to Use
- Adding a new library integration.
- Configuring library features, APIs, or framework conventions.
- Debugging behavior that may differ by library version.
- Generating examples that must match current docs.

## Core Rules
1. Resolve the library ID first with `mcp__context7__resolve-library-id`.
2. Then fetch docs with `mcp__context7__query-docs` using that exact ID.
3. Use specific queries (include framework version/context if known).
4. If results are ambiguous, ask a clarifying question before guessing.
5. Do not call Context7 more than 3 times per question unless the user explicitly asks for deeper research.

## Quick Procedure
1. Identify library name from user request or codebase.
2. Resolve library ID.
3. Query docs for the exact task (API usage, setup, migration, edge case).
4. Implement based on the retrieved guidance.
5. Cite the source path/title in the response when relevant.

## Common Mistakes
- Skipping library ID resolution and querying the wrong project.
- Using broad queries like "auth" instead of targeted queries.
- Mixing advice from memory with docs when version behavior is uncertain.
