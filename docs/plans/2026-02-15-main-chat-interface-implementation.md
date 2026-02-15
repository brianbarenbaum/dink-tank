# Main Frontend Chat Interface Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-grade v1 chat frontend (desktop + mobile) that calls a real endpoint (`POST /api/chat`) with standard request/response, includes placeholder auth header plumbing, and matches major layout intent from provided design references.

**Architecture:** Implement a feature-oriented chat module (`src/features/chat/*`) with a Pinia session store, a thin API client abstraction, and composables/components separated so transport details can evolve to streaming later. Keep state session-only in Pinia (no localStorage), and keep backend contract minimal (`messages[]` in, `reply` out). Use a shell layout that supports both desktop rail + mobile terminal style with responsive breakpoints.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, Tailwind CSS, shadcn-vue primitives, Vitest, Playwright.

---

### Task 1: Define Chat Domain Types and Store Contract

**Files:**
- Create: `src/features/chat/types.ts`
- Create: `src/stores/chatSession.ts`
- Test: `tests/chat-session-store.test.ts`

**Step 1: Write the failing store tests**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useChatSessionStore } from "../src/stores/chatSession";

describe("chatSession store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts with seed assistant message and empty pending state", () => {
    const store = useChatSessionStore();

    expect(store.messages.length).toBe(1);
    expect(store.messages[0]?.role).toBe("assistant");
    expect(store.isSending).toBe(false);
  });

  it("appends user and assistant messages in order", () => {
    const store = useChatSessionStore();

    store.addUserMessage("How do we defend against heavy topspin?");
    store.addAssistantMessage("Reset early and keep paddle head up.");

    const lastTwo = store.messages.slice(-2);
    expect(lastTwo.map((m) => m.role)).toEqual(["user", "assistant"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/chat-session-store.test.ts`
Expected: FAIL with module not found for `chatSession`.

**Step 3: Write minimal types and Pinia store implementation**

```ts
export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}
```

```ts
import { defineStore } from "pinia";
import type { ChatMessage } from "../features/chat/types";

const seedMessage: ChatMessage = {
  id: "seed-assistant",
  role: "assistant",
  content: "Welcome back, Coach. Ask for any stat or lineup insight.",
  createdAt: new Date(0).toISOString(),
};

export const useChatSessionStore = defineStore("chatSession", {
  state: () => ({
    messages: [seedMessage] as ChatMessage[],
    isSending: false,
  }),
  actions: {
    addUserMessage(content: string) {
      this.messages.push({ id: crypto.randomUUID(), role: "user", content, createdAt: new Date().toISOString() });
    },
    addAssistantMessage(content: string) {
      this.messages.push({ id: crypto.randomUUID(), role: "assistant", content, createdAt: new Date().toISOString() });
    },
    setSending(value: boolean) {
      this.isSending = value;
    },
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/chat-session-store.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/chat/types.ts src/stores/chatSession.ts tests/chat-session-store.test.ts
git commit -m "feat(chat): add typed session store contract"
```

### Task 2: Add Chat API Client with Placeholder Auth Header and Streaming-Ready Abstraction

**Files:**
- Create: `src/features/chat/chatClient.ts`
- Create: `src/features/chat/useChatTransport.ts`
- Test: `tests/chat-client.test.ts`

**Step 1: Write failing transport tests**

```ts
import { describe, expect, it, vi } from "vitest";

import { createChatClient } from "../src/features/chat/chatClient";

describe("chatClient", () => {
  it("posts to /api/chat with messages body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "Team A has 62% win rate." }),
    });

    const client = createChatClient(fetchMock as typeof fetch, () => "token-123");
    await client.send([{ role: "user", content: "Show win rate." }]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/chat-client.test.ts`
Expected: FAIL with missing `chatClient` module.

**Step 3: Implement minimal client + transport wrapper**

```ts
export interface ChatClient {
  send(messages: { role: "user" | "assistant"; content: string }[]): Promise<{ reply: string }>;
}

export const createChatClient = (fetchImpl: typeof fetch, getAccessToken: () => string | null): ChatClient => ({
  async send(messages) {
    const token = getAccessToken();
    const response = await fetchImpl("/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error("Chat request failed");
    }

    return response.json() as Promise<{ reply: string }>;
  },
});
```

```ts
// Keep this abstraction so streaming transport can be added without UI rewrite.
export function useChatTransport() {
  return {
    mode: "request-response" as const,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/chat-client.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/chat/chatClient.ts src/features/chat/useChatTransport.ts tests/chat-client.test.ts
git commit -m "feat(chat): add api client with placeholder auth header"
```

### Task 3: Build Core Chat UI Components (Rail, Transcript, Composer)

**Files:**
- Create: `src/features/chat/components/ChatShell.vue`
- Create: `src/features/chat/components/ChatSidebar.vue`
- Create: `src/features/chat/components/ChatTranscript.vue`
- Create: `src/features/chat/components/ChatComposer.vue`
- Create: `src/features/chat/components/ChatMessageBubble.vue`
- Modify: `src/style.css`
- Test: `tests/chat-shell-render.test.ts`

**Step 1: Write failing component render tests**

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ChatShell from "../src/features/chat/components/ChatShell.vue";

describe("ChatShell", () => {
  it("renders sidebar, transcript, and composer landmarks", () => {
    const wrapper = mount(ChatShell);

    expect(wrapper.find("[data-testid='chat-sidebar']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='chat-transcript']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='chat-composer']").exists()).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/chat-shell-render.test.ts`
Expected: FAIL with missing `ChatShell.vue`.

**Step 3: Implement minimal components and terminal-inspired styling tokens**

```css
:root {
  --chat-bg: #020b04;
  --chat-glow: #00f230;
  --chat-line: #0b3a15;
}
```

```vue
<template>
  <main class="chat-root" data-testid="chat-shell">
    <ChatSidebar data-testid="chat-sidebar" />
    <section class="chat-main">
      <ChatTranscript data-testid="chat-transcript" />
      <ChatComposer data-testid="chat-composer" />
    </section>
  </main>
</template>
```

**Step 4: Run tests and refine until pass**

Run: `npm run test -- tests/chat-shell-render.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/chat/components src/style.css tests/chat-shell-render.test.ts
git commit -m "feat(chat-ui): scaffold responsive shell transcript and composer"
```

### Task 4: Wire App Integration and Send Flow

**Files:**
- Modify: `src/App.vue`
- Create: `src/features/chat/useChatController.ts`
- Test: `tests/chat-controller.test.ts`

**Step 1: Write failing controller tests for send flow and error state**

```ts
import { describe, expect, it, vi } from "vitest";

import { createChatController } from "../src/features/chat/useChatController";

describe("chat controller", () => {
  it("adds user message and assistant reply from api", async () => {
    const send = vi.fn().mockResolvedValue({ reply: "Try neutralizing from mid-court." });
    const controller = createChatController(send);

    await controller.submit("How to counter bangers?");

    expect(controller.messages.at(-2)?.role).toBe("user");
    expect(controller.messages.at(-1)?.role).toBe("assistant");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/chat-controller.test.ts`
Expected: FAIL with missing controller module.

**Step 3: Implement controller and wire into `App.vue`**

```ts
export function createChatController(send: (messages: { role: "user" | "assistant"; content: string }[]) => Promise<{ reply: string }>) {
  // orchestrates store state + API call
}
```

```vue
<script setup lang="ts">
import ChatShell from "./features/chat/components/ChatShell.vue";
</script>

<template>
  <ChatShell />
</template>
```

**Step 4: Run tests to verify pass**

Run: `npm run test -- tests/chat-controller.test.ts tests/chat-shell-render.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/App.vue src/features/chat/useChatController.ts tests/chat-controller.test.ts
git commit -m "feat(chat-ui): wire app chat submit and error flow"
```

### Task 5: Responsive Behavior + Sidebar and Mobile Terminal Controls

**Files:**
- Modify: `src/features/chat/components/ChatShell.vue`
- Modify: `src/features/chat/components/ChatSidebar.vue`
- Modify: `src/features/chat/components/ChatComposer.vue`
- Test: `tests/chat-responsive-classes.test.ts`

**Step 1: Write failing tests for responsive class expectations**

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ChatShell from "../src/features/chat/components/ChatShell.vue";

describe("chat responsive layout", () => {
  it("uses desktop two-column and mobile single-column behavior", () => {
    const wrapper = mount(ChatShell);
    const classList = wrapper.classes().join(" ");

    expect(classList.includes("lg:grid-cols-[260px_1fr]")).toBe(true);
    expect(classList.includes("grid-cols-1")).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/chat-responsive-classes.test.ts`
Expected: FAIL until class contract exists.

**Step 3: Implement responsive behavior**

- Desktop: persistent left rail with new session, your chats, analytics tools.
- Mobile: compact header + rail access affordance, transcript-first vertical flow.
- Ensure composer stays accessible at bottom and touch targets are >= 44px.

**Step 4: Run responsive tests**

Run: `npm run test -- tests/chat-responsive-classes.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/chat/components/ChatShell.vue src/features/chat/components/ChatSidebar.vue src/features/chat/components/ChatComposer.vue tests/chat-responsive-classes.test.ts
git commit -m "feat(chat-ui): add mobile and desktop responsive behavior"
```

### Task 6: Add E2E Flow + Visual Parity Checks (Major Elements, Non Pixel-Perfect)

**Files:**
- Create: `e2e/chat-interface.spec.ts`
- Create: `e2e/fixtures/chat-api.json` (optional fixture)
- Create: `validation_screenshots/` outputs generated by test run

**Step 1: Write failing Playwright spec**

```ts
import { expect, test } from "@playwright/test";

test("chat interface major layout parity", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reply: "Team A: 62% win rate in mixed doubles." }),
    });
  });

  await page.goto("/");

  await expect(page.getByTestId("chat-sidebar")).toBeVisible();
  await expect(page.getByTestId("chat-transcript")).toBeVisible();
  await expect(page.getByTestId("chat-composer")).toBeVisible();
});
```

**Step 2: Run e2e test to verify it fails first**

Run: `npm run test:e2e -- e2e/chat-interface.spec.ts`
Expected: FAIL until components and selectors are complete.

**Step 3: Add viewport-specific screenshot assertions**

- Desktop viewport: compare major placement with `designs/chat_desktop.png` intent.
- Mobile viewport: compare major placement with `designs/chat_mobile.png` intent.
- Use tolerant assertions (major element visibility/positioning), not strict pixel diffs.

**Step 4: Run e2e to verify pass**

Run: `npm run test:e2e -- e2e/chat-interface.spec.ts`
Expected: PASS and produce fresh screenshots in `validation_screenshots/`.

**Step 5: Commit**

```bash
git add e2e/chat-interface.spec.ts validation_screenshots
git commit -m "test(chat-ui): add e2e and visual parity checks"
```

### Task 7: Final Quality Gate and Handoff Notes

**Files:**
- Modify: `README.md` (frontend chat section)
- Create: `docs/architecture/chat-frontend-v1.md` (optional if README gets too large)

**Step 1: Document endpoint contract and known deferred work**

- `POST /api/chat` request/response contract.
- Placeholder bearer token integration point.
- Deferred items: streaming transport mode, Supabase conversation persistence.

**Step 2: Run full project verification**

Run:

```bash
npm run format:check
npm run lint:check
npm run test
npm run test:coverage
npm run test:e2e
npm run typecheck
```

Expected: PASS all checks.

**Step 3: Resolve any failures and rerun**

- Fix only failing scopes.
- Re-run failed command + full suite.

**Step 4: Commit docs and verification-aligned updates**

```bash
git add README.md docs/architecture/chat-frontend-v1.md
git commit -m "docs(chat-ui): add v1 architecture and contract notes"
```

## Explicit Non-Goals for This Plan

- No Cloudflare Worker LangChain SQL agent implementation.
- No model/provider wiring.
- No Supabase persistence for conversation history yet.
- No localStorage chat persistence.

## Skills to Apply During Execution

- `@superpowers/test-driven-development`
- `@superpowers/verification-before-completion`
- `@vue-vite-core`
- `@ui-component-creation`
- `@responsive-ui`
- `@state-management-pinia`
- `@testing-quality-gate`
