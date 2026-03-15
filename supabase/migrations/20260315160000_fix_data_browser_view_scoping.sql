create or replace view public.vw_player_stats_per_season
with (security_invoker = true) as
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
),
rosters_latest as (
  select distinct on (pr0.player_id, pr0.division_id, pr0.season_number, pr0.season_year)
    pr0.player_id,
    pr0.division_id,
    pr0.team_id,
    pr0.season_number,
    pr0.season_year,
    pr0.snapshot_date
  from public.player_rosters pr0
  order by
    pr0.player_id,
    pr0.division_id,
    pr0.season_number,
    pr0.season_year,
    pr0.snapshot_date desc
),
ts_latest as (
  select distinct on (ts0.team_id, ts0.division_id, ts0.season_number, ts0.season_year)
    ts0.team_id,
    ts0.division_id,
    ts0.season_number,
    ts0.season_year,
    ts0.team_name,
    ts0.snapshot_date
  from public.team_seasons ts0
  order by
    ts0.team_id,
    ts0.division_id,
    ts0.season_number,
    ts0.season_year,
    ts0.snapshot_date desc
),
pds_latest as (
  select distinct on (s0.player_id, s0.division_id)
    s0.player_id,
    s0.division_id,
    s0.ranking,
    s0.wins,
    s0.losses,
    s0.matches_played,
    s0.games_played,
    s0.win_rate,
    s0.points_per_game,
    s0.total_points_against,
    s0.total_point_differential,
    s0.mixed_ppg,
    s0.mixed_wins,
    s0.mixed_losses,
    s0.gender_ppg,
    s0.gender_wins,
    s0.gender_losses,
    s0.average_point_differential,
    s0.clutch_win_rate,
    s0.strength_of_opponent,
    s0.snapshot_date
  from public.player_division_stats s0
  order by
    s0.player_id,
    s0.division_id,
    s0.snapshot_date desc
)
select
  a.first_name || ' ' || a.last_name as player_full_name,
  coalesce(ts.team_name, c.team_name) as team_name,
  d.division_name,
  rl.season_number,
  rl.season_year,
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
  pds.gender_losses,
  (
    rl.season_year = cs.season_year
    and rl.season_number = cs.season_number
  ) as is_current_season,
  rl.division_id
from rosters_latest rl
join public.players a
  on a.player_id = rl.player_id
left join public.teams c
  on c.team_id = rl.team_id
join public.divisions d
  on d.division_id = rl.division_id
left join ts_latest ts
  on ts.team_id = rl.team_id
 and ts.division_id = rl.division_id
 and ts.season_number = rl.season_number
 and ts.season_year = rl.season_year
left join pds_latest pds
  on pds.player_id = rl.player_id
 and pds.division_id = rl.division_id
cross join current_season cs
order by
  rl.season_year,
  rl.season_number,
  d.division_name,
  team_name,
  player_full_name;

create or replace view public.vw_team_standings as
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
),
ts_latest as (
  select distinct on (ts0.team_id, ts0.division_id, ts0.season_number, ts0.season_year)
    ts0.team_id,
    ts0.division_id,
    ts0.season_number,
    ts0.season_year,
    ts0.team_name,
    ts0.snapshot_date
  from public.team_seasons ts0
  order by
    ts0.team_id,
    ts0.division_id,
    ts0.season_number,
    ts0.season_year,
    ts0.snapshot_date desc
),
standings_latest as (
  select distinct on (s0.team_id, s0.division_id, s0.season_number, s0.season_year)
    s0.team_id,
    s0.division_id,
    s0.season_number,
    s0.season_year,
    s0.ranking,
    s0.pod,
    s0.pod_ranking,
    s0.wins,
    s0.losses,
    s0.draws,
    s0.record,
    s0.game_record,
    s0.win_percentage,
    s0.game_win_rate,
    s0.average_points_per_game,
    s0.average_point_differential,
    s0.home_wins,
    s0.home_losses,
    s0.home_record,
    s0.home_win_rate,
    s0.away_wins,
    s0.away_losses,
    s0.away_record,
    s0.away_win_rate,
    s0.mens_record,
    s0.men_wins,
    s0.men_losses,
    s0.men_win_rate,
    s0.womens_record,
    s0.women_wins,
    s0.women_losses,
    s0.women_win_rate,
    s0.mixed_wins,
    s0.mixed_losses,
    s0.mixed_record,
    s0.mixed_win_rate,
    s0.clutch_games,
    s0.clutch_wins,
    s0.clutch_record,
    s0.clutch_win_rate,
    s0.total_games,
    s0.total_single_games,
    s0.total_points_won,
    s0.team_point_diff,
    s0.snapshot_date
  from public.team_standings s0
  order by
    s0.team_id,
    s0.division_id,
    s0.season_number,
    s0.season_year,
    s0.snapshot_date desc
)
select
  d.division_name,
  sl.season_number,
  sl.season_year,
  coalesce(ts.team_name, t.team_name) as team_name,
  sl.ranking,
  sl.pod as pod_name,
  sl.pod_ranking,
  sl.wins,
  sl.losses,
  sl.draws,
  sl.record,
  sl.game_record,
  sl.win_percentage,
  sl.game_win_rate,
  sl.average_points_per_game,
  sl.average_point_differential,
  to_char(sl.snapshot_date, 'Mon DD, YYYY') as standings_as_of_date,
  (
    sl.season_year = cs.season_year
    and sl.season_number = cs.season_number
  ) as is_current_season,
  sl.home_wins,
  sl.home_losses,
  sl.home_record,
  sl.home_win_rate,
  sl.away_wins,
  sl.away_losses,
  sl.away_record,
  sl.away_win_rate,
  sl.mens_record,
  sl.men_wins,
  sl.men_losses,
  sl.men_win_rate,
  sl.womens_record,
  sl.women_wins,
  sl.women_losses,
  sl.women_win_rate,
  sl.mixed_wins,
  sl.mixed_losses,
  sl.mixed_record,
  sl.mixed_win_rate,
  sl.clutch_games,
  sl.clutch_wins,
  sl.clutch_record,
  sl.clutch_win_rate,
  sl.total_games,
  sl.total_single_games,
  sl.total_points_won,
  sl.team_point_diff,
  sl.division_id
from standings_latest sl
join public.teams t
  on t.team_id = sl.team_id
join public.divisions d
  on d.division_id = sl.division_id
left join ts_latest ts
  on ts.team_id = sl.team_id
 and ts.division_id = sl.division_id
 and ts.season_number = sl.season_number
 and ts.season_year = sl.season_year
cross join current_season cs
order by
  sl.season_year,
  sl.season_number,
  d.division_name,
  sl.ranking nulls last,
  team_name;

create or replace view public.vw_team_matches
with (security_invoker = true) as
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
),
matchups_latest as (
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
    (now() AT TIME ZONE 'America/New_York') as is_past_match,
  (
    coalesce(ts_team.season_year, ts_opp.season_year) = cs.season_year
    and coalesce(ts_team.season_number, ts_opp.season_number) = cs.season_number
  ) as is_current_season,
  r.division_id
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
cross join current_season cs
where coalesce(r.fallback_team_name, '') <> 'Bye'
  and coalesce(r.fallback_opponent_team_name, '') <> 'Bye'
order by
  season_year,
  season_number,
  d.division_name,
  team_name,
  r.week_number,
  r.match_datetime_utc;
