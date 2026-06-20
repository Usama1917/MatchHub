-- Indexes on hot foreign-key / lookup columns that are only the trailing
-- column of an existing composite unique index (and therefore unusable for
-- single-column filters), plus matches.party_id which had no index at all.
CREATE INDEX IF NOT EXISTS rank_group_members_user_id ON rank_group_members (user_id);
CREATE INDEX IF NOT EXISTS match_players_user_id ON match_players (user_id);
CREATE INDEX IF NOT EXISTS matches_party_id ON matches (party_id);
CREATE INDEX IF NOT EXISTS party_members_user_id ON party_members (user_id);
CREATE INDEX IF NOT EXISTS follows_following_id ON follows (following_id);
