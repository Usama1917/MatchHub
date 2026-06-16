-- Private ranks ("groups"): a user-created group with its own leaderboard.
CREATE TABLE IF NOT EXISTS rank_groups (
  id serial PRIMARY KEY,
  name text NOT NULL,
  created_by integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rank_group_members (
  id serial PRIMARY KEY,
  group_id integer NOT NULL REFERENCES rank_groups(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS rank_group_members_unique
  ON rank_group_members (group_id, user_id);
