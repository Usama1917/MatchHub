import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const rankGroupStatusEnum = pgEnum("rank_group_status", ["active", "ended"]);

export const rankGroupsTable = pgTable("rank_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => usersTable.id, { onDelete: "restrict" }),
  code: text("code").notNull().unique(),
  status: rankGroupStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const rankGroupMembersTable = pgTable("rank_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id")
    .notNull()
    .references(() => rankGroupsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  hiddenOnProfile: boolean("hidden_on_profile").notNull().default(false),
}, (table) => ({
  groupUserUnique: uniqueIndex("rank_group_members_unique").on(
    table.groupId,
    table.userId,
  ),
  userIdIdx: index("rank_group_members_user_id").on(table.userId),
}));

export type RankGroup = typeof rankGroupsTable.$inferSelect;
export type RankGroupMember = typeof rankGroupMembersTable.$inferSelect;
