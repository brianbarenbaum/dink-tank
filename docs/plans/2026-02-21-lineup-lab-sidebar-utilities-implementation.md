# Lineup Lab Sidebar + Utilities Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current left sidebar content with a Lineup Lab explorer, wire recommendation results into chat, and open a right utilities drawer (desktop) / bottom sheet (mobile) when a lineup result card is selected.

**Architecture:** Keep the existing chat shell and message pipeline, add a deterministic explorer action path that calls the new Worker endpoint (`/api/lineup-lab/recommend`), then render a structured `Explorer Query` card in transcript. Utilities state is card-selection-driven, not globally persistent. The right drawer/bottom sheet reads from selected card metadata and closes when selection is cleared.

**Tech Stack:** Vue 3 SFCs, Composition API, TypeScript, existing chat feature modules, Worker endpoint `/api/lineup-lab/recommend`, Vitest, Playwright.

---

## Design Spec

**Primary visual reference:** `screenshots/sidebar_explorer.png`

**Scope note:** Use this image as stylistic inspiration for the left explorer navigation structure and hierarchy only. Ignore unrelated center/right mock content unless explicitly called out in this plan.

### IA Decisions
1. Keep current `New Chat` area and any branding/header above it.
2. Remove everything below `New Chat` in the left sidebar (`Your Chats`, metric tiles, module search).
3. Replace removed content with workflow nav led by `LINEUP LAB`.
4. Default active leaf is `Recommend Pairings`.

### Interaction Decisions
1. Selecting a lineup result card opens utilities context panel.
2. Card-level `Inspect` action also opens utilities panel.
3. Utilities panel content binds to the currently selected result card.
4. Selecting a different result card replaces utilities context.

### Responsive Decisions
1. Desktop/tablet wide: utilities appears as right collapsible drawer.
2. Mobile/narrow: utilities appears as bottom sheet.
3. Utilities is closed by default and never auto-opens before a result card exists.

### Visual States Required
1. Explorer item default/hover/active/disabled states.
2. Recommendation card default/selected/loading/error states.
3. Utilities panel closed/open/loading/error states.
4. Empty state when no recommendation card is selected.

### Testing Hooks
Required `data-testid` targets:
1. Sidebar explorer leaf (`recommend-pairings`).
2. Recommendation card root and selected state.
3. Inspect button.
4. Utilities drawer root.
5. Utilities bottom sheet root.

### Task 1: Define UI Data Contracts for Explorer + Utilities

**Files:**
- Modify: `src/features/chat/types.ts`
- Test: `tests/chat-controller.test.ts`

**Step 1: Write the failing test**
Add expectations that chat state can hold:
- explorer item metadata
- lineup recommendation payload
- selected result card id
- utilities panel open state

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/chat-controller.test.ts`
Expected: FAIL because new type fields are missing.

**Step 3: Write minimal implementation**
Add strongly typed interfaces:
- `ExplorerQueryMessageMeta`
- `LineupRecommendationMessageContent`
- `UtilitiesPanelState`
Update `ChatMessage` shape to support structured assistant/explorer message payloads.

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/chat-controller.test.ts`
Expected: PASS.

**Step 5: Commit**
Run:
```bash
git add src/features/chat/types.ts tests/chat-controller.test.ts
git commit -m "feat(chat): add explorer and utilities message contracts"
```

### Task 2: Replace Sidebar Content with Lineup Lab Explorer

**Files:**
- Modify: `src/features/chat/components/ChatSidebar.vue`
- Modify: `src/features/chat/components/ChatShell.vue`
- Test: `tests/chat-shell-render.test.ts`

**Step 1: Write the failing test**
Add assertions that:
- `New Chat` remains
- `Your Chats` section is removed
- legacy metric tiles are removed
- no module search bar is rendered
- `LINEUP LAB` nav section and `Recommend Pairings` item are present

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/chat-shell-render.test.ts`
Expected: FAIL against existing sidebar layout.

**Step 3: Write minimal implementation**
Update `ChatSidebar.vue`:
- keep header/new chat controls
- remove list/tile sections
- render explorer nav group with active item style
Expose an emit for explorer selection, e.g. `select-explorer-item`.

Update `ChatShell.vue`:
- pass handler to sidebar
- store selected explorer path in local state

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/chat-shell-render.test.ts`
Expected: PASS.

**Step 5: Commit**
Run:
```bash
git add src/features/chat/components/ChatSidebar.vue src/features/chat/components/ChatShell.vue tests/chat-shell-render.test.ts
git commit -m "feat(ui): replace sidebar body with lineup lab explorer nav"
```

### Task 3: Add Worker API Client for Lineup Lab Recommend

**Files:**
- Create: `src/features/chat/lineupLabClient.ts`
- Modify: `src/features/chat/useChatTransport.ts`
- Test: `tests/chat-client.test.ts`

**Step 1: Write the failing test**
Add tests for `lineupLabClient.recommend(...)`:
- sends POST to `/api/lineup-lab/recommend`
- validates non-200 error handling
- returns typed recommendation payload

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/chat-client.test.ts`
Expected: FAIL due to missing client.

**Step 3: Write minimal implementation**
Implement `lineupLabClient.ts` with typed request/response and defensive error parsing.
Wire transport helper in `useChatTransport.ts` for explorer-triggered calls.

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/chat-client.test.ts`
Expected: PASS.

**Step 5: Commit**
Run:
```bash
git add src/features/chat/lineupLabClient.ts src/features/chat/useChatTransport.ts tests/chat-client.test.ts
git commit -m "feat(chat): add lineup lab recommendation API client"
```

### Task 4: Render Explorer Result Card in Transcript

**Files:**
- Modify: `src/features/chat/components/ChatMessageBubble.vue`
- Create: `src/features/chat/components/LineupRecommendationCard.vue`
- Modify: `src/features/chat/formatMessageContent.ts`
- Test: `tests/chat-message-markdown.test.ts`

**Step 1: Write the failing test**
Add tests that structured lineup recommendation messages render:
- `Explorer Query` badge
- objective and confidence
- top recommended pair set rows
- action controls: `View Alternatives`, `Run What-If`, `Inspect`

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/chat-message-markdown.test.ts`
Expected: FAIL because card renderer does not exist.

**Step 3: Write minimal implementation**
- Add `LineupRecommendationCard.vue`.
- Branch message rendering in `ChatMessageBubble.vue` when message has lineup payload.
- Keep markdown rendering unchanged for normal text responses.

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/chat-message-markdown.test.ts`
Expected: PASS.

**Step 5: Commit**
Run:
```bash
git add src/features/chat/components/ChatMessageBubble.vue src/features/chat/components/LineupRecommendationCard.vue src/features/chat/formatMessageContent.ts tests/chat-message-markdown.test.ts
git commit -m "feat(chat): render structured lineup recommendation cards"
```

### Task 5: Utilities Drawer / Bottom Sheet with Card Selection Behavior

**Files:**
- Create: `src/features/chat/components/UtilitiesPanel.vue`
- Modify: `src/features/chat/components/ChatShell.vue`
- Modify: `src/features/chat/components/ChatTranscript.vue`
- Test: `tests/chat-responsive-classes.test.ts`

**Step 1: Write the failing test**
Add tests for behavior:
- selecting recommendation card opens utilities on desktop
- mobile renders utilities as bottom sheet
- explicit `Inspect` button also opens utilities
- changing selected card updates utilities content

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/chat-responsive-classes.test.ts`
Expected: FAIL because utilities panel does not exist.

**Step 3: Write minimal implementation**
- Add `UtilitiesPanel.vue` with sections:
  - assumptions
  - data range
  - player pool size
  - objective
- Desktop: right collapsible drawer.
- Mobile: bottom sheet.
- Trigger open on card selection and `Inspect` action.

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/chat-responsive-classes.test.ts`
Expected: PASS.

**Step 5: Commit**
Run:
```bash
git add src/features/chat/components/UtilitiesPanel.vue src/features/chat/components/ChatShell.vue src/features/chat/components/ChatTranscript.vue tests/chat-responsive-classes.test.ts
git commit -m "feat(ui): add utilities drawer and mobile bottom sheet for selected cards"
```

### Task 6: Hook Explorer Click -> API -> Chat Message Flow

**Files:**
- Modify: `src/features/chat/useChatController.ts`
- Modify: `src/features/chat/components/ChatSidebar.vue`
- Modify: `src/features/chat/components/ChatShell.vue`
- Test: `tests/chat-controller.test.ts`

**Step 1: Write the failing test**
Add a controller test:
- clicking `Recommend Pairings` triggers lineup API call
- adds a synthetic user-style explorer prompt message
- appends structured recommendation card message
- sets selected-card state and opens utilities

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/chat-controller.test.ts`
Expected: FAIL because controller does not handle explorer action pipeline.

**Step 3: Write minimal implementation**
In `useChatController.ts`:
- add `runExplorerShortcut()` workflow
- call lineup client
- append messages in expected order
- update selection state

In shell/sidebar:
- wire click to controller action.

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/chat-controller.test.ts`
Expected: PASS.

**Step 5: Commit**
Run:
```bash
git add src/features/chat/useChatController.ts src/features/chat/components/ChatSidebar.vue src/features/chat/components/ChatShell.vue tests/chat-controller.test.ts
git commit -m "feat(chat): wire explorer shortcut to lineup recommendation flow"
```

### Task 7: Worker Contract and Error Handling Hardening

**Files:**
- Modify: `worker/src/runtime/lineupLab/handler.ts`
- Modify: `worker/src/runtime/lineupLab/service.ts`
- Modify: `worker/src/runtime/lineupLab/repository.ts`
- Test: `tests/lineup-lab-handler.test.ts`

**Step 1: Write the failing test**
Add tests for:
- empty bundle returns graceful `recommendations: []`
- DB/RPC failure maps to `500 lineup_lab_failed`
- invalid payload maps to `400 invalid_request`

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/lineup-lab-handler.test.ts`
Expected: FAIL for missing edge cases.

**Step 3: Write minimal implementation**
- ensure no uncaught null payload access
- normalize unknown numeric fields
- keep stable error contract

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/lineup-lab-handler.test.ts`
Expected: PASS.

**Step 5: Commit**
Run:
```bash
git add worker/src/runtime/lineupLab/handler.ts worker/src/runtime/lineupLab/service.ts worker/src/runtime/lineupLab/repository.ts tests/lineup-lab-handler.test.ts
git commit -m "fix(worker): harden lineup lab response and error contracts"
```

### Task 8: End-to-End Verification and UI Acceptance

**Files:**
- Modify: `e2e/chat-interface.spec.ts`
- Optional: Create `e2e/lineup-lab-recommend.spec.ts`

**Step 1: Write the failing E2E test**
Scenario:
- open app
- click sidebar `Recommend Pairings`
- verify recommendation card appears
- click card body to open utilities
- verify utilities has selected card data
- mobile viewport: utilities appears as bottom sheet

**Step 2: Run test to verify it fails**
Run:
- `npm run test:e2e -- e2e/chat-interface.spec.ts`
Expected: FAIL before UI wiring is complete.

**Step 3: Implement minimal E2E stabilizers**
Add deterministic `data-testid` attributes:
- sidebar item
- recommendation card root
- utilities drawer/bottom-sheet
- inspect button

**Step 4: Run tests to verify pass**
Run:
- `npm test -- tests/lineup-lab-validation.test.ts tests/lineup-lab-optimizer.test.ts tests/lineup-lab-handler.test.ts tests/chat-controller.test.ts tests/chat-shell-render.test.ts tests/chat-message-markdown.test.ts tests/chat-responsive-classes.test.ts`
- `npm run test:e2e -- e2e/chat-interface.spec.ts`
Expected: PASS.

**Step 5: Commit**
Run:
```bash
git add e2e/chat-interface.spec.ts src/features/chat/components src/features/chat/useChatController.ts tests
git commit -m "test: add lineup lab explorer and utilities e2e coverage"
```

### Task 9: Documentation and Operator Notes

**Files:**
- Modify: `docs/architecture/chat-frontend-v1.md`
- Modify: `docs/architecture/chat-backend-v1.md`
- Modify: `worker/README.md`

**Step 1: Document frontend behavior**
Add section:
- explorer-triggered deterministic card flow
- card selection opens utilities
- mobile bottom-sheet behavior

**Step 2: Document backend contract**
Add section for `/api/lineup-lab/recommend`:
- request schema
- response schema
- failure modes

**Step 3: Document ops runbook**
Add reminder to refresh analytics MVs after ingestion:
- `select analytics.refresh_lineup_analytics_views();`

**Step 4: Verify docs**
Run: `npm run lint:check`
Expected: PASS.

**Step 5: Commit**
Run:
```bash
git add docs/architecture/chat-frontend-v1.md docs/architecture/chat-backend-v1.md worker/README.md
git commit -m "docs: add lineup lab explorer and recommend endpoint behavior"
```

### Task 10: Final Regression Pass

**Files:**
- No file edits unless failures found

**Step 1: Run full target test set**
Run:
- `npm test`
- `npm run test:e2e -- e2e/chat-interface.spec.ts`

Expected: PASS.

**Step 2: Manual QA checklist**
Validate:
- desktop: utilities closed until result card selection
- desktop: selecting different cards updates utilities context
- mobile: utilities opens as bottom sheet only
- recommendation card still allows normal chat follow-up

**Step 3: Commit any final fixes**
Run:
```bash
git add -A
git commit -m "chore: finalize lineup lab sidebar and utilities integration"
```
