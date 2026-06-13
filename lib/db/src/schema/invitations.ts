import {
  pgTable,
  serial,
  timestamp,
  integer,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { partiesTable } from "./parties";

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const partyInvitationsTable = pgTable("party_invitations", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id")
    .notNull()
    .references(() => partiesTable.id, { onDelete: "cascade" }),
  fromUserId: integer("from_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  toUserId: integer("to_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  status: invitationStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  partyToUnique: uniqueIndex("party_invitations_party_to_unique").on(
    table.partyId,
    table.toUserId,
  ),
  toPending: index("party_invitations_to_pending").on(
    table.toUserId,
    table.status,
  ),
}));

export type PartyInvitation = typeof partyInvitationsTable.$inferSelect;
