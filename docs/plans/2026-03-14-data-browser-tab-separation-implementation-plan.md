# Data Browser Tab Separation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the Data Browser out of chat into its own top-level tab and dedicated page surface, with a single active result card and infinite scrolling instead of transcript-style card accumulation.

**Architecture:** Keep the existing authenticated routed shell and top navigation, but introduce a dedicated `/data-browser` route and `DataBrowserTabShell` surface. Refactor the data-browser controller so it owns a single active card plus tree state, allowing the current selection to persist across in-app tab switches within the same SPA session. Reuse the existing direct-query card/table rendering components where possible, but replace pagination controls with infinite-scroll loading for the dedicated page.

**Tech Stack:** Vue 3 SFCs with `<script setup lang="ts">`, Vite, Vue Router, Pinia-compatible controllers, Vitest component/unit tests, Playwright for E2E verification.

---

### Task 1: Capture the New Tab and Routing Contract

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/pages/ProtectedShellPage.vue`
- Test: `tests/app-tabs.test.ts`

**Step 1: Write the failing tests**

Cover:
- top tabs render in order `Chat | Data Browser | Lineup Lab`
- `/data-browser` renders the protected shell with a dedicated data browser surface
- `/` still redirects to `/chat`
- chat no longer renders the data-browser tree in its sidebar

**Step 2: Run the targeted tests to verify they fail**

Run:
- `npm run test -- tests/app-tabs.test.ts tests/chat-shell-render.test.ts`

Expected: FAIL with missing route/tab/sidebar expectations.

**Step 3: Implement the routing and shell branching**

Make these changes:
- add authenticated route `/data-browser`
- update `ProtectedShellPage.vue` active-tab logic to include `data_browser`
- insert the new top tab between `Chat` and `Lineup Lab`
- branch sidebar and main content rendering so chat, data browser, and lineup lab each get their own surface

**Step 4: Run the targeted tests to verify they pass**

Run:
- `npm run test -- tests/app-tabs.test.ts tests/chat-shell-render.test.ts`

Expected: PASS.

### Task 2: Separate Chat Sidebar Content from Data Browser Content

**Files:**
- Modify: `src/features/chat/components/ChatSidebarContent.vue`
- Create: `src/features/data-browser/components/DataBrowserSidebarContent.vue`
- Modify: `tests/chat-sidebar-data-browser.test.ts`

**Step 1: Write the failing tests**

Cover:
- chat sidebar no longer contains the `Data Browser` section
- new data-browser sidebar renders the existing tree directly, with the same scroll treatment and without the extra top-level `Data Browser` accordion header

**Step 2: Run the targeted tests to verify they fail**

Run:
- `npm run test -- tests/chat-sidebar-data-browser.test.ts`

Expected: FAIL.

**Step 3: Implement the sidebar split**

Make these changes:
- simplify `ChatSidebarContent.vue` to chat-only controls
- create a dedicated sidebar content component for the data-browser route that directly renders `DataBrowserTree`
- preserve the current scroll region, caret directions, and lazy-load branch behavior

**Step 4: Run the targeted tests to verify they pass**

Run:
- `npm run test -- tests/chat-sidebar-data-browser.test.ts`

Expected: PASS.

### Task 3: Refactor Data Browser Controller State to a Single Active Card

**Files:**
- Modify: `src/features/chat/data-browser/useDataBrowserController.ts`
- Modify: `src/features/chat/types.ts`
- Test: `tests/data-browser-controller.test.ts`

**Step 1: Write the failing tests**

Cover:
- controller exposes a single active card ref and a “has selection in session” state
- division leaf clicks replace the active card instead of appending transcript items
- sorting updates the active card in place and resets to page 1
- loading the next page appends rows into the existing active table card

**Step 2: Run the targeted tests to verify they fail**

Run:
- `npm run test -- tests/data-browser-controller.test.ts`

Expected: FAIL.

**Step 3: Implement the controller refactor**

Make these changes:
- keep season/division/team tree state as-is
- add active-card state, selection persistence for current SPA session, and incremental row-loading state
- add dedicated actions for division leaves, team leaves, sorting, and loading the next page
- keep request building typed and reset page to 1 on sort changes

**Step 4: Run the targeted tests to verify they pass**

Run:
- `npm run test -- tests/data-browser-controller.test.ts`

Expected: PASS.

### Task 4: Build the Dedicated Data Browser Page Shell

**Files:**
- Create: `src/features/data-browser/components/DataBrowserTabShell.vue`
- Modify: `src/pages/ProtectedShellPage.vue`
- Test: `tests/data-browser-leaf-click.test.ts`

**Step 1: Write the failing tests**

Cover:
- `/data-browser` shows an empty state when nothing has been selected in-session
- clicking a division leaf shows a single loading card, then a single hydrated card
- clicking another leaf replaces the currently visible card instead of creating another one

**Step 2: Run the targeted tests to verify they fail**

Run:
- `npm run test -- tests/data-browser-leaf-click.test.ts`

Expected: FAIL.

**Step 3: Implement the dedicated page shell**

Make these changes:
- create a dedicated main panel component for the data-browser route
- render empty state, loading card, error card, and single active card states
- wire the new shell to the refactored controller
- preserve session selection while switching tabs/routes inside the shell

**Step 4: Run the targeted tests to verify they pass**

Run:
- `npm run test -- tests/data-browser-leaf-click.test.ts`

Expected: PASS.

### Task 5: Replace Pagination with Infinite Scroll

**Files:**
- Modify: `src/features/chat/components/DirectQueryTableCard.vue`
- Modify: `src/features/data-browser/components/DataBrowserTabShell.vue`
- Modify: `tests/direct-query-table-card.test.ts`

**Step 1: Write the failing tests**

Cover:
- pagination buttons are no longer rendered on the dedicated data-browser page flow
- sorting controls remain available on sortable columns
- when more results are available, loading the next page appends rows and shows incremental loading affordances instead of replacing the card body

**Step 2: Run the targeted tests to verify they fail**

Run:
- `npm run test -- tests/direct-query-table-card.test.ts`

Expected: FAIL.

**Step 3: Implement infinite scrolling**

Make these changes:
- add a page-shell-level infinite-scroll trigger using a sentinel/intersection pattern
- update the table card so it can render appended rows and incremental-loading states
- remove next/previous button UI from the dedicated data-browser flow
- preserve existing full-card loading skeletons for first load and sort replacement

**Step 4: Run the targeted tests to verify they pass**

Run:
- `npm run test -- tests/direct-query-table-card.test.ts`

Expected: PASS.

### Task 6: Wire Team Leaf Clicks to the Dedicated Page

**Files:**
- Modify: `src/features/chat/components/DataBrowserTree.vue`
- Modify: `src/features/chat/data-browser/useDataBrowserController.ts`
- Test: `tests/data-browser-leaf-click.test.ts`

**Step 1: Write the failing tests**

Cover:
- team leaves invoke controller execution instead of no-op behavior
- clicking any visible leaf on the dedicated page replaces the active card

**Step 2: Run the targeted tests to verify they fail**

Run:
- `npm run test -- tests/data-browser-leaf-click.test.ts`

Expected: FAIL.

**Step 3: Implement team leaf execution**

Make these changes:
- add a typed team-leaf execution path in the controller
- wire `Overview`, `Players`, and `Schedule` leaves to controller actions
- let existing backend defaults drive the initial dedicated-page card behavior where full query implementations are still incomplete

**Step 4: Run the targeted tests to verify they pass**

Run:
- `npm run test -- tests/data-browser-leaf-click.test.ts`

Expected: PASS.

### Task 7: Run the Full Quality Gate

**Files:**
- Verify only

**Step 1: Run formatting and static checks**

Run:
- `npm run format:check`
- `npm run lint:check`
- `npm run typecheck`

Expected: PASS.

**Step 2: Run unit and coverage suites**

Run:
- `npm run test`
- `npm run test:coverage`

Expected: PASS.

**Step 3: Run E2E verification**

Run:
- `npm run test:e2e`

Expected: PASS, or explicit environment-limited failure details if Playwright cannot start the web server in this sandbox.

