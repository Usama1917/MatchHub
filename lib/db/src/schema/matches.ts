import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  timestamp,
  pgEnum,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { partiesTable, gameEnum, matchFormatEnum } from "./parties";

export const matchStatusEnum = pgEnum("match_status", [
  "pending",
  "in_progress",
  "completed",
]);

export const winTypeEnum = pgEnum("win_type", [
  "normal",
  "penalties",
  "golden_goal",
]);

export const teamEnum = pgEnum("team", ["team_a", "team_b"]);
export const resultEnum = pgEnum("result", ["win", "loss"]);

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id")
    .notNull()
    .references(() => partiesTable.id, { onDelete: "cascade" }),
  game: gameEnum("game").notNull(),
  matchFormat: matchFormatEnum("match_format").notNull(),
  teamAScore: integer("team_a_score"),
  teamBScore: integer("team_b_score"),
  winnerTeam: teamEnum("winner_team"),
  winType: winTypeEnum("win_type"),
  status: matchStatusEnum("status").notNull().default("pending"),
  createdBy: integer("created_by")
    .notNull()
    .references(() => usersTable.id, { onDelete: "restrict" }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  partyIdIdx: index("matches_party_id").on(table.partyId),
  teamAScoreNonNegative: check(
    "matches_team_a_score_non_negative",
    sql`${table.teamAScore} IS NULL OR ${table.teamAScore} >= 0`,
  ),
  teamBScoreNonNegative: check(
    "matches_team_b_score_non_negative",
    sql`${table.teamBScore} IS NULL OR ${table.teamBScore} >= 0`,
  ),
}));

export const matchPlayersTable = pgTable("match_players", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id")
    .notNull()
    .references(() => matchesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "restrict" }),
  team: teamEnum("team"),
  isSpectator: integer("is_spectator").notNull().default(0),
  result: resultEnum("result"),
  points: integer("points").notNull().default(0),
  goalsFor: integer("goals_for").notNull().default(0),
  goalsAgainst: integer("goals_against").notNull().default(0),
}, (table) => ({
  matchUserUnique: uniqueIndex("match_players_match_user_unique").on(
    table.matchId,
    table.userId,
  ),
  userIdIdx: index("match_players_user_id").on(table.userId),
  isSpectatorBoolean: check(
    "match_players_is_spectator_boolean",
    sql`${table.isSpectator} IN (0, 1)`,
  ),
  pointsNonNegative: check(
    "match_players_points_non_negative",
    sql`${table.points} >= 0`,
  ),
  goalsForNonNegative: check(
    "match_players_goals_for_non_negative",
    sql`${table.goalsFor} >= 0`,
  ),
  goalsAgainstNonNegative: check(
    "match_players_goals_against_non_negative",
    sql`${table.goalsAgainst} >= 0`,
  ),
}));

export const insertMatchSchema = createInsertSchema(matchesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
export type MatchPlayer = typeof matchPlayersTable.$inferSelect;
