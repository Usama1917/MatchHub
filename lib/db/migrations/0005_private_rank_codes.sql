DO $$
BEGIN
  CREATE TYPE rank_group_status AS ENUM ('active', 'ended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE rank_groups
  ADD COLUMN IF NOT EXISTS code text;

ALTER TABLE rank_groups
  ADD COLUMN IF NOT EXISTS status rank_group_status NOT NULL DEFAULT 'active';

ALTER TABLE rank_groups
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

UPDATE rank_groups
SET code = lpad(((id * 7919) % 1000000)::text, 6, '0')
WHERE code IS NULL;

ALTER TABLE rank_groups
  ALTER COLUMN code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rank_groups_code_unique
  ON rank_groups (code);
