create or replace view public.vw_player_game_history
with (security_invoker = true) as
with slot_games as (
  select
    l.matchup_id,
    l.snapshot_date,
    coalesce((ls.raw_json->>'gameNumber')::int, ls.slot_no) as game_number_zero_based,
    ls.raw_json,
    row_number() over (
      partition by l.matchup_id, coalesce((ls.raw_json->>'gameNumber')::int, ls.slot_no)
      order by l.snapshot_date desc, l.updated_at desc, ls.updated_at desc, ls.slot_no
    ) as rn
  from public.lineups l
  join public.lineup_slots ls
    on ls.lineup_id = l.lineup_id
  where ls.raw_json is not null
),
latest_games as (
  select
    sg.matchup_id,
    sg.snapshot_date,
    sg.game_number_zero_based,
    sg.raw_json
  from slot_games sg
  where sg.rn = 1
),
parsed_games as (
  select
    lg.matchup_id,
    lg.snapshot_date as game_as_of_date,
    lg.game_number_zero_based + 1 as game_number,
    lg.raw_json->>'matchType' as match_type,
    nullif(lg.raw_json->>'homePlayerId1', '') as home_player_1_id_text,
    nullif(lg.raw_json->>'homePlayerId2', '') as home_player_2_id_text,
    nullif(lg.raw_json->>'awayPlayerId1', '') as away_player_1_id_text,
    nullif(lg.raw_json->>'awayPlayerId2', '') as away_player_2_id_text,
    nullif(lg.raw_json->>'homeScore', '')::int as home_score,
    nullif(lg.raw_json->>'awayScore', '')::int as away_score
  from latest_games lg
),
base_games as (
  select
    m.matchup_id,
    d.division_name,
    d.season_number,
    d.season_year,
    m.week_number,
    m.scheduled_time as scheduled_time_utc,
    to_char(m.scheduled_time AT TIME ZONE 'America/New_York', 'Mon DD, YYYY HH:MIam') as match_datetime,
    pg.game_number,
    pg.match_type,
    coalesce(ts_home.team_name, th.team_name, m.home_name) as home_team_name,
    coalesce(ts_away.team_name, ta.team_name, m.away_name) as away_team_name,
    nullif(concat_ws(' ', hp1.first_name, hp1.last_name), '') as home_player_1_full_name,
    nullif(concat_ws(' ', hp2.first_name, hp2.last_name), '') as home_player_2_full_name,
    nullif(concat_ws(' ', ap1.first_name, ap1.last_name), '') as away_player_1_full_name,
    nullif(concat_ws(' ', ap2.first_name, ap2.last_name), '') as away_player_2_full_name,
    pg.home_score,
    pg.away_score,
    to_char(pg.game_as_of_date, 'Mon DD, YYYY') as game_as_of_date
  from parsed_games pg
  join public.matchups m
    on m.matchup_id = pg.matchup_id
  join public.divisions d
    on d.division_id = m.division_id
  left join public.teams th
    on th.team_id = m.home_team_id
  left join public.teams ta
    on ta.team_id = m.away_team_id
  left join lateral (
    select ts0.team_name
    from public.team_seasons ts0
    where ts0.team_id = m.home_team_id
      and ts0.division_id = m.division_id
      and ts0.snapshot_date <= m.snapshot_date
    order by ts0.snapshot_date desc
    limit 1
  ) ts_home on true
  left join lateral (
    select ts0.team_name
    from public.team_seasons ts0
    where ts0.team_id = m.away_team_id
      and ts0.division_id = m.division_id
      and ts0.snapshot_date <= m.snapshot_date
    order by ts0.snapshot_date desc
    limit 1
  ) ts_away on true
  left join public.players hp1
    on hp1.player_id::text = pg.home_player_1_id_text
  left join public.players hp2
    on hp2.player_id::text = pg.home_player_2_id_text
  left join public.players ap1
    on ap1.player_id::text = pg.away_player_1_id_text
  left join public.players ap2
    on ap2.player_id::text = pg.away_player_2_id_text
  where coalesce(m.home_name, '') <> 'Bye'
    and coalesce(m.away_name, '') <> 'Bye'
)
select
  bg.matchup_id,
  bg.division_name,
  bg.season_number,
  bg.season_year,
  bg.week_number,
  bg.scheduled_time_utc,
  bg.match_datetime,
  bg.game_number,
  bg.match_type,
  'home'::text as side,
  bg.home_player_1_full_name as primary_player_full_name,
  bg.home_player_2_full_name as partner_player_full_name,
  bg.away_player_1_full_name as opponent_player_1_full_name,
  bg.away_player_2_full_name as opponent_player_2_full_name,
  bg.home_team_name as primary_team_name,
  bg.away_team_name as opponent_team_name,
  bg.home_score as primary_side_score,
  bg.away_score as opponent_side_score,
  case
    when bg.home_score > bg.away_score then 'win'
    when bg.home_score < bg.away_score then 'loss'
    else 'draw'
  end as game_result,
  bg.game_as_of_date
from base_games bg

union all

select
  bg.matchup_id,
  bg.division_name,
  bg.season_number,
  bg.season_year,
  bg.week_number,
  bg.scheduled_time_utc,
  bg.match_datetime,
  bg.game_number,
  bg.match_type,
  'home'::text as side,
  bg.home_player_2_full_name as primary_player_full_name,
  bg.home_player_1_full_name as partner_player_full_name,
  bg.away_player_1_full_name as opponent_player_1_full_name,
  bg.away_player_2_full_name as opponent_player_2_full_name,
  bg.home_team_name as primary_team_name,
  bg.away_team_name as opponent_team_name,
  bg.home_score as primary_side_score,
  bg.away_score as opponent_side_score,
  case
    when bg.home_score > bg.away_score then 'win'
    when bg.home_score < bg.away_score then 'loss'
    else 'draw'
  end as game_result,
  bg.game_as_of_date
from base_games bg

union all

select
  bg.matchup_id,
  bg.division_name,
  bg.season_number,
  bg.season_year,
  bg.week_number,
  bg.scheduled_time_utc,
  bg.match_datetime,
  bg.game_number,
  bg.match_type,
  'away'::text as side,
  bg.away_player_1_full_name as primary_player_full_name,
  bg.away_player_2_full_name as partner_player_full_name,
  bg.home_player_1_full_name as opponent_player_1_full_name,
  bg.home_player_2_full_name as opponent_player_2_full_name,
  bg.away_team_name as primary_team_name,
  bg.home_team_name as opponent_team_name,
  bg.away_score as primary_side_score,
  bg.home_score as opponent_side_score,
  case
    when bg.away_score > bg.home_score then 'win'
    when bg.away_score < bg.home_score then 'loss'
    else 'draw'
  end as game_result,
  bg.game_as_of_date
from base_games bg

union all

select
  bg.matchup_id,
  bg.division_name,
  bg.season_number,
  bg.season_year,
  bg.week_number,
  bg.scheduled_time_utc,
  bg.match_datetime,
  bg.game_number,
  bg.match_type,
  'away'::text as side,
  bg.away_player_2_full_name as primary_player_full_name,
  bg.away_player_1_full_name as partner_player_full_name,
  bg.home_player_1_full_name as opponent_player_1_full_name,
  bg.home_player_2_full_name as opponent_player_2_full_name,
  bg.away_team_name as primary_team_name,
  bg.home_team_name as opponent_team_name,
  bg.away_score as primary_side_score,
  bg.home_score as opponent_side_score,
  case
    when bg.away_score > bg.home_score then 'win'
    when bg.away_score < bg.home_score then 'loss'
    else 'draw'
  end as game_result,
  bg.game_as_of_date
from base_games bg
order by
  season_year,
  season_number,
  division_name,
  week_number,
  scheduled_time_utc,
  game_number,
  side,
  primary_player_full_name;
