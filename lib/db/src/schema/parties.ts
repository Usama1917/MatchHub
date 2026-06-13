import {
  pgTable,
  serial,
  text,
  timestamp,
  pgEnum,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Game and match format live on matches now; the enums stay here because
// matches.ts imports them. A party is just a "room" identified by its code.
export const gameEnum = pgEnum("game", ["fifa", "pes"]);
export const matchFormatEnum = pgEnum("match_format", ["1v1", "2v2", "3v3"]);
export const partyStatusEnum = pgEnum("party_status", ["pending", "in_progress", "completed"]);

export const partiesTable = pgTable("parties", {
  id: serial("id").primaryKey(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => usersTable.id, { onDelete: "restrict" }),
  code: text("code").notNull().unique(),
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
    .references(() => usersTable.id, { onDelete: "restrict" }),
}, (table) => ({
  partyUserUnique: uniqueIndex("party_members_party_user_unique").on(
    table.partyId,
    table.userId,
  ),
}));

export const insertPartySchema = createInsertSchema(partiesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertParty = z.infer<typeof insertPartySchema>;
export type Party = typeof partiesTable.$inferSelect;
export type PartyMember = typeof partyMembersTable.$inferSelect;
