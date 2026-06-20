import { Router, Request, Response } from "express";
import {
  db,
  usersTable,
  matchPlayersTable,
  matchesTable,
  followsTable,
  closeFriendsTable,
  rankGroupsTable,
  rankGroupMembersTable,
} from "@workspace/db";
import { eq, ilike, and, inArray, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { parseIdParam } from "../lib/http";
import { deriveMatchPlayerStats } from "./matchHelpers";
import { computeGroupRankings, getGroupMemberIds } from "./groups";

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

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const rawSearch = typeof req.query.search === "string" ? req.query.search.trim() : "";
  // Escape LIKE metacharacters so a literal % or _ in the query is matched as
  // text rather than treated as a wildcard.
  const escaped = rawSearch.replace(/[\\%_]/g, "\\$&");

  const users = rawSearch
    ? await db
        .select()
        .from(usersTable)
        .where(ilike(usersTable.username, `%${escaped}%`))
        .limit(20)
    : await db.select().from(usersTable).limit(100);

  res.json(users.map(safeUser));
});

// Mutual follows ("friends"): users the current user follows who also follow back.
// Declared before /:userId so "friends" isn't parsed as a user id.
router.get("/friends", requireAuth, async (req: Request, res: Response) => {
  const me = req.session.userId!;

  const following = await db
    .select({ id: followsTable.followingId })
    .from(followsTable)
    .where(eq(followsTable.followerId, me));
  const followingIds = following.map((f) => f.id);
  if (followingIds.length === 0) {
    res.json([]);
    return;
  }

  const back = await db
    .select({ id: followsTable.followerId })
    .from(followsTable)
    .where(
      and(
        eq(followsTable.followingId, me),
        inArray(followsTable.followerId, followingIds),
      ),
    );
  const mutualIds = back.map((b) => b.id);
  if (mutualIds.length === 0) {
    res.json([]);
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, mutualIds));

  res.json(users.map(safeUser));
});

// Users the current user has marked as close friends.
// Declared before /:userId so "close-friends" isn't parsed as a user id.
router.get("/close-friends", requireAuth, async (req: Request, res: Response) => {
  const me = req.session.userId!;
  const rows = await db
    .select({ user: usersTable })
    .from(closeFriendsTable)
    .innerJoin(usersTable, eq(closeFriendsTable.closeFriendId, usersTable.id))
    .where(eq(closeFriendsTable.userId, me));

  res.json(rows.map((r) => safeUser(r.user)));
});

router.get("/:userId", requireAuth, async (req: Request, res: Response) => {
  const userId = parseIdParam(req.params.userId);
  if (!userId) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Get all match player records for this user (only non-spectators from completed matches)
  const playerRecords = await db
    .select({
      mp: matchPlayersTable,
      m: matchesTable,
    })
    .from(matchPlayersTable)
    .innerJoin(matchesTable, eq(matchPlayersTable.matchId, matchesTable.id))
    .where(
      and(
        eq(matchPlayersTable.userId, userId),
        eq(matchPlayersTable.isSpectator, 0),
        eq(matchesTable.status, "completed"),
      ),
    );

  // Overall stats
  let totalMatches = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let totalGoalsFor = 0;
  let totalGoalsAgainst = 0;
  let totalPoints = 0;

  // Game-specific stats
  const gameStats: Record<string, any> = {
    fifa: { matches: 0, wins: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
    pes: { matches: 0, wins: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
  };

  for (const { mp, m } of playerRecords) {
    const derived = deriveMatchPlayerStats(m, mp);

    totalMatches++;
    totalGoalsFor += derived.goalsFor;
    totalGoalsAgainst += derived.goalsAgainst;
    totalPoints += derived.points;

    if (derived.result === "win") totalWins++;
    else if (derived.result === "loss") totalLosses++;

    const game = m.game;
    if (game === "fifa" || game === "pes") {
      gameStats[game].matches++;
      gameStats[game].goalsFor += derived.goalsFor;
      gameStats[game].goalsAgainst += derived.goalsAgainst;
      gameStats[game].points += derived.points;
      if (derived.result === "win") gameStats[game].wins++;
      else if (derived.result === "loss") gameStats[game].losses++;
    }
  }

  const goalDiff = totalGoalsFor - totalGoalsAgainst;
  const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

  const toGameStats = (g: any) => ({
    matches: g.matches,
    wins: g.wins,
    losses: g.losses,
    goalsFor: g.goalsFor,
    goalsAgainst: g.goalsAgainst,
    goalDifference: g.goalsFor - g.goalsAgainst,
    points: g.points,
    winRate: g.matches > 0 ? Math.round((g.wins / g.matches) * 100) : 0,
  });

  // Follow metadata
  const [followerRow] = await db
    .select({ count: count() })
    .from(followsTable)
    .where(eq(followsTable.followingId, userId));
  const [followingRow] = await db
    .select({ count: count() })
    .from(followsTable)
    .where(eq(followsTable.followerId, userId));

  const me = req.session.userId;
  let isFollowing = false;
  if (me && me !== userId) {
    const [f] = await db
      .select()
      .from(followsTable)
      .where(
        and(
          eq(followsTable.followerId, me),
          eq(followsTable.followingId, userId),
        ),
      )
      .limit(1);
    isFollowing = !!f;
  }

  let isCloseFriend = false;
  if (me && me !== userId) {
    const [cf] = await db
      .select()
      .from(closeFriendsTable)
      .where(
        and(
          eq(closeFriendsTable.userId, me),
          eq(closeFriendsTable.closeFriendId, userId),
        ),
      )
      .limit(1);
    isCloseFriend = !!cf;
  }

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
    followerCount: followerRow.count,
    followingCount: followingRow.count,
    isFollowing,
    isCloseFriend,
    stats: {
      totalMatches,
      totalWins,
      totalLosses,
      totalGoalsFor,
      totalGoalsAgainst,
      goalDifference: goalDiff,
      totalPoints,
      winRate,
      fifaStats: toGameStats(gameStats.fifa),
      pesStats: toGameStats(gameStats.pes),
    },
  });
});

router.get("/:userId/matches", requireAuth, async (req: Request, res: Response) => {
  const userId = parseIdParam(req.params.userId);
  if (!userId) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const game = req.query.game as string | undefined;
  const matchFormat = req.query.matchFormat as string | undefined;

  // Get match IDs for this user
  const playerMatchIds = await db
    .select({ matchId: matchPlayersTable.matchId })
    .from(matchPlayersTable)
    .where(eq(matchPlayersTable.userId, userId));

  const matchIds = playerMatchIds.map((p) => p.matchId);
  if (matchIds.length === 0) {
    res.json([]);
    return;
  }

  const { buildMatchesWithPlayers } = await import("./matchHelpers");
  const matches = await buildMatchesWithPlayers({ matchIds, game, matchFormat });
  res.json(matches);
});

router.post("/:userId/follow", requireAuth, async (req: Request, res: Response) => {
  const targetId = parseIdParam(req.params.userId);
  if (!targetId) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const me = req.session.userId!;
  if (targetId === me) {
    res.status(400).json({ error: "You cannot follow yourself" });
    return;
  }

  const [target] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, targetId))
    .limit(1);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db
    .insert(followsTable)
    .values({ followerId: me, followingId: targetId })
    .onConflictDoNothing();

  res.json({ success: true, message: "Followed" });
});

router.delete("/:userId/follow", requireAuth, async (req: Request, res: Response) => {
  const targetId = parseIdParam(req.params.userId);
  if (!targetId) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const me = req.session.userId!;
  await db
    .delete(followsTable)
    .where(
      and(
        eq(followsTable.followerId, me),
        eq(followsTable.followingId, targetId),
      ),
    );

  res.json({ success: true, message: "Unfollowed" });
});

router.post("/:userId/close-friend", requireAuth, async (req: Request, res: Response) => {
  const targetId = parseIdParam(req.params.userId);
  if (!targetId) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const me = req.session.userId!;
  if (targetId === me) {
    res.status(400).json({ error: "You cannot add yourself as a close friend" });
    return;
  }

  const [target] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, targetId))
    .limit(1);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db
    .insert(closeFriendsTable)
    .values({ userId: me, closeFriendId: targetId })
    .onConflictDoNothing();

  res.json({ success: true, message: "Close friend added" });
});

router.delete("/:userId/close-friend", requireAuth, async (req: Request, res: Response) => {
  const targetId = parseIdParam(req.params.userId);
  if (!targetId) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const me = req.session.userId!;
  await db
    .delete(closeFriendsTable)
    .where(
      and(
        eq(closeFriendsTable.userId, me),
        eq(closeFriendsTable.closeFriendId, targetId),
      ),
    );

  res.json({ success: true, message: "Close friend removed" });
});

router.get("/:userId/followers", requireAuth, async (req: Request, res: Response) => {
  const userId = parseIdParam(req.params.userId);
  if (!userId) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const rows = await db
    .select({ user: usersTable })
    .from(followsTable)
    .innerJoin(usersTable, eq(followsTable.followerId, usersTable.id))
    .where(eq(followsTable.followingId, userId));

  res.json(rows.map((r) => safeUser(r.user)));
});

router.get("/:userId/following", requireAuth, async (req: Request, res: Response) => {
  const userId = parseIdParam(req.params.userId);
  if (!userId) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const rows = await db
    .select({ user: usersTable })
    .from(followsTable)
    .innerJoin(usersTable, eq(followsTable.followingId, usersTable.id))
    .where(eq(followsTable.followerId, userId));

  res.json(rows.map((r) => safeUser(r.user)));
});

router.get("/:userId/groups", requireAuth, async (req: Request, res: Response) => {
  const userId = parseIdParam(req.params.userId);
  if (!userId) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  // The profile owner sees all their ranks (with a hide/show flag); other
  // viewers only see the ranks the owner has chosen to keep visible.
  const isOwner = req.session.userId === userId;

  const groups = await db
    .select({ group: rankGroupsTable, hidden: rankGroupMembersTable.hiddenOnProfile })
    .from(rankGroupMembersTable)
    .innerJoin(rankGroupsTable, eq(rankGroupMembersTable.groupId, rankGroupsTable.id))
    .where(
      and(
        eq(rankGroupMembersTable.userId, userId),
        eq(rankGroupsTable.status, "active"),
      ),
    );

  const result = [];
  for (const { group, hidden } of groups) {
    if (!isOwner && hidden) continue;
    const memberIds = await getGroupMemberIds(group.id);
    const ranking = await computeGroupRankings(memberIds, undefined, group.createdAt);
    const idx = ranking.findIndex((e) => e.userId === userId);
    result.push({
      id: group.id,
      name: group.name,
      memberCount: memberIds.length,
      position: idx >= 0 ? idx + 1 : 0, // 0 = unranked (no qualifying matches yet)
      hiddenOnProfile: hidden,
    });
  }

  res.json(result);
});

export default router;
