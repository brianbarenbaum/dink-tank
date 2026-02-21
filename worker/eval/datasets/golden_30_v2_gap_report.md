# golden_30_v2 gap report (tables data not fully exposed in views)

These are common Cross Club-style questions that are feasible from base tables, but not cleanly answerable from current `vw_*` views.

## 1) Club directory details
- Example question blocked: "What is the address/website/Instagram for Home Court?"
- Data exists in table: `public.clubs` (`address`, `website`, `phone`, social links)
- Gap in views: none of the current `vw_*` views expose club contact fields.
- Proposal: add `public.vw_club_directory` with `club_name`, `address`, `phone`, `website`, `facebook`, `instagram`, `twitter`, `youtube`, `logo`, `color`.

## 2) Match venue/location and true kickoff timestamp
- Example question blocked: "Where is Pickle Jar vs Stelton Warriors being played?"
- Data exists in table: `public.matchups` (`address`, `scheduled_time`)
- Gap in views: `vw_team_matches`/`vw_match_game_lineups_scores` expose human-readable date text, but not full venue and standardized timestamp fields for all match queries.
- Proposal: add `venue_address` and `scheduled_time_utc` columns to `vw_team_matches` and `vw_match_game_lineups_scores`.

## 3) Region-level rollups
- Example question blocked: "Which region has the strongest average team win percentage across divisions?"
- Data exists across tables: `public.regions`, `public.divisions`
- Gap in views: no view exposes region alongside standings/match summaries.
- Proposal: add `public.vw_region_division_standings` joining region + division + team standings metrics.

## 4) Canonical head-to-head summaries
- Example question blocked: "What is the exact season head-to-head record between Team A and Team B?"
- Data exists in views, but `vw_team_matches` is team-perspective (each matchup represented from each team side), so direct counting is easy to get wrong.
- Proposal: add `public.vw_head_to_head_summary` at canonical pair grain with `team_a`, `team_b`, `meetings`, `team_a_wins`, `team_b_wins`, `point_diff`.

## 5) Ranking trend / momentum questions
- Example question blocked: "Who had the biggest ranking jump this week?"
- Data exists in table: `public.player_division_stats` (`last_week_ranking`)
- Gap in views: `vw_player_stats_per_season` does not expose rank-change fields.
- Proposal: extend `vw_player_stats_per_season` (or create `vw_player_rank_trends`) with `last_week_ranking` and computed `ranking_delta`.
