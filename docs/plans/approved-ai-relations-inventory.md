# Approved AI Relations Inventory

This document records the current approved relation set for the chat SQL agent.

Approved chat relations:

- `public.vw_player_team`
- `public.vw_player_stats_per_season`
- `public.vw_player_stats_per_match`
- `public.vw_player_game_history`
- `public.vw_player_partner_performance_summary`
- `public.vw_match_game_lineups_scores`
- `public.vw_team_standings`
- `public.vw_team_matches`

Not approved for the chat SQL agent:

- any `analytics.*` object
- any `auth_private.*` object
- any `information_schema.*` object
- any `pg_catalog.*` object
- any base table
- any `public.*` object not listed above

Notes:

- This inventory is scoped only to the chat SQL agent.
- Non-chat application features may continue to use `analytics.*` through their existing access paths.
