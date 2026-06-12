import { pgTable, serial, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const gameEnum = pgEnum("game", ["fifa", "pes"]);
export const matchFormatEnum = pgEnum("match_format", ["1v1", "2v2", "3v3"]);
export const partyStatusEnum = pgEnum("party_status", ["pending", "in_progress", "completed"]);

export const partiesTable = pgTable("parties", {
  id: serial("id").primaryKey(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  game: gameEnum("game").notNull(),
  matchFormat: matchFormatEnum("match_format").notNull(),
  status: partyStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const partyMembersTable = pgTable("party_members", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id")
    .notNull()
    .references(() => partiesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
});

export const insertPartySchema = createInsertSchema(partiesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertParty = z.infer<typeof insertPartySchema>;
export type Party = typeof partiesTable.$inferSelect;
export type PartyMember = typeof partyMembersTable.$inferSelect;
