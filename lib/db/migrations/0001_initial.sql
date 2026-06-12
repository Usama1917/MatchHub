DO $$
BEGIN
  CREATE TYPE role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE game AS ENUM ('fifa', 'pes');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE match_format AS ENUM ('1v1', '2v2', '3v3');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE party_status AS ENUM ('pending', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE match_status AS ENUM ('pending', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE win_type AS ENUM ('normal', 'penalties', 'golden_goal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE team AS ENUM ('team_a', 'team_b');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE result AS ENUM ('win', 'loss');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parties (
  id serial PRIMARY KEY,
  created_by integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  game game NOT NULL,
  match_format match_format NOT NULL,
  status party_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS party_members (
  id serial PRIMARY KEY,
  party_id integer NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS party_members_party_user_unique
  ON party_members (party_id, user_id);

CREATE TABLE IF NOT EXISTS matches (
  id serial PRIMARY KEY,
  party_id integer NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  game game NOT NULL,
  match_format match_format NOT NULL,
  team_a_score integer,
  team_b_score integer,
  winner_team team,
  win_type win_type,
  status match_status NOT NULL DEFAULT 'pending',
  created_by integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matches_team_a_score_non_negative
    CHECK (team_a_score IS NULL OR team_a_score >= 0),
  CONSTRAINT matches_team_b_score_non_negative
    CHECK (team_b_score IS NULL OR team_b_score >= 0)
);

CREATE TABLE IF NOT EXISTS match_players (
  id serial PRIMARY KEY,
  match_id integer NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  team team,
  is_spectator integer NOT NULL DEFAULT 0,
  result result,
  points integer NOT NULL DEFAULT 0,
  goals_for integer NOT NULL DEFAULT 0,
  goals_against integer NOT NULL DEFAULT 0,
  CONSTRAINT match_players_is_spectator_boolean CHECK (is_spectator IN (0, 1)),
  CONSTRAINT match_players_points_non_negative CHECK (points >= 0),
  CONSTRAINT match_players_goals_for_non_negative CHECK (goals_for >= 0),
  CONSTRAINT match_players_goals_against_non_negative CHECK (goals_against >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS match_players_match_user_unique
  ON match_players (match_id, user_id);

CREATE TABLE IF NOT EXISTS session (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);
