create extension if not exists pgcrypto;

create table if not exists public.regions (
  region_id uuid primary key,
  location text not null,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.divisions (
  division_id uuid primary key,
  region_id uuid not null references public.regions(region_id),
  division_name text not null,
  season_number integer not null,
  season_year integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region_id, division_name, season_number, season_year)
);

create table if not exists public.clubs (
  club_id uuid primary key,
  name text not null,
  logo text,
  color text,
  website text,
  facebook text,
  instagram text,
  twitter text,
  youtube text,
  address text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  team_id uuid primary key,
  division_id uuid not null references public.divisions(division_id),
  club_id uuid not null references public.clubs(club_id),
  team_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (division_id, team_name)
);

create table if not exists public.players (
  player_id uuid primary key,
  division_id uuid not null references public.divisions(division_id),
  team_id uuid references public.teams(team_id),
  first_name text not null,
  middle_name text,
  last_name text not null,
  gender text,
  dupr text,
  dupr_rating numeric(4, 2),
  is_captain boolean not null default false,
  is_sub boolean not null default false,
  club_id uuid references public.clubs(club_id),
  club_name text,
  club_logo text,
  club_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_standings (
  division_id uuid not null references public.divisions(division_id),
  team_id uuid not null references public.teams(team_id),
  season_number integer not null,
  season_year integer not null,
  ranking integer,
  pod text,
  wins integer,
  losses integer,
  draws integer,
  mixed_wins integer,
  women_wins integer,
  men_wins integer,
  mixed_losses integer,
  women_losses integer,
  men_losses integer,
  total_points_won integer,
  team_point_diff integer,
  clutch_wins integer,
  clutch_games integer,
  home_wins integer,
  home_losses integer,
  away_wins integer,
  away_losses integer,
  total_games integer,
  total_single_games integer,
  pod_ranking integer,
  record text,
  game_record text,
  home_record text,
  away_record text,
  mixed_record text,
  clutch_record text,
  mens_record text,
  womens_record text,
  home_win_rate numeric(5, 2),
  away_win_rate numeric(5, 2),
  game_win_rate numeric(5, 2),
  win_percentage numeric(5, 2),
  mixed_win_rate numeric(5, 2),
  women_win_rate numeric(5, 2),
  men_win_rate numeric(5, 2),
  average_points_per_game numeric(7, 2),
  average_point_differential numeric(7, 2),
  clutch_win_rate numeric(5, 2),
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (division_id, team_id, season_number, season_year, snapshot_date)
);

create table if not exists public.player_division_stats (
  division_id uuid not null references public.divisions(division_id),
  player_id uuid not null references public.players(player_id),
  team_id uuid references public.teams(team_id),
  ranking integer,
  wins integer,
  losses integer,
  games_played integer,
  matches_played integer,
  win_rate numeric(5, 2),
  points_won integer,
  total_points_against integer,
  points_per_game numeric(6, 2),
  total_point_differential integer,
  average_point_differential numeric(6, 2),
  clutch_wins integer,
  clutch_losses integer,
  clutch_win_rate numeric(5, 2),
  mixed_ppg numeric(6, 2),
  mixed_wins integer,
  mixed_losses integer,
  gender_ppg numeric(6, 2),
  gender_wins integer,
  gender_losses integer,
  strength_of_opponent numeric(8, 4),
  last_week_strength_of_opponent numeric(8, 4),
  last_week_ranking integer,
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (division_id, player_id, snapshot_date)
);

create table if not exists public.matchups (
  matchup_id uuid primary key,
  division_id uuid not null references public.divisions(division_id),
  week_number integer,
  home_team_id uuid references public.teams(team_id),
  away_team_id uuid references public.teams(team_id),
  home_points integer,
  away_points integer,
  end_result text,
  away_lineup_locked boolean,
  home_lineup_locked boolean,
  scheduled_time timestamptz,
  home_name text,
  away_name text,
  playoffs boolean not null default false,
  playoff_game text,
  home_pod_ranking integer,
  away_pod_ranking integer,
  home_wins integer,
  away_wins integer,
  address text,
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matchup_player_stats (
  matchup_id uuid not null references public.matchups(matchup_id),
  player_id uuid not null references public.players(player_id),
  team_id uuid references public.teams(team_id),
  division_id uuid references public.divisions(division_id),
  first_name text,
  middle_name text,
  last_name text,
  gender text,
  is_sub boolean,
  is_enabled boolean,
  games_played integer,
  wins integer,
  losses integer,
  win_rate numeric(5, 2),
  points_won integer,
  total_points_against integer,
  points_per_game numeric(6, 2),
  total_point_differential integer,
  average_point_differential numeric(6, 2),
  clutch_wins integer,
  clutch_losses integer,
  clutch_win_rate numeric(5, 2),
  mixed_ppg numeric(6, 2),
  mixed_wins integer,
  mixed_losses integer,
  gender_ppg numeric(6, 2),
  gender_wins integer,
  gender_losses integer,
  strength_of_opponent numeric(8, 4),
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (matchup_id, player_id, snapshot_date)
);

create table if not exists public.lineups (
  lineup_id uuid primary key default gen_random_uuid(),
  matchup_id uuid not null references public.matchups(matchup_id),
  team_id uuid not null references public.teams(team_id),
  submitted_at timestamptz,
  locked boolean not null default false,
  raw_json jsonb,
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (matchup_id, team_id, snapshot_date)
);

create table if not exists public.lineup_slots (
  lineup_id uuid not null references public.lineups(lineup_id) on delete cascade,
  slot_no integer not null,
  player_id uuid references public.players(player_id),
  partner_player_id uuid references public.players(player_id),
  court_no integer,
  role text,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (lineup_id, slot_no)
);

create table if not exists public.api_raw_ingest (
  id bigint generated by default as identity primary key,
  endpoint text not null,
  fetched_at timestamptz not null default now(),
  payload jsonb not null,
  payload_hash text,
  run_id uuid,
  context jsonb
);

create table if not exists public.ingest_runs (
  run_id uuid primary key default gen_random_uuid(),
  run_type text not null,
  status text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  rows_written integer not null default 0,
  error_message text,
  metadata jsonb
);

create table if not exists public.ingest_checkpoints (
  checkpoint_key text primary key,
  checkpoint_value text,
  updated_at timestamptz not null default now(),
  last_run_id uuid references public.ingest_runs(run_id)
);

create index if not exists idx_divisions_region on public.divisions(region_id);
create index if not exists idx_teams_division on public.teams(division_id);
create index if not exists idx_teams_club on public.teams(club_id);
create index if not exists idx_players_division on public.players(division_id);
create index if not exists idx_players_team on public.players(team_id);
create index if not exists idx_team_standings_division_snapshot on public.team_standings(division_id, snapshot_date);
create index if not exists idx_player_division_stats_division_snapshot on public.player_division_stats(division_id, snapshot_date);
create index if not exists idx_matchups_division_week on public.matchups(division_id, week_number);
create index if not exists idx_matchups_scheduled_time on public.matchups(scheduled_time);
create index if not exists idx_matchup_player_stats_matchup on public.matchup_player_stats(matchup_id);
create index if not exists idx_lineups_matchup on public.lineups(matchup_id);
create index if not exists idx_api_raw_ingest_endpoint_time on public.api_raw_ingest(endpoint, fetched_at desc);
create index if not exists idx_api_raw_ingest_run_id on public.api_raw_ingest(run_id);

-- semantic views for llm query layer

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

create or replace view public.vw_player_stats_per_match
with (security_invoker = true) as
with mps_latest as (
  select distinct on (mps0.player_id, mps0.matchup_id)
    mps0.player_id,
    mps0.matchup_id,
    mps0.team_id,
    mps0.division_id,
    mps0.games_played,
    mps0.wins,
    mps0.losses,
    mps0.points_won,
    mps0.total_points_against,
    mps0.win_rate,
    mps0.snapshot_date
  from public.matchup_player_stats mps0
  order by
    mps0.player_id,
    mps0.matchup_id,
    mps0.snapshot_date desc
)
select
  p.first_name || ' ' || p.last_name as player_full_name,
  coalesce(ts.team_name, t.team_name) as team_name,
  d.division_name,
  ts.season_number,
  ts.season_year,
  m.week_number,
  to_char(m.scheduled_time, 'Mon DD, YYYY HH:MIam') as match_datetime,
  m.home_name,
  m.away_name,
  m.end_result,
  m.playoffs,
  m.playoff_game,
  mps.games_played,
  mps.wins,
  mps.losses,
  mps.points_won as total_points_won,
  mps.total_points_against as total_points_lost,
  mps.win_rate,
  to_char(mps.snapshot_date, 'Mon DD, YYYY') as match_as_of_date
from mps_latest mps
join public.players p on p.player_id = mps.player_id
left join public.teams t on t.team_id = mps.team_id
join public.divisions d on d.division_id = mps.division_id
join public.matchups m on m.matchup_id = mps.matchup_id
left join lateral (
  select
    ts0.team_name,
    ts0.season_number,
    ts0.season_year
  from public.team_seasons ts0
  where ts0.team_id = mps.team_id
    and ts0.division_id = mps.division_id
    and ts0.snapshot_date <= mps.snapshot_date
  order by ts0.snapshot_date desc
  limit 1
) ts on true
where coalesce(mps.games_played, 0) > 0
  and coalesce(m.home_name, '') <> 'Bye'
  and coalesce(m.away_name, '') <> 'Bye'
order by
  coalesce(ts.season_year, 0),
  coalesce(ts.season_number, 0),
  d.division_name,
  team_name,
  player_full_name,
  m.week_number,
  m.scheduled_time desc;

create or replace view public.vw_match_game_lineups_scores
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
)
select
  d.division_name,
  d.season_number,
  d.season_year,
  m.week_number,
  to_char(m.scheduled_time AT TIME ZONE 'America/New_York', 'Mon DD, YYYY HH:MIam') as match_datetime,
  coalesce(ts_home.team_name, th.team_name, m.home_name) as home_team_name,
  coalesce(ts_away.team_name, ta.team_name, m.away_name) as away_team_name,
  pg.game_number,
  pg.match_type,
  hp1.first_name || ' ' || hp1.last_name as home_player_1_full_name,
  hp2.first_name || ' ' || hp2.last_name as home_player_2_full_name,
  ap1.first_name || ' ' || ap1.last_name as away_player_1_full_name,
  ap2.first_name || ' ' || ap2.last_name as away_player_2_full_name,
  pg.home_score,
  pg.away_score,
  case
    when pg.home_score > pg.away_score then 'home'
    when pg.away_score > pg.home_score then 'away'
    else 'draw'
  end as game_winner,
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
order by
  d.season_year,
  d.season_number,
  d.division_name,
  m.week_number,
  m.scheduled_time,
  pg.game_number;

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

create or replace view public.vw_team_standings as
with ts_latest as (
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
  to_char(sl.snapshot_date, 'Mon DD, YYYY') as standings_as_of_date
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
order by
  sl.season_year,
  sl.season_number,
  d.division_name,
  sl.ranking nulls last,
  team_name;

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

-- add current season flag to all season-scoped views
do $$
declare
  secure_views text[] := array[
    'vw_player_stats_per_season',
    'vw_player_stats_per_match',
    'vw_player_game_history',
    'vw_match_game_lineups_scores',
    'vw_team_matches'
  ];
  non_secure_views text[] := array[
    'vw_team_standings'
  ];
  view_name text;
  view_sql text;
begin
  foreach view_name in array secure_views
  loop
    select pg_get_viewdef(format('public.%I', view_name)::regclass, true)
      into view_sql;
    view_sql := btrim(view_sql);
    if right(view_sql, 1) = ';' then
      view_sql := left(view_sql, length(view_sql) - 1);
    end if;

    execute format(
      $sql$
      create or replace view public.%I
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
      base as (
        %s
      )
      select
        base.*,
        (
          base.season_year = cs.season_year
          and base.season_number = cs.season_number
        ) as is_current_season
      from base
      cross join current_season cs
      $sql$,
      view_name,
      view_sql
    );
  end loop;

  foreach view_name in array non_secure_views
  loop
    select pg_get_viewdef(format('public.%I', view_name)::regclass, true)
      into view_sql;
    view_sql := btrim(view_sql);
    if right(view_sql, 1) = ';' then
      view_sql := left(view_sql, length(view_sql) - 1);
    end if;

    execute format(
      $sql$
      create or replace view public.%I as
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
      base as (
        %s
      )
      select
        base.*,
        (
          base.season_year = cs.season_year
          and base.season_number = cs.season_number
        ) as is_current_season
      from base
      cross join current_season cs
      $sql$,
      view_name,
      view_sql
    );
  end loop;
end $$;

create or replace view public.vw_player_status_per_season
with (security_invoker = true) as
select *
from public.vw_player_stats_per_season;
