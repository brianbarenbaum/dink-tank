# Session Workflow

This file defines how sessions should consume and update the memory pack.

## Startup Workflow

Before broad repo exploration in a new session:

1. Read `project-roadmap.md`
2. Read `repo-map.md`
3. Detect the current branch with `git branch --show-current`
4. Read `active-branches/<current-branch>.md` if it exists
5. Read `decision-log.md` or `known-issues.md` only if the task appears to depend on them

The goal is to start from a compact, deterministic context pack rather than re-auditing the whole repository.

## Checkpoint Triggers

Update the current branch handoff at these moments:

- when the task direction changes materially
- when new files or feature surfaces become important
- when verification is run
- when a blocker or failing test is discovered
- before ending the session

Do not wait until the very end if important context would be lost.

## What To Update At Checkpoints

### Always update

- `active-branches/<current-branch>.md`

### Update only when needed

- `decision-log.md`
  - when a durable design/process decision is made
- `known-issues.md`
  - when a failure becomes repo-level or recurring
- `repo-map.md`
  - when architecture, entrypoints, or runtime flow changes materially
- `project-roadmap.md`
  - when product direction changes

## Branch Handoff Requirements

Each branch handoff should stay compact and include:

- branch name
- goal
- current status
- key files
- latest verification and outcomes
- active blockers or failing tests
- linked artifacts
- exact next steps

Prefer exact test names and commands over vague prose.

## Session Closeout Checklist

Before ending a session:

1. Update the current branch handoff
2. Record the latest verification that actually ran
3. Record blockers or open questions
4. Link relevant artifacts instead of pasting logs
5. Promote only true durable information into durable memory files

## Anti-Patterns

- re-reading the full repo when the memory pack already answers the question
- storing branch-local failures in `known-issues.md`
- duplicating architecture notes across multiple files
- letting branch handoffs become long diaries instead of operational summaries
