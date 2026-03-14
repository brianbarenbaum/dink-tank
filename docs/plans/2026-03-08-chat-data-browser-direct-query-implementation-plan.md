# Chat Data Browser Direct Query Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a chat-sidebar Data Browser in two phases: first a fully functional scoped tree for Season/Division/Team browsing, then clickable leaves that create direct-query result cards inside the chat transcript.

**Architecture:** Add a dedicated `data-browser` module under the chat feature and a dedicated `dataBrowser` runtime module in the Worker. Phase 1 stops at rendering a real, lazy-loaded tree in the chat sidebar with multiple open branches and non-executing leaves. Phase 2 extends the transcript model to support typed direct-query cards, adds a typed Worker query endpoint, and wires leaf clicks to fetch structured data without using the LLM.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia-compatible controller patterns, Cloudflare Worker runtime, `pg`, existing Supabase-backed relational data, Vitest, Playwright.

---

## Phase 1 Milestone

Deliver a production-grade Data Browser tree inside the chat sidebar. The tree must:

- load real seasons, divisions, and teams from the backend
- render all required leaves
- allow multiple branches open at once
- work on desktop and mobile
- stop short of direct-query execution

Leaf rows in Phase 1 are visible but non-executing. They exist to validate the information architecture before transcript-card work starts.

### Task 1: Define Data Browser Domain Types and Client Contract

**Files:**
- Create: `src/features/chat/data-browser/types.ts`
- Create: `src/features/chat/data-browser/chatDataBrowserClient.ts`
- Test: `tests/data-browser-client.test.ts`

**Step 1: Write the failing client tests**

```ts
import { describe, expect, it, vi } from "vitest";

import { createChatDataBrowserClient } from "../src/features/chat/data-browser/chatDataBrowserClient";

describe("chat data browser client", () => {
	it("loads seasons from the context endpoint", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ seasons: [] }),
		});

		const client = createChatDataBrowserClient(fetchMock as typeof fetch);
		await client.getSeasons();

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/data-browser/context/seasons",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("loads divisions for a season", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ divisions: [] }),
		});

		const client = createChatDataBrowserClient(fetchMock as typeof fetch);
		await client.getDivisions({ seasonYear: 2025, seasonNumber: 3 });

		expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
			"/api/data-browser/context/divisions?seasonYear=2025&seasonNumber=3",
		);
	});

	it("loads teams for a division and season", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ teams: [] }),
		});

		const client = createChatDataBrowserClient(fetchMock as typeof fetch);
		await client.getTeams({
			seasonYear: 2025,
			seasonNumber: 3,
			divisionId: "11111111-1111-4111-8111-111111111111",
		});

		expect(String(fetchMock.mock.calls[0]?.[0])).toContain("divisionId=");
	});
});
```

**Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/data-browser-client.test.ts`
Expected: FAIL because `chatDataBrowserClient.ts` does not exist yet.

**Step 3: Write minimal domain types and client**

Create concrete types for:

- `DataBrowserSeasonOption`
- `DataBrowserDivisionOption`
- `DataBrowserTeamOption`
- `DataBrowserLeafKind`

Expose this client surface:

```ts
export interface ChatDataBrowserClient {
	getSeasons(): Promise<{ seasons: DataBrowserSeasonOption[] }>;
	getDivisions(input: {
		seasonYear: number;
		seasonNumber: number;
	}): Promise<{ divisions: DataBrowserDivisionOption[] }>;
	getTeams(input: {
		seasonYear: number;
		seasonNumber: number;
		divisionId: string;
	}): Promise<{ teams: DataBrowserTeamOption[] }>;
}
```

Keep error handling minimal and consistent with existing feature clients.

**Step 4: Run the test to verify it passes**

Run: `npm run test -- tests/data-browser-client.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/chat/data-browser/types.ts src/features/chat/data-browser/chatDataBrowserClient.ts tests/data-browser-client.test.ts
git commit -m "feat(data-browser): add frontend client contract"
```

### Task 2: Add Worker Context Endpoints for Seasons, Divisions, and Teams

**Files:**
- Create: `worker/src/runtime/dataBrowser/types.ts`
- Create: `worker/src/runtime/dataBrowser/repository.ts`
- Create: `worker/src/runtime/dataBrowser/contextHandler.ts`
- Modify: `worker/src/runtime/index.ts`
- Test: `tests/data-browser-context-handler.test.ts`

**Step 1: Write the failing Worker tests**

```ts
import { describe, expect, it, vi } from "vitest";

const {
	fetchDataBrowserSeasons,
	fetchDataBrowserDivisions,
	fetchDataBrowserTeams,
} = vi.hoisted(() => ({
	fetchDataBrowserSeasons: vi.fn(),
	fetchDataBrowserDivisions: vi.fn(),
	fetchDataBrowserTeams: vi.fn(),
}));

vi.mock("../worker/src/runtime/dataBrowser/repository", () => ({
	fetchDataBrowserSeasons,
	fetchDataBrowserDivisions,
	fetchDataBrowserTeams,
}));

import {
	handleDataBrowserSeasonsRequest,
	handleDataBrowserDivisionsRequest,
	handleDataBrowserTeamsRequest,
} from "../worker/src/runtime/dataBrowser/contextHandler";
```

Cover:

- `GET /api/data-browser/context/seasons` returns `200`
- `GET /api/data-browser/context/divisions` validates `seasonYear` and `seasonNumber`
- `GET /api/data-browser/context/teams` validates `divisionId`, `seasonYear`, and `seasonNumber`
- `handleFetch` routes these endpoints through `worker/src/runtime/index.ts`

**Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/data-browser-context-handler.test.ts`
Expected: FAIL because the runtime module does not exist.

**Step 3: Implement repository functions**

Reuse patterns from:

- `worker/src/runtime/lineupLab/repository.ts`
- `worker/src/runtime/lineupLab/contextHandler.ts`

Implement:

- `fetchDataBrowserSeasons(env)`
- `fetchDataBrowserDivisions(env, { seasonYear, seasonNumber })`
- `fetchDataBrowserTeams(env, { seasonYear, seasonNumber, divisionId })`

Recommended sources:

- seasons/divisions from `public.divisions` joined to `public.regions`
- teams from `public.teams` and `public.matchups`, following the normalization pattern already used by `fetchLineupLabTeams`

Keep this filter aligned with the existing product data scope:

- preserve the same NJ/PA region behavior used by lineup-lab unless explicitly changed later

**Step 4: Implement HTTP handlers and route registration**

Add typed `GET` handlers that:

- parse query params
- validate integers and UUIDs
- call repository functions
- map failures to the same error style used elsewhere in the Worker

Register new routes in `worker/src/runtime/index.ts`.

**Step 5: Run the test to verify it passes**

Run: `npm run test -- tests/data-browser-context-handler.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add worker/src/runtime/dataBrowser/types.ts worker/src/runtime/dataBrowser/repository.ts worker/src/runtime/dataBrowser/contextHandler.ts worker/src/runtime/index.ts tests/data-browser-context-handler.test.ts
git commit -m "feat(data-browser): add worker context endpoints"
```

### Task 3: Build a Tree Controller with Lazy Loading and Multi-Expand State

**Files:**
- Create: `src/features/chat/data-browser/useDataBrowserController.ts`
- Test: `tests/data-browser-controller.test.ts`

**Step 1: Write the failing controller tests**

```ts
import { describe, expect, it, vi } from "vitest";

import { createDataBrowserController } from "../src/features/chat/data-browser/useDataBrowserController";

describe("data browser controller", () => {
	it("loads seasons on init", async () => {
		const client = {
			getSeasons: vi.fn().mockResolvedValue({
				seasons: [{ seasonYear: 2025, seasonNumber: 3, label: "2025 S3" }],
			}),
			getDivisions: vi.fn(),
			getTeams: vi.fn(),
		};

		const controller = createDataBrowserController(client as never);
		await controller.initializationPromise;

		expect(client.getSeasons).toHaveBeenCalledTimes(1);
		expect(controller.seasons.value).toHaveLength(1);
	});

	it("loads divisions lazily when a season expands", async () => {
		// assert getDivisions is not called until toggleSeason is used
	});

	it("allows multiple branches to remain open", async () => {
		// expand two seasons or two divisions and assert both keys remain open
	});
});
```

**Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/data-browser-controller.test.ts`
Expected: FAIL because the controller does not exist.

**Step 3: Implement the controller**

Model explicit tree state with:

- `seasons`
- `divisionsBySeasonKey`
- `teamsByDivisionKey`
- `expandedSeasonKeys`
- `expandedDivisionKeys`
- `expandedTeamKeys`
- per-branch loading/error state maps

Provide methods:

- `toggleSeason(seasonKey)`
- `toggleDivision(input)`
- `toggleTeamsBranch(input)`

Do not implement leaf click behavior yet.

Expose an `initializationPromise` so tests can await first-load completion deterministically.

**Step 4: Run the test to verify it passes**

Run: `npm run test -- tests/data-browser-controller.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/chat/data-browser/useDataBrowserController.ts tests/data-browser-controller.test.ts
git commit -m "feat(data-browser): add tree state controller"
```

### Task 4: Replace the Placeholder with the Real Sidebar Tree

**Files:**
- Create: `src/features/chat/components/DataBrowserTree.vue`
- Modify: `src/features/chat/components/ChatSidebarContent.vue`
- Test: `tests/chat-sidebar-data-browser.test.ts`
- E2E: `e2e/data-browser-tree.spec.ts`

**Step 1: Write the failing component tests**

Write tests that mount `ChatSidebarContent.vue` with a mocked data browser controller and verify:

- seasons render as expandable branches
- divisions appear after season expansion
- `Players`, `Standings`, and `Teams` leaves/branches render at the division level
- team rows render under the `Teams` branch
- `Overview`, `Players`, and `Schedule` render under each team
- multiple branches can remain open

**Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/chat-sidebar-data-browser.test.ts`
Expected: FAIL because the tree component is not wired in.

**Step 3: Implement the tree UI**

Render the exact hierarchy from the spec.

Requirements:

- leaf rows render as buttons but are disabled or no-op in Phase 1
- branch rows expose `aria-expanded`
- `Data Browser` replaces the `Coming soon` placeholder in `ChatSidebarContent.vue`
- multiple open branches are preserved
- mobile drawer behavior inherits from the existing shell

Use explicit `data-testid`s for:

- `data-browser-season-*`
- `data-browser-division-*`
- `data-browser-leaf-*`
- `data-browser-team-*`

**Step 4: Add a focused Playwright tree test**

Create `e2e/data-browser-tree.spec.ts` to verify:

- the chat tab can open the sidebar
- the Data Browser tree is visible
- a season expands
- a division expands
- a team branch expands
- no transcript card is created yet when a leaf is clicked in Phase 1

**Step 5: Run tests to verify the tree milestone**

Run:

- `npm run test -- tests/chat-sidebar-data-browser.test.ts`
- `npm run test:e2e -- e2e/data-browser-tree.spec.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/features/chat/components/DataBrowserTree.vue src/features/chat/components/ChatSidebarContent.vue tests/chat-sidebar-data-browser.test.ts e2e/data-browser-tree.spec.ts
git commit -m "feat(data-browser): add sidebar tree milestone"
```

## Phase 2 Milestone

Make leaves clickable and render direct-query cards into the chat transcript without using the LLM.

### Task 5: Extend the Transcript Model to Support Direct Query Cards

**Files:**
- Modify: `src/features/chat/types.ts`
- Modify: `src/features/chat/useChatController.ts`
- Modify: `src/features/chat/components/ChatTranscript.vue`
- Test: `tests/chat-transcript-direct-query.test.ts`

**Step 1: Write the failing transcript tests**

Cover:

- transcript can render both text messages and direct-query cards
- repeated leaf clicks create repeated direct-query transcript items
- direct-query cards are not rendered through the markdown message bubble path

**Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/chat-transcript-direct-query.test.ts`
Expected: FAIL because transcript items are currently text-message only.

**Step 3: Implement the minimal transcript union**

Add a discriminated union such as:

```ts
type ChatTranscriptItem =
	| ChatMessageItem
	| DirectQueryCardItem;
```

Extend the chat controller with a method like:

- `appendDirectQueryCard(input)`

Do not wire live execution yet; just make the transcript able to hold and render the new type.

**Step 4: Run the test to verify it passes**

Run: `npm run test -- tests/chat-transcript-direct-query.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/chat/types.ts src/features/chat/useChatController.ts src/features/chat/components/ChatTranscript.vue tests/chat-transcript-direct-query.test.ts
git commit -m "feat(data-browser): add direct query transcript model"
```

### Task 6: Add the Typed Direct Query Endpoint Skeleton

**Files:**
- Create: `worker/src/runtime/dataBrowser/validation.ts`
- Create: `worker/src/runtime/dataBrowser/handler.ts`
- Modify: `worker/src/runtime/dataBrowser/repository.ts`
- Modify: `worker/src/runtime/index.ts`
- Test: `tests/data-browser-handler.test.ts`

**Step 1: Write the failing handler tests**

Cover:

- `POST /api/data-browser/query` rejects invalid `queryType`
- rejects invalid scope combinations
- routes valid requests to repository-backed query functions
- does not invoke the SQL agent

**Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/data-browser-handler.test.ts`
Expected: FAIL because the query handler does not exist.

**Step 3: Implement the skeleton query contract**

Allowed `queryType` values:

- `division_players`
- `division_standings`
- `team_overview`
- `team_players`
- `team_schedule`

Implement request parsing and validation first. Stub the repository calls with typed response objects if necessary, but do not route through the LLM.

**Step 4: Run the test to verify it passes**

Run: `npm run test -- tests/data-browser-handler.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add worker/src/runtime/dataBrowser/validation.ts worker/src/runtime/dataBrowser/handler.ts worker/src/runtime/dataBrowser/repository.ts worker/src/runtime/index.ts tests/data-browser-handler.test.ts
git commit -m "feat(data-browser): add typed direct query endpoint"
```

### Task 7: Make Division Leaves Clickable and Render Table Cards

**Files:**
- Create: `src/features/chat/components/DirectQueryCard.vue`
- Create: `src/features/chat/components/DirectQueryTableCard.vue`
- Modify: `src/features/chat/data-browser/useDataBrowserController.ts`
- Modify: `src/features/chat/components/DataBrowserTree.vue`
- Modify: `src/features/chat/useChatController.ts`
- Test: `tests/direct-query-table-card.test.ts`
- Test: `tests/data-browser-leaf-click.test.ts`

**Step 1: Write the failing tests**

Cover:

- clicking `Season -> Division -> Players` inserts a loading card then a table card
- clicking `Season -> Division -> Standings` inserts a loading card then a table card
- clicking the same leaf twice creates two cards

**Step 2: Run the tests to verify they fail**

Run:

- `npm run test -- tests/direct-query-table-card.test.ts`
- `npm run test -- tests/data-browser-leaf-click.test.ts`

Expected: FAIL.

**Step 3: Implement the table card shell**

The card shell must include:

- `Direct query` label
- title
- breadcrumb
- fetched timestamp
- loading/empty/error/success body states
- bottom pagination region

Use the new `POST /api/data-browser/query` endpoint for execution.

Implement backend query logic for:

- `division_players`
- `division_standings`

Recommended source views:

- `public.vw_player_stats_per_season`
- `public.vw_team_standings`

**Step 4: Run the tests to verify they pass**

Run:

- `npm run test -- tests/direct-query-table-card.test.ts`
- `npm run test -- tests/data-browser-leaf-click.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/chat/components/DirectQueryCard.vue src/features/chat/components/DirectQueryTableCard.vue src/features/chat/data-browser/useDataBrowserController.ts src/features/chat/components/DataBrowserTree.vue src/features/chat/useChatController.ts tests/direct-query-table-card.test.ts tests/data-browser-leaf-click.test.ts
git add worker/src/runtime/dataBrowser/repository.ts
git commit -m "feat(data-browser): add division direct query table cards"
```

### Task 8: Add Team Overview as a Summary Card

**Files:**
- Create: `src/features/chat/components/DirectQuerySummaryCard.vue`
- Modify: `worker/src/runtime/dataBrowser/repository.ts`
- Modify: `src/features/chat/components/ChatTranscript.vue`
- Test: `tests/direct-query-summary-card.test.ts`

**Step 1: Write the failing summary-card test**

Cover:

- `Season -> Division -> Teams -> Team -> Overview` renders a summary card, not a table
- card shows rank, record, win percentage, and other overview fields from the response

**Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/direct-query-summary-card.test.ts`
Expected: FAIL.

**Step 3: Implement the summary card and backend query**

Use `public.vw_team_standings` to fetch a single scoped team snapshot and render it as grouped stat blocks.

Do not add pagination to this card type.

**Step 4: Run the test to verify it passes**

Run: `npm run test -- tests/direct-query-summary-card.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/chat/components/DirectQuerySummaryCard.vue src/features/chat/components/ChatTranscript.vue worker/src/runtime/dataBrowser/repository.ts tests/direct-query-summary-card.test.ts
git commit -m "feat(data-browser): add team overview summary card"
```

### Task 9: Add Team Players and Team Schedule Cards

**Files:**
- Create: `src/features/chat/components/DirectQueryScheduleCard.vue`
- Modify: `worker/src/runtime/dataBrowser/repository.ts`
- Modify: `src/features/chat/components/ChatTranscript.vue`
- Test: `tests/direct-query-team-players.test.ts`
- Test: `tests/direct-query-schedule-card.test.ts`

**Step 1: Write the failing tests**

Cover:

- `Team -> Players` renders a table card sorted by rank
- `Team -> Schedule` renders a chronological schedule card/list
- schedule card does not fall back to a generic standings-style table

**Step 2: Run the tests to verify they fail**

Run:

- `npm run test -- tests/direct-query-team-players.test.ts`
- `npm run test -- tests/direct-query-schedule-card.test.ts`

Expected: FAIL.

**Step 3: Implement the remaining query types**

Recommended source views:

- `team_players` from `public.vw_player_stats_per_season` joined or filtered by team
- `team_schedule` from `public.vw_team_matches`

Render schedule as structured rows prioritized by:

- week
- date/time
- opponent
- result/status

**Step 4: Run the tests to verify they pass**

Run:

- `npm run test -- tests/direct-query-team-players.test.ts`
- `npm run test -- tests/direct-query-schedule-card.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/chat/components/DirectQueryScheduleCard.vue src/features/chat/components/ChatTranscript.vue worker/src/runtime/dataBrowser/repository.ts tests/direct-query-team-players.test.ts tests/direct-query-schedule-card.test.ts
git commit -m "feat(data-browser): add team player and schedule cards"
```

### Task 10: Add In-Card Pagination, Refresh, Remove, and Mobile Verification

**Files:**
- Modify: `src/features/chat/components/DirectQueryCard.vue`
- Modify: `src/features/chat/components/DirectQueryTableCard.vue`
- Modify: `src/features/chat/data-browser/useDataBrowserController.ts`
- Modify: `src/features/chat/useChatController.ts`
- Test: `tests/direct-query-card-controls.test.ts`
- E2E: `e2e/data-browser-direct-query.spec.ts`

**Step 1: Write the failing tests**

Cover:

- next/previous page updates the existing card in place
- refresh updates the existing card in place
- remove deletes only the targeted card
- mobile sidebar leaf click inserts a card and returns focus to the transcript area

**Step 2: Run the tests to verify they fail**

Run:

- `npm run test -- tests/direct-query-card-controls.test.ts`
- `npm run test:e2e -- e2e/data-browser-direct-query.spec.ts`

Expected: FAIL.

**Step 3: Implement card controls**

Add in-card actions:

- `Refresh`
- `Collapse`
- `Remove`

For paginated cards:

- next/previous page
- optional page number readout

Card state changes must mutate the existing transcript item rather than append a new one.

On mobile:

- after leaf click succeeds, close the sidebar drawer so the new card is visible

**Step 4: Run the targeted tests to verify they pass**

Run:

- `npm run test -- tests/direct-query-card-controls.test.ts`
- `npm run test:e2e -- e2e/data-browser-direct-query.spec.ts`

Expected: PASS.

**Step 5: Run the full quality gate**

Run:

- `npm run format:check`
- `npm run lint:check`
- `npm run typecheck`
- `npm run test`
- `npm run test:coverage`
- `npm run test:e2e`

Expected: all green.

**Step 6: Commit**

```bash
git add src/features/chat/components/DirectQueryCard.vue src/features/chat/components/DirectQueryTableCard.vue src/features/chat/data-browser/useDataBrowserController.ts src/features/chat/useChatController.ts tests/direct-query-card-controls.test.ts e2e/data-browser-direct-query.spec.ts
git commit -m "feat(data-browser): add direct query card controls and mobile polish"
```

## Implementation Notes

Follow these constraints throughout execution:

- use `@test-driven-development` for every task
- use `@vue-vite-core` and `@typescript-development` for Vue and TypeScript work
- use `@testing-quality-gate` before claiming completion
- keep direct-query execution entirely outside the LLM path
- do not route direct-query cards through markdown message rendering
- preserve the existing auth boundary on all new Worker endpoints

## Relevant Existing Files to Read Before Execution

- `src/features/chat/components/ChatSidebarContent.vue`
- `src/features/chat/components/ChatTranscript.vue`
- `src/features/chat/useChatController.ts`
- `src/features/chat/types.ts`
- `src/pages/ProtectedShellPage.vue`
- `worker/src/runtime/index.ts`
- `worker/src/runtime/lineupLab/contextHandler.ts`
- `worker/src/runtime/lineupLab/repository.ts`
- `worker/src/runtime/catalog/catalog.data.ts`
- `docs/plans/2026-03-08-chat-data-browser-direct-query-spec.md`

## Definition of Done

The feature is done when:

- the sidebar tree is fully real and lazy-loaded
- all five leaf types execute direct queries without using the LLM
- every result is rendered as a typed transcript card
- duplicate leaf clicks create duplicate cards
- in-card controls mutate existing cards in place
- desktop and mobile flows are both verified
- the full repo quality gate passes
