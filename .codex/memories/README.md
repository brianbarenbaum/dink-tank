# Memory Pack

This directory is the repo-local handoff system for coding sessions. Its job is to let a fresh session get oriented from a small, stable set of files instead of re-reading the entire repository.

## Startup Read Order

Read these in order at the start of a new session:

1. `project-roadmap.md`
2. `repo-map.md`
3. `active-branches/<current-branch>.md` if it exists

Read additional files only when the current task requires them:

- `decision-log.md` for non-obvious design choices
- `known-issues.md` for recurring repo-level failures
- `session-workflow.md` for handoff/update rules

## File Roles

| File | Type | Purpose |
| --- | --- | --- |
| `project-roadmap.md` | durable | Product direction, UX goals, and core capabilities |
| `repo-map.md` | durable | Architecture, runtime surfaces, debug entrypoints, verification commands |
| `decision-log.md` | durable | Important decisions and rationale |
| `known-issues.md` | durable | Reproducible repo-level issues only |
| `session-workflow.md` | durable | Startup, checkpoint, and shutdown rules |
| `active-branches/*.md` | volatile | Branch-local work state, verification, blockers, next steps |

## Update Rules

- Update `active-branches/<current-branch>.md` at checkpoints and before ending a session.
- Update `decision-log.md` only when a decision is durable and likely to matter in future sessions.
- Update `known-issues.md` only when an issue is repo-level or recurring across sessions/branches.
- Update `repo-map.md` when architecture or runtime entrypoints change materially.
- Update `project-roadmap.md` only when product direction changes.

## Compactness Rules

- Keep branch handoffs short and operational.
- Link to artifacts instead of pasting full logs.
- Do not duplicate architecture details across multiple files.
- Do not let branch-local noise leak into durable memory.
