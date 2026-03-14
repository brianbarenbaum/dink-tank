# Project Roadmap: Dink Tank

## Product Goal

Dink Tank is an authenticated Cross Club Pickleball assistant that helps users:

- retrieve stats quickly
- browse structured league data without writing SQL
- generate data-driven lineup recommendations

The product should reduce the friction of navigating the Cross Club data model while preserving trust, correctness, and strong debugging visibility.

## Experience Direction

- Core interface: modern chat product with a light terminal-inspired aesthetic
- Visual language: green-on-black influence without sacrificing readability
- Platforms: mobile, tablet, and desktop must all remain first-class
- Design references:
  - `/designs/chat_desktop.png`
  - `/designs/chat_mobile.png`
  - `/designs/lineup_lab.png`
  - `/designs/lineup_lab_new.png`

The design target is directional parity, not frozen pixel parity. Iteration is expected.

## Core Capabilities

1. Chat-driven stat retrieval
   - Natural-language questions over Cross Club data
   - Worker-backed SQL agent with safety guardrails

2. Structured data browsing
   - Tree-based navigation of seasons, divisions, teams, and query leaves
   - Direct-query cards and tables for non-chat exploration

3. Lineup optimization
   - Blind mode for available-player recommendation
   - Known-opponent mode for schedule-aware matchup planning

4. Authenticated application shell
   - Email OTP sign-in
   - Worker-side session validation
   - Protected `/api/*` routes

## Platform Assumptions

- Frontend: Vue 3 + Vite + Tailwind + shadcn-vue + Pinia + TypeScript
- Backend runtime: Cloudflare Workers
- Data: Supabase Postgres plus ingestion pipeline for Cross Club data
- LLM integration: LangChain SQL agent
- Testing: Vitest and Playwright

## Constraints

- Source data structure and access patterns come from Cross Club
- Lineup recommendations must account for player availability and matchup context
- Auth, SQL safety, and worker-side validation are product requirements, not optional enhancements
- The repo should remain operable by future coding sessions without full cold-start re-discovery
