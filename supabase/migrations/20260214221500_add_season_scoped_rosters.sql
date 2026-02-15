create table if not exists public.player_rosters (
  player_id uuid not null references public.players(player_id),
  division_id uuid not null references public.divisions(division_id),
  team_id uuid references public.teams(team_id),
  season_number integer not null,
  season_year integer not null,
  is_captain boolean not null default false,
  is_sub boolean not null default false,
  club_id uuid references public.clubs(club_id),
  club_name text,
  club_logo text,
  club_color text,
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_id, division_id, season_number, season_year, snapshot_date)
);

create table if not exists public.team_seasons (
  team_id uuid not null references public.teams(team_id),
  division_id uuid not null references public.divisions(division_id),
  club_id uuid references public.clubs(club_id),
  team_name text not null,
  season_number integer not null,
  season_year integer not null,
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_id, division_id, season_number, season_year, snapshot_date)
);

create index if not exists idx_player_rosters_division_season
  on public.player_rosters(division_id, season_year, season_number, snapshot_date);
create index if not exists idx_player_rosters_team
  on public.player_rosters(team_id);
create index if not exists idx_team_seasons_division_season
  on public.team_seasons(division_id, season_year, season_number, snapshot_date);

alter table public.player_rosters enable row level security;
alter table public.team_seasons enable row level security;

drop policy if exists public_read_player_rosters on public.player_rosters;
drop policy if exists public_read_team_seasons on public.team_seasons;

create policy public_read_player_rosters on public.player_rosters
  for select to anon, authenticated using (true);
create policy public_read_team_seasons on public.team_seasons
  for select to anon, authenticated using (true);
