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
  sl.team_point_diff
from standings_latest sl
join public.teams t
  on t.team_id = sl.team_id
join public.divisions d
  on d.division_id = sl.division_id
left join public.clubs c
  on c.club_id = t.club_id
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
