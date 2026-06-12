import { pgTable, serial, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
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
    .references(() => usersTable.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const matchPlayersTable = pgTable("match_players", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id")
    .notNull()
    .references(() => matchesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  team: teamEnum("team"),
  isSpectator: integer("is_spectator").notNull().default(0),
  result: resultEnum("result"),
  points: integer("points").notNull().default(0),
  goalsFor: integer("goals_for").notNull().default(0),
  goalsAgainst: integer("goals_against").notNull().default(0),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
export type MatchPlayer = typeof matchPlayersTable.$inferSelect;
