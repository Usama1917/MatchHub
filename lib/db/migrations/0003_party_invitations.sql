DO $$
BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS party_invitations (
  id serial PRIMARY KEY,
  party_id integer NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  from_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status invitation_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS party_invitations_party_to_unique
  ON party_invitations (party_id, to_user_id);

CREATE INDEX IF NOT EXISTS party_invitations_to_pending
  ON party_invitations (to_user_id, status);
