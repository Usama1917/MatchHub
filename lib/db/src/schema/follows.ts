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

export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  followingId: integer("following_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pairUnique: uniqueIndex("follows_pair_unique").on(
    table.followerId,
    table.followingId,
  ),
  followingIdx: index("follows_following_id").on(table.followingId),
  noSelf: check(
    "follows_no_self",
    sql`${table.followerId} <> ${table.followingId}`,
  ),
}));

export type Follow = typeof followsTable.$inferSelect;
