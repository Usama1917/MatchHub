-- Party codes: each party gets a unique numeric code (6 digits).
ALTER TABLE parties ADD COLUMN IF NOT EXISTS code text;

-- Backfill any existing parties with a deterministic numeric code derived from id.
UPDATE parties
SET code = lpad((id % 1000000)::text, 6, '0')
WHERE code IS NULL;

ALTER TABLE parties ALTER COLUMN code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS parties_code_unique ON parties (code);

-- A party is now just a "room" identified by its code.
-- Game and match format move to the match level (matches already carry them).
ALTER TABLE parties DROP COLUMN IF EXISTS game;
ALTER TABLE parties DROP COLUMN IF EXISTS match_format;

-- Follows: directed follow edges between users (mutual follow = friendship).
CREATE TABLE IF NOT EXISTS follows (
  id serial PRIMARY KEY,
  follower_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT follows_no_self CHECK (follower_id <> following_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS follows_pair_unique
  ON follows (follower_id, following_id);
