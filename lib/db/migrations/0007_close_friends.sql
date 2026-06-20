-- Close friends: directed edges between users. Mutual edges (A->B and B->A)
-- let a party creator add the other person directly without an invitation.
CREATE TABLE IF NOT EXISTS close_friends (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  close_friend_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT close_friends_no_self CHECK (user_id <> close_friend_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS close_friends_pair_unique
  ON close_friends (user_id, close_friend_id);

CREATE INDEX IF NOT EXISTS close_friends_close_friend_id
  ON close_friends (close_friend_id);
