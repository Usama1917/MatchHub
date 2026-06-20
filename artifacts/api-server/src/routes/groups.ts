import { Router, Request, Response } from "express";
import {
  db,
  rankGroupsTable,
  rankGroupMembersTable,
  matchPlayersTable,
  matchesTable,
  usersTable,
} from "@workspace/db";
import { eq, and, inArray, desc, count, gte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { parseIdParam } from "../lib/http";
import { deriveMatchPlayerStats, buildMatchesWithPlayers } from "./matchHelpers";
import { generatePartyCode } from "../lib/partyCode";

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

async function buildGroupResponse(group: any, viewerId?: number) {
  const members = await db
    .select({ user: usersTable })
    .from(rankGroupMembersTable)
    .innerJoin(usersTable, eq(rankGroupMembersTable.userId, usersTable.id))
    .where(eq(rankGroupMembersTable.groupId, group.id));

  const response: Record<string, unknown> = {
    id: group.id,
    name: group.name,
    createdBy: group.createdBy,
    status: group.status,
    createdAt: group.createdAt,
    endedAt: group.endedAt,
    members: members.map(({ user }) => safeUser(user)),
  };

  if (viewerId === group.createdBy) {
    response.code = group.code;
  }

  return response;
}

async function insertGroupWithUniqueCode(
  name: string,
  createdBy: number,
  executor: any = db,
) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generatePartyCode();
    try {
      const [group] = await executor
        .insert(rankGroupsTable)
        .values({ name, createdBy, code, status: "active" })
        .returning();
      return group;
    } catch (err: any) {
      if (err?.code === "23505" && attempt < 5) continue;
      throw err;
    }
  }
  throw new Error("Could not generate a unique private rank code");
}

// A completed match counts toward a group only when at least 2 of its active
// players are group members. Only member players' stats are aggregated.
// `since` restricts to matches played from the group's creation onward, so a
// private rank starts scoring from scratch (not the players' whole history).
export async function computeGroupRankings(
  memberIds: number[],
  game?: "fifa" | "pes",
  since?: Date,
) {
  if (memberIds.length === 0) return [];

  const conditions = [
    eq(matchPlayersTable.isSpectator, 0),
    eq(matchesTable.status, "completed"),
    inArray(matchPlayersTable.userId, memberIds),
  ];
  if (game) conditions.push(eq(matchesTable.game, game));
  if (since) conditions.push(gte(matchesTable.createdAt, since));

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
    .where(
      and(
        eq(rankGroupMembersTable.userId, userId),
        eq(rankGroupsTable.status, "active"),
      ),
    )
    .orderBy(desc(rankGroupsTable.createdAt));

  const result = await Promise.all(
    myGroups.map(({ group }) => buildGroupResponse(group, userId)),
  );
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

  // Create the group and seed its members atomically so a failed member insert
  // cannot leave behind an orphaned, member-less zombie group.
  const group = await db.transaction(async (tx) => {
    const created = await insertGroupWithUniqueCode(name.trim(), createdBy, tx);
    await tx
      .insert(rankGroupMembersTable)
      .values(allMemberIds.map((uid) => ({ groupId: created.id, userId: uid })));
    return created;
  });

  res.status(201).json(await buildGroupResponse(group, createdBy));
});

router.post("/join", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";

  if (!code) {
    res.status(400).json({ error: "Private rank code is required" });
    return;
  }

  const [group] = await db
    .select()
    .from(rankGroupsTable)
    .where(
      and(
        eq(rankGroupsTable.code, code),
        eq(rankGroupsTable.status, "active"),
      ),
    )
    .limit(1);

  if (!group) {
    res.status(404).json({ error: "Private rank not found" });
    return;
  }

  await db
    .insert(rankGroupMembersTable)
    .values({ groupId: group.id, userId })
    .onConflictDoNothing();

  res.json(await buildGroupResponse(group, userId));
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
    .where(
      and(
        eq(rankGroupsTable.id, groupId),
        eq(rankGroupsTable.status, "active"),
      ),
    )
    .limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  res.json(await buildGroupResponse(group, userId));
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

  const [group] = await db
    .select({ id: rankGroupsTable.id, createdAt: rankGroupsTable.createdAt })
    .from(rankGroupsTable)
    .where(
      and(
        eq(rankGroupsTable.id, groupId),
        eq(rankGroupsTable.status, "active"),
      ),
    )
    .limit(1);

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const memberIds = await getGroupMemberIds(groupId);
  const [fifa, pes] = await Promise.all([
    computeGroupRankings(memberIds, "fifa", group.createdAt),
    computeGroupRankings(memberIds, "pes", group.createdAt),
  ]);

  res.json({ fifa, pes });
});

// All matches that count toward this private rank: completed matches in which
// at least 2 of the group's members were active (non-spectator) players.
router.get("/:groupId/matches", requireAuth, async (req: Request, res: Response) => {
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
    .select({ createdAt: rankGroupsTable.createdAt })
    .from(rankGroupsTable)
    .where(eq(rankGroupsTable.id, groupId))
    .limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const memberIds = await getGroupMemberIds(groupId);
  if (memberIds.length === 0) {
    res.json([]);
    return;
  }

  const rows = await db
    .select({ matchId: matchPlayersTable.matchId })
    .from(matchPlayersTable)
    .innerJoin(matchesTable, eq(matchPlayersTable.matchId, matchesTable.id))
    .where(
      and(
        eq(matchPlayersTable.isSpectator, 0),
        eq(matchesTable.status, "completed"),
        inArray(matchPlayersTable.userId, memberIds),
        gte(matchesTable.createdAt, group.createdAt),
      ),
    );

  const memberCountPerMatch = new Map<number, number>();
  for (const r of rows) {
    memberCountPerMatch.set(
      r.matchId,
      (memberCountPerMatch.get(r.matchId) ?? 0) + 1,
    );
  }
  const matchIds = Array.from(memberCountPerMatch.entries())
    .filter(([, c]) => c >= 2)
    .map(([matchId]) => matchId);

  if (matchIds.length === 0) {
    res.json([]);
    return;
  }

  const matches = await buildMatchesWithPlayers({ matchIds });
  res.json(matches);
});

// Toggle whether this rank appears on the caller's own profile.
router.post("/:groupId/profile-visibility", requireAuth, async (req: Request, res: Response) => {
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

  const hidden = req.body?.hidden === true;
  await db
    .update(rankGroupMembersTable)
    .set({ hiddenOnProfile: hidden })
    .where(
      and(
        eq(rankGroupMembersTable.groupId, groupId),
        eq(rankGroupMembersTable.userId, userId),
      ),
    );

  res.json({
    success: true,
    message: hidden ? "Hidden from your profile" : "Shown on your profile",
  });
});

router.post("/:groupId/leave", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseIdParam(req.params.groupId);
  if (!groupId) {
    res.status(400).json({ error: "Invalid group ID" });
    return;
  }

  const userId = req.session.userId!;

  const [group] = await db
    .select()
    .from(rankGroupsTable)
    .where(eq(rankGroupsTable.id, groupId))
    .limit(1);

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  if (!(await isMember(groupId, userId))) {
    res
      .status(403)
      .json({ error: "You are not a member of this private rank" });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(rankGroupMembersTable)
      .where(
        and(
          eq(rankGroupMembersTable.groupId, groupId),
          eq(rankGroupMembersTable.userId, userId),
        ),
      );

    // Auto-delete only an *active* group once it becomes empty. Ended groups
    // are inert finished records and are left intact.
    if (group.status === "active") {
      const [{ remaining }] = await tx
        .select({ remaining: count() })
        .from(rankGroupMembersTable)
        .where(eq(rankGroupMembersTable.groupId, groupId));

      if (remaining === 0) {
        await tx.delete(rankGroupsTable).where(eq(rankGroupsTable.id, groupId));
      }
    }
  });

  res.json({ success: true, message: "Left the private rank" });
});

router.post("/:groupId/end", requireAuth, async (req: Request, res: Response) => {
  const groupId = parseIdParam(req.params.groupId);
  if (!groupId) {
    res.status(400).json({ error: "Invalid group ID" });
    return;
  }

  const userId = req.session.userId!;
  const [group] = await db
    .select()
    .from(rankGroupsTable)
    .where(eq(rankGroupsTable.id, groupId))
    .limit(1);

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  if (group.createdBy !== userId) {
    res.status(403).json({ error: "Only the private rank creator can end it" });
    return;
  }

  // Only an active rank can be ended; re-ending would overwrite the original
  // endedAt timestamp.
  if (group.status !== "active") {
    res.status(400).json({ error: "Private rank is not active" });
    return;
  }

  await db
    .update(rankGroupsTable)
    .set({ status: "ended", endedAt: new Date() })
    .where(eq(rankGroupsTable.id, groupId));

  res.json({ success: true, message: "Private rank ended" });
});

export default router;
