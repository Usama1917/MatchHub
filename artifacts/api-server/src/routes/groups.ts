import { Router, Request, Response } from "express";
import {
  db,
  rankGroupsTable,
  rankGroupMembersTable,
  matchPlayersTable,
  matchesTable,
  usersTable,
} from "@workspace/db";
import { eq, and, inArray, desc, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { parseIdParam } from "../lib/http";
import { deriveMatchPlayerStats } from "./matchHelpers";

const router = Router();

function safeUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function getGroupMemberIds(groupId: number): Promise<number[]> {
  const rows = await db
    .select({ userId: rankGroupMembersTable.userId })
    .from(rankGroupMembersTable)
    .where(eq(rankGroupMembersTable.groupId, groupId));
  return rows.map((r) => r.userId);
}

async function isMember(groupId: number, userId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: rankGroupMembersTable.id })
    .from(rankGroupMembersTable)
    .where(
      and(
        eq(rankGroupMembersTable.groupId, groupId),
        eq(rankGroupMembersTable.userId, userId),
      ),
    )
    .limit(1);
  return !!row;
}

async function buildGroupResponse(group: any) {
  const members = await db
    .select({ user: usersTable })
    .from(rankGroupMembersTable)
    .innerJoin(usersTable, eq(rankGroupMembersTable.userId, usersTable.id))
    .where(eq(rankGroupMembersTable.groupId, group.id));

  return {
    id: group.id,
    name: group.name,
    createdBy: group.createdBy,
    createdAt: group.createdAt,
    members: members.map(({ user }) => safeUser(user)),
  };
}

// A completed match counts toward a group only when at least 2 of its active
// players are group members. Only member players' stats are aggregated.
export async function computeGroupRankings(
  memberIds: number[],
  game?: "fifa" | "pes",
) {
  if (memberIds.length === 0) return [];

  const conditions = [
    eq(matchPlayersTable.isSpectator, 0),
    eq(matchesTable.status, "completed"),
    inArray(matchPlayersTable.userId, memberIds),
  ];
  if (game) conditions.push(eq(matchesTable.game, game));

  const rows = await db
    .select({
      mp: matchPlayersTable,
      m: matchesTable,
      displayName: usersTable.displayName,
      username: usersTable.username,
    })
    .from(matchPlayersTable)
    .innerJoin(matchesTable, eq(matchPlayersTable.matchId, matchesTable.id))
    .innerJoin(usersTable, eq(matchPlayersTable.userId, usersTable.id))
    .where(and(...conditions));

  // Count member players per match.
  const membersPerMatch = new Map<number, number>();
  for (const r of rows) {
    membersPerMatch.set(r.m.id, (membersPerMatch.get(r.m.id) ?? 0) + 1);
  }

  const statsMap = new Map<
    number,
    {
      userId: number;
      username: string;
      displayName: string;
      points: number;
      matches: number;
      wins: number;
      losses: number;
      goalsFor: number;
      goalsAgainst: number;
    }
  >();

  for (const row of rows) {
    if ((membersPerMatch.get(row.m.id) ?? 0) < 2) continue;

    const derived = deriveMatchPlayerStats(row.m, row.mp);

    if (!statsMap.has(row.mp.userId)) {
      statsMap.set(row.mp.userId, {
        userId: row.mp.userId,
        username: row.username,
        displayName: row.displayName,
        points: 0,
        matches: 0,
        wins: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      });
    }
    const stat = statsMap.get(row.mp.userId)!;
    stat.points += derived.points;
    stat.matches++;
    stat.goalsFor += derived.goalsFor;
    stat.goalsAgainst += derived.goalsAgainst;
    if (derived.result === "win") stat.wins++;
    else if (derived.result === "loss") stat.losses++;
  }

  const entries = Array.from(statsMap.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const diffB = b.goalsFor - b.goalsAgainst;
    const diffA = a.goalsFor - a.goalsAgainst;
    if (diffB !== diffA) return diffB - diffA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.matches - b.matches;
  });

  return entries.map((e, idx) => ({
    rank: idx + 1,
    userId: e.userId,
    username: e.username,
    displayName: e.displayName,
    points: e.points,
    matches: e.matches,
    wins: e.wins,
    losses: e.losses,
    goalsFor: e.goalsFor,
    goalsAgainst: e.goalsAgainst,
    goalDifference: e.goalsFor - e.goalsAgainst,
    winRate: e.matches > 0 ? Math.round((e.wins / e.matches) * 100) : 0,
  }));
}

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  const myGroups = await db
    .select({ group: rankGroupsTable })
    .from(rankGroupMembersTable)
    .innerJoin(rankGroupsTable, eq(rankGroupMembersTable.groupId, rankGroupsTable.id))
    .where(eq(rankGroupMembersTable.userId, userId))
    .orderBy(desc(rankGroupsTable.createdAt));

  const result = await Promise.all(myGroups.map(({ group }) => buildGroupResponse(group)));
  res.json(result);
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const createdBy = req.session.userId!;
  const { name, memberIds } = req.body ?? {};

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Group name is required" });
    return;
  }

  const requestedIds = Array.isArray(memberIds)
    ? memberIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  const allMemberIds = Array.from(new Set([createdBy, ...requestedIds]));

  const users = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, allMemberIds));
  if (users.length !== allMemberIds.length) {
    res.status(400).json({ error: "One or more users not found" });
    return;
  }

  const [group] = await db
    .insert(rankGroupsTable)
    .values({ name: name.trim(), createdBy })
    .returning();

  await db
    .insert(rankGroupMembersTable)
    .values(allMemberIds.map((uid) => ({ groupId: group.id, userId: uid })));

  res.status(201).json(await buildGroupResponse(group));
});

router.get("/:groupId", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseIdParam(req.params.groupId);
  if (!groupId) {
    res.status(400).json({ error: "Invalid group ID" });
    return;
  }

  const userId = req.session.userId!;
  if (!(await isMember(groupId, userId))) {
    res.status(403).json({ error: "You are not a member of this private rank" });
    return;
  }

  const [group] = await db
    .select()
    .from(rankGroupsTable)
    .where(eq(rankGroupsTable.id, groupId))
    .limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  res.json(await buildGroupResponse(group));
});

router.get("/:groupId/rankings", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseIdParam(req.params.groupId);
  if (!groupId) {
    res.status(400).json({ error: "Invalid group ID" });
    return;
  }

  const userId = req.session.userId!;
  if (!(await isMember(groupId, userId))) {
    res.status(403).json({ error: "You are not a member of this private rank" });
    return;
  }

  const memberIds = await getGroupMemberIds(groupId);
  const [fifa, pes] = await Promise.all([
    computeGroupRankings(memberIds, "fifa"),
    computeGroupRankings(memberIds, "pes"),
  ]);

  res.json({ fifa, pes });
});

router.post("/:groupId/leave", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseIdParam(req.params.groupId);
  if (!groupId) {
    res.status(400).json({ error: "Invalid group ID" });
    return;
  }

  const userId = req.session.userId!;

  await db
    .delete(rankGroupMembersTable)
    .where(
      and(
        eq(rankGroupMembersTable.groupId, groupId),
        eq(rankGroupMembersTable.userId, userId),
      ),
    );

  // Delete the group if it has no members left.
  const [{ remaining }] = await db
    .select({ remaining: count() })
    .from(rankGroupMembersTable)
    .where(eq(rankGroupMembersTable.groupId, groupId));

  if (remaining === 0) {
    await db.delete(rankGroupsTable).where(eq(rankGroupsTable.id, groupId));
  }

  res.json({ success: true, message: "Left the private rank" });
});

export default router;
