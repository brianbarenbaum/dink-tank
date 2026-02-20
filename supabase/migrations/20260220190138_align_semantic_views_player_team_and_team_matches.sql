create or replace view public.vw_player_team as
with current_season as (
  select
    pr.season_year,
    max(pr.season_number) as season_number
  from public.player_rosters pr
  where pr.season_year = (
    select max(pr2.season_year)
    from public.player_rosters pr2
  )
  group by pr.season_year
)
select distinct
  a.first_name || ' ' || a.last_name as player_full_name,
  coalesce(ts.team_name, c.team_name) as team_name,
  d.division_name,
  b.season_number,
  b.season_year,
  case when b.is_captain then 'Yes' else 'No' end as is_team_captain,
  case when b.is_sub then 'Yes' else 'No' end as is_substitute_player,
  a.dupr_rating,
  a.gender,
  (
    b.season_year = cs.season_year
    and b.season_number = cs.season_number
  ) as is_current_season
from public.players a
join public.player_rosters b
  on a.player_id = b.player_id
left join public.teams c
  on b.team_id = c.team_id
join public.divisions d
  on b.division_id = d.division_id
left join public.team_seasons ts
  on ts.team_id = b.team_id
 and ts.division_id = b.division_id
 and ts.season_number = b.season_number
 and ts.season_year = b.season_year
cross join current_season cs
order by
  b.season_year,
  b.season_number,
  team_name,
  division_name,
  player_full_name;

create or replace view public.vw_player_stats_per_season
with (security_invoker = true) as
select
  a.first_name || ' ' || a.last_name as player_full_name,
  coalesce(ts.team_name, c.team_name) as team_name,
  d.division_name,
  b.season_number,
  b.season_year,
  a.dupr_rating,
  pds.ranking,
  pds.wins,
  pds.losses,
  pds.matches_played,
  pds.games_played,
  pds.win_rate,
  pds.points_per_game,
  pds.average_point_differential,
  pds.clutch_win_rate,
  pds.strength_of_opponent,
  to_char(pds.snapshot_date, 'Mon DD, YYYY') as stats_as_of_date,
  pds.total_points_against,
  pds.total_point_differential,
  pds.mixed_ppg as mixed_points_per_game,
  pds.mixed_wins,
  pds.mixed_losses,
  pds.gender_ppg as gender_points_per_game,
  pds.gender_wins,
  pds.gender_losses
from public.players a
join public.player_rosters b
  on a.player_id = b.player_id
left join public.teams c
  on b.team_id = c.team_id
join public.divisions d
  on b.division_id = d.division_id
left join public.team_seasons ts
  on ts.team_id = b.team_id
 and ts.division_id = b.division_id
 and ts.season_number = b.season_number
 and ts.season_year = b.season_year
left join lateral (
  select
    s.ranking,
    s.wins,
    s.losses,
    s.matches_played,
    s.games_played,
    s.win_rate,
    s.points_per_game,
    s.total_points_against,
    s.total_point_differential,
    s.mixed_ppg,
    s.mixed_wins,
    s.mixed_losses,
    s.gender_ppg,
    s.gender_wins,
    s.gender_losses,
    s.average_point_differential,
    s.clutch_win_rate,
    s.strength_of_opponent,
    s.snapshot_date
  from public.player_division_stats s
  where s.player_id = b.player_id
    and s.division_id = b.division_id
  order by s.snapshot_date desc
  limit 1
) pds on true
order by d.division_name, team_name, player_full_name;

create or replace view public.vw_player_status_per_season
with (security_invoker = true) as
select *
from public.vw_player_stats_per_season;

create or replace view public.vw_team_matches
with (security_invoker = true) as
with matchups_latest as (
  select distinct on (m0.matchup_id)
    m0.matchup_id,
    m0.division_id,
    m0.week_number,
    m0.scheduled_time,
    m0.snapshot_date,
    m0.home_team_id,
    m0.away_team_id,
    m0.home_name,
    m0.away_name,
    m0.home_points,
    m0.away_points,
    m0.end_result,
    m0.playoffs,
    m0.playoff_game
  from public.matchups m0
  order by m0.matchup_id, m0.snapshot_date desc
),
team_match_rows as (
  select
    m.matchup_id,
    m.division_id,
    m.week_number,
    m.scheduled_time as match_datetime_utc,
    m.snapshot_date,
    'home'::text as side,
    m.home_team_id as team_id,
    m.away_team_id as opponent_team_id,
    m.home_name as fallback_team_name,
    m.away_name as fallback_opponent_team_name,
    m.home_points as team_points,
    m.away_points as opponent_points,
    m.end_result,
    m.playoffs,
    m.playoff_game
  from matchups_latest m

  union all

  select
    m.matchup_id,
    m.division_id,
    m.week_number,
    m.scheduled_time as match_datetime_utc,
    m.snapshot_date,
    'away'::text as side,
    m.away_team_id as team_id,
    m.home_team_id as opponent_team_id,
    m.away_name as fallback_team_name,
    m.home_name as fallback_opponent_team_name,
    m.away_points as team_points,
    m.home_points as opponent_points,
    m.end_result,
    m.playoffs,
    m.playoff_game
  from matchups_latest m
)
select
  coalesce(ts_team.team_name, t.team_name, r.fallback_team_name) as team_name,
  coalesce(ts_opp.team_name, t_opp.team_name, r.fallback_opponent_team_name) as opponent_team_name,
  d.division_name,
  coalesce(ts_team.season_number, ts_opp.season_number) as season_number,
  coalesce(ts_team.season_year, ts_opp.season_year) as season_year,
  r.week_number,
  to_char(r.match_datetime_utc, 'Mon DD, YYYY HH:MIam') as match_date,
  to_char(r.match_datetime_utc AT TIME ZONE 'America/New_York', 'Mon DD, YYYY HH:MIam') as match_datetime,
  r.team_points,
  r.opponent_points,
  case
    when r.end_result is null then null
    when lower(r.end_result) = 'draw' then 'Draw'
    when (r.side = 'home' and lower(r.end_result) = 'home')
      or (r.side = 'away' and lower(r.end_result) = 'away') then 'Win'
    when (r.side = 'home' and lower(r.end_result) = 'away')
      or (r.side = 'away' and lower(r.end_result) = 'home') then 'Loss'
    else initcap(r.end_result)
  end as match_result,
  r.playoffs,
  r.playoff_game,
  (r.match_datetime_utc AT TIME ZONE 'America/New_York') <
    (now() AT TIME ZONE 'America/New_York') as is_past_match
from team_match_rows r
join public.divisions d
  on d.division_id = r.division_id
left join public.teams t
  on t.team_id = r.team_id
left join public.teams t_opp
  on t_opp.team_id = r.opponent_team_id
left join lateral (
  select ts0.team_name, ts0.season_number, ts0.season_year
  from public.team_seasons ts0
  where ts0.team_id = r.team_id
    and ts0.division_id = r.division_id
    and ts0.snapshot_date <= r.snapshot_date
  order by ts0.snapshot_date desc
  limit 1
) ts_team on true
left join lateral (
  select ts0.team_name, ts0.season_number, ts0.season_year
  from public.team_seasons ts0
  where ts0.team_id = r.opponent_team_id
    and ts0.division_id = r.division_id
    and ts0.snapshot_date <= r.snapshot_date
  order by ts0.snapshot_date desc
  limit 1
) ts_opp on true
where coalesce(r.fallback_team_name, '') <> 'Bye'
  and coalesce(r.fallback_opponent_team_name, '') <> 'Bye'
order by
  season_year,
  season_number,
  d.division_name,
  team_name,
  r.week_number,
  r.match_datetime_utc;

drop view if exists public.vw_team_schedule;
drop view if exists public.vw_team_match_summary;
