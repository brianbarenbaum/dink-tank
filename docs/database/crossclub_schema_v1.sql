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
