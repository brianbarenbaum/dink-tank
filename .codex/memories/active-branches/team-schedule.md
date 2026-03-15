# team-schedule

## Goal

Add a team schedule card to the dedicated data browser using the same table-style presentation as the existing players and standings cards.

## Current Status

- State: ready for review
- Summary: `team_schedule` now queries `public.vw_team_matches`, renders as a table-backed direct query card, and the Cross Club scheduled-time bug is fixed at the ingest/data layer. New ingests normalize Eastern wall-clock `scheduledTime` values into real UTC, and migration `20260314173000_normalize_crossclub_matchup_times_to_eastern.sql` has already been applied to backfill existing NJ/PA matchup rows in Supabase.

## Key Files

- `worker/src/runtime/dataBrowser/repository.ts`
- `src/features/chat/data-browser/useDataBrowserController.ts`
- `src/features/chat/components/DirectQueryTableCard.vue`
- `data-ingestion/pipeline.ts`
- `data-ingestion/sqlite/run-mock.ts`
- `supabase/migrations/20260314173000_normalize_crossclub_matchup_times_to_eastern.sql`
- `tests/data-browser-repository.test.ts`
- `tests/data-browser-leaf-click.test.ts`
- `tests/crossclub-ingest.test.ts`
- `e2e/data-browser-tree.spec.ts`

## Latest Verification

- Command: `npm run format:check` -> pass; `npm run lint:check` -> pass; `npm run typecheck` -> pass; `npm run test -- tests/crossclub-ingest.test.ts tests/data-browser-repository.test.ts tests/data-browser-leaf-click.test.ts` -> pass; Supabase SQL verification for `public.vw_team_matches` Bounce Philly 4.0 -> corrected to `7:30pm`
- Result: mixed
- Notes: Live DB now stores corrected UTC values such as `2026-02-27 00:30:00+00` for Bounce Philly week 1 and renders `Feb 26, 2026 07:30pm` in `public.vw_team_matches`. Full Playwright still fails only on unrelated `e2e/lineup-lab-ui-visual.spec.ts` desktop/mobile snapshot parity (`lineup-lab-desktop.png`, `lineup-lab-mobile.png`).

## Open Issues

- `npm run test:e2e` fails on unrelated lineup lab visual snapshot diffs:
  - `e2e/lineup-lab-ui-visual.spec.ts:78:1`
  - `e2e/lineup-lab-ui-visual.spec.ts:98:1`

## Artifacts

- `test-results/lineup-lab-ui-visual-lineup-lab-desktop-visual-parity/`
- `test-results/lineup-lab-ui-visual-lineup-lab-mobile-visual-parity/`

## Next Steps

1. Review the new team schedule table behavior in the data browser and confirm the chosen columns/labels are acceptable.
2. Decide whether to update or investigate the existing Lineup Lab visual snapshots before requiring a fully green Playwright run.
