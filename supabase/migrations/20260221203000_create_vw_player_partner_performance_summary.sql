create or replace view public.vw_player_partner_performance_summary
with (security_invoker = true) as
with enriched as (
  select
    pgh.division_name,
    pgh.season_year,
    pgh.season_number,
    pgh.is_current_season,
    pgh.primary_player_full_name,
    pgh.partner_player_full_name,
    pgh.primary_player_gender,
    pgh.partner_player_gender,
    pgh.match_type,
    pgh.opponent_team_name,
    case
      when pgh.opponent_player_1_gender = 'Male' and pgh.opponent_player_2_gender = 'Male' then 'men'
      when pgh.opponent_player_1_gender = 'Female' and pgh.opponent_player_2_gender = 'Female' then 'women'
      when pgh.opponent_player_1_gender is null or pgh.opponent_player_2_gender is null then 'unknown'
      else 'mixed'
    end as opponent_pair_type,
    case
      when pgh.primary_player_gender = 'Male' and pgh.partner_player_gender = 'Male' then 'men'
      when pgh.primary_player_gender = 'Female' and pgh.partner_player_gender = 'Female' then 'women'
      when pgh.primary_player_gender is null or pgh.partner_player_gender is null then 'unknown'
      else 'mixed'
    end as partner_pair_type,
    pgh.game_result,
    pgh.primary_side_score,
    pgh.opponent_side_score,
    (pgh.primary_side_score - pgh.opponent_side_score) as point_diff,
    abs(pgh.primary_side_score - pgh.opponent_side_score) <= 2 as is_close_game,
    pgh.scheduled_time_utc
  from public.vw_player_game_history pgh
  where pgh.primary_player_full_name is not null
    and pgh.partner_player_full_name is not null
),
summary as (
  select
    e.division_name,
    e.season_year,
    e.season_number,
    e.is_current_season,
    e.primary_player_full_name,
    e.partner_player_full_name,
    e.primary_player_gender,
    e.partner_player_gender,
    e.partner_pair_type,
    e.match_type,
    case
      when grouping(e.opponent_pair_type) = 0 and grouping(e.opponent_team_name) = 1 then 'opponent_pair_type'
      when grouping(e.opponent_pair_type) = 1 and grouping(e.opponent_team_name) = 0 then 'opponent_team'
      else 'overall'
    end as opponent_context_type,
    case
      when grouping(e.opponent_pair_type) = 0 then e.opponent_pair_type
      when grouping(e.opponent_team_name) = 0 then e.opponent_team_name
      else 'ALL'
    end as opponent_context_value,
    count(*) as games_played,
    count(*) filter (where e.game_result = 'win') as wins,
    count(*) filter (where e.game_result = 'loss') as losses,
    count(*) filter (where e.game_result = 'draw') as draws,
    round((count(*) filter (where e.game_result = 'win'))::numeric / nullif(count(*), 0), 4) as win_rate,
    round(avg(e.primary_side_score)::numeric, 2) as avg_points_for,
    round(avg(e.opponent_side_score)::numeric, 2) as avg_points_against,
    round(avg(e.point_diff)::numeric, 2) as avg_point_diff,
    round(avg(case when e.is_close_game and e.game_result = 'win' then 1.0 else 0.0 end)::numeric, 4) as close_game_win_rate,
    max(e.scheduled_time_utc) as last_played_match_utc
  from enriched e
  group by grouping sets (
    (
      e.division_name,
      e.season_year,
      e.season_number,
      e.is_current_season,
      e.primary_player_full_name,
      e.partner_player_full_name,
      e.primary_player_gender,
      e.partner_player_gender,
      e.partner_pair_type,
      e.match_type,
      e.opponent_pair_type
    ),
    (
      e.division_name,
      e.season_year,
      e.season_number,
      e.is_current_season,
      e.primary_player_full_name,
      e.partner_player_full_name,
      e.primary_player_gender,
      e.partner_player_gender,
      e.partner_pair_type,
      e.match_type,
      e.opponent_team_name
    ),
    (
      e.division_name,
      e.season_year,
      e.season_number,
      e.is_current_season,
      e.primary_player_full_name,
      e.partner_player_full_name,
      e.primary_player_gender,
      e.partner_player_gender,
      e.partner_pair_type,
      e.match_type
    )
  )
)
select
  s.division_name,
  s.season_year,
  s.season_number,
  s.is_current_season,
  s.primary_player_full_name,
  s.partner_player_full_name,
  s.primary_player_gender,
  s.partner_player_gender,
  s.partner_pair_type,
  s.match_type,
  s.opponent_context_type,
  s.opponent_context_value,
  s.games_played,
  s.wins,
  s.losses,
  s.draws,
  s.win_rate,
  s.avg_points_for,
  s.avg_points_against,
  s.avg_point_diff,
  s.close_game_win_rate,
  to_char(s.last_played_match_utc AT TIME ZONE 'America/New_York', 'Mon DD, YYYY HH:MIam') as last_played_match_datetime,
  case
    when s.games_played >= 20 then 'high'
    when s.games_played >= 8 then 'medium'
    else 'low'
  end as sample_confidence
from summary s;
