-- Let a user hide specific private ranks from their own profile. Per-membership
-- flag; defaults to visible.
ALTER TABLE rank_group_members
  ADD COLUMN IF NOT EXISTS hidden_on_profile boolean NOT NULL DEFAULT false;
