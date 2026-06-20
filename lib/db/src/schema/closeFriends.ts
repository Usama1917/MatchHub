import {
  pgTable,
  serial,
  timestamp,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

// Directed "close friend" edges between users. When two users have marked each
// other as close friends (mutual edges), adding one to a party the other creates
// joins them immediately instead of sending an invitation to accept/reject.
export const closeFriendsTable = pgTable("close_friends", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  closeFriendId: integer("close_friend_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pairUnique: uniqueIndex("close_friends_pair_unique").on(
    table.userId,
    table.closeFriendId,
  ),
  closeFriendIdx: index("close_friends_close_friend_id").on(table.closeFriendId),
  noSelf: check(
    "close_friends_no_self",
    sql`${table.userId} <> ${table.closeFriendId}`,
  ),
}));

export type CloseFriend = typeof closeFriendsTable.$inferSelect;
