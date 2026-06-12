import { Router, Request, Response } from "express";
import { db, usersTable, matchPlayersTable, matchesTable } from "@workspace/db";
import { eq, ilike, and } from "drizzle-orm";
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

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;

  const users = search
    ? await db
        .select()
        .from(usersTable)
        .where(ilike(usersTable.username, `%${search}%`))
        .limit(20)
    : await db.select().from(usersTable).limit(100);

  res.json(users.map(safeUser));
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

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
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

export default router;
