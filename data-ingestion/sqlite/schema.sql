PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS regions (
  region_id TEXT PRIMARY KEY,
  location TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS divisions (
  division_id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL,
  division_name TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  FOREIGN KEY (region_id) REFERENCES regions(region_id)
);

CREATE TABLE IF NOT EXISTS clubs (
  club_id TEXT PRIMARY KEY,
  club_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  team_id TEXT PRIMARY KEY,
  club_id TEXT,
  team_name TEXT NOT NULL,
  FOREIGN KEY (club_id) REFERENCES clubs(club_id)
);

CREATE TABLE IF NOT EXISTS players (
  player_id TEXT PRIMARY KEY,
  full_name TEXT,
  team_id TEXT,
  FOREIGN KEY (team_id) REFERENCES teams(team_id)
);

CREATE TABLE IF NOT EXISTS team_seasons (
  team_id TEXT NOT NULL,
  division_id TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  PRIMARY KEY (team_id, division_id, season_year, season_number),
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id)
);

CREATE TABLE IF NOT EXISTS player_rosters (
  player_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  division_id TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  PRIMARY KEY (player_id, team_id, division_id, season_year, season_number),
  FOREIGN KEY (player_id) REFERENCES players(player_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id)
);

CREATE TABLE IF NOT EXISTS team_standings (
  division_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  wins INTEGER,
  losses INTEGER,
  PRIMARY KEY (division_id, team_id, season_year, season_number),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id)
);

CREATE TABLE IF NOT EXISTS player_division_stats (
  division_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  wins INTEGER,
  losses INTEGER,
  PRIMARY KEY (division_id, player_id, season_year, season_number),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE IF NOT EXISTS matchups (
  matchup_id TEXT PRIMARY KEY,
  division_id TEXT NOT NULL,
  home_team_id TEXT,
  away_team_id TEXT,
  scheduled_time TEXT,
  season_year INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  FOREIGN KEY (division_id) REFERENCES divisions(division_id),
  FOREIGN KEY (home_team_id) REFERENCES teams(team_id),
  FOREIGN KEY (away_team_id) REFERENCES teams(team_id)
);

CREATE TABLE IF NOT EXISTS playoff_matchups (
  matchup_id TEXT PRIMARY KEY,
  division_id TEXT NOT NULL,
  home_team_id TEXT,
  away_team_id TEXT,
  scheduled_time TEXT,
  season_year INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  FOREIGN KEY (division_id) REFERENCES divisions(division_id),
  FOREIGN KEY (home_team_id) REFERENCES teams(team_id),
  FOREIGN KEY (away_team_id) REFERENCES teams(team_id)
);

CREATE TABLE IF NOT EXISTS lineups (
  lineup_id TEXT PRIMARY KEY,
  matchup_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  is_home INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (matchup_id) REFERENCES matchups(matchup_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id)
);

CREATE TABLE IF NOT EXISTS lineup_slots (
  lineup_id TEXT NOT NULL,
  slot_number INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  PRIMARY KEY (lineup_id, slot_number),
  FOREIGN KEY (lineup_id) REFERENCES lineups(lineup_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE IF NOT EXISTS matchup_player_stats (
  matchup_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  team_id TEXT,
  wins INTEGER,
  losses INTEGER,
  PRIMARY KEY (matchup_id, player_id),
  FOREIGN KEY (matchup_id) REFERENCES matchups(matchup_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id)
);

CREATE TABLE IF NOT EXISTS api_raw_ingest (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  division_id TEXT,
  season_year INTEGER,
  season_number INTEGER,
  payload_json TEXT NOT NULL,
  ingested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ingest_runs (
  run_id TEXT PRIMARY KEY,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  rows_written INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS ingest_checkpoints (
  checkpoint_key TEXT PRIMARY KEY,
  checkpoint_value TEXT,
  last_run_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (last_run_id) REFERENCES ingest_runs(run_id)
);
