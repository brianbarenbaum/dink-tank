# Decision Log

Only record durable decisions that future sessions are likely to need. Do not use this file as a temporary notes pad.

## 2026-03-14: Use a layered repo-local memory pack for session handoff

- Status: accepted
- Decision:
  - Store durable context in a small set of curated markdown files under `.codex/memories/`
  - Store volatile task state in branch-scoped handoff files under `.codex/memories/active-branches/`
- Why:
  - A single catch-all memory file drifts and becomes noisy
  - Fresh sessions need architecture and branch state, not a full repo reread
  - Repo-local files are visible, reviewable, and branch-aware

## 2026-03-14: Read a fixed startup pack before broad repo exploration

- Status: accepted
- Decision:
  - New sessions should read:
    1. `project-roadmap.md`
    2. `repo-map.md`
    3. `active-branches/<current-branch>.md` if present
- Why:
  - This provides product context, architecture/runtime context, and live branch state with minimal token overhead
  - It makes startup deterministic instead of agent-specific

## 2026-03-14: Keep branch handoffs compact and artifact-linked

- Status: accepted
- Decision:
  - Branch handoffs summarize commands, failures, and next steps, but link to artifacts instead of pasting long logs
- Why:
  - Long inline logs are expensive to reread and quickly go stale
  - Artifacts keep the handoff actionable without bloating startup context
