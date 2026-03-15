# Main Branch Session Notes

## 2026-03-15 Player standings regression

- Root cause was split across DB views and worker query scoping.
- `public.vw_player_stats_per_season` multiplied rows by joining all matching `player_rosters` and `team_seasons` seasonal snapshots instead of latest-per-key rows.
- Data Browser worker queries scoped division player/standings/schedule lookups by `division_name + season_year + season_number`, which allowed cross-region `4.0` divisions to bleed into NJ/PA results.

## Applied fixes

- Added migration `supabase/migrations/20260315160000_fix_data_browser_view_scoping.sql`.
- Migration rebuilds:
  - `public.vw_player_stats_per_season`
  - `public.vw_team_standings`
  - `public.vw_team_matches`
- Views now preserve existing column order and append `division_id` at the end for worker-side exact division scoping.
- Updated `worker/src/runtime/dataBrowser/repository.ts` to join browser queries on `division_id`.

## Verification

- Live Supabase query for NJ/PA 2026 S1 `4.0` now returns:
  - `Will Delaney` rank 1
  - `Rothe Ripley` rank 2
  - `Brian Barenbaum` rank 3
  - `Erika Richards` rank 4
  - `Lauren Mammano` rank 5
- Duplicate check on `public.vw_player_stats_per_season` for division `dd1144f2-d2b7-471e-b97d-ccc775a4fef8` returned zero duplicate grouped rows.
- Local verification after final patch:
  - `npm run format:check` passed
  - `npm test -- tests/data-browser-repository.test.ts tests/data-browser-view-scoping-migration.test.ts` passed
- Earlier full-suite verification in this session:
  - `npm run lint:check` passed
  - `npm run typecheck` passed
  - `npm run test` passed
  - `npm run test:coverage` passed
  - `npm run test:e2e` had 3 failures unrelated to this fix:
    - ambiguous locator in `e2e/data-browser-tree.spec.ts`
    - two existing lineup-lab visual diffs in `e2e/lineup-lab-ui-visual.spec.ts`

## Remaining note

- If the hosted site still shows the old bad player list, the likely remaining gap is deployed worker code not yet picking up the `division_id`-scoped repository change.

## 2026-03-15 Team overview total win percentage

- User clarified that `TOTAL WIN %` on the team overview card should be game-level, not match-level.
- Root cause: `worker/src/runtime/dataBrowser/repository.ts` mapped `winBreakdown.overallWinPercentage` from `v.win_percentage`, while the card already displayed men's, women's, and mixed values from game-level rates.
- Fix: team overview query now selects `v.game_win_rate`, and the payload builder maps `overallWinPercentage` from `game_win_rate`.
- Verification:
  - `npm test -- tests/data-browser-repository.test.ts` passed after a red/green regression update with `win_percentage != game_win_rate`
  - `npm run format:check` passed
  - `npm run typecheck` passed
