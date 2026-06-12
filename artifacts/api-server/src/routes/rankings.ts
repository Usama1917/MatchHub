import { Router, Request, Response } from "express";
import { db, matchPlayersTable, matchesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { deriveMatchPlayerStats } from "./matchHelpers";

const router = Router();

async function computeRankings(game?: "fifa" | "pes") {
  // Get all active (non-spectator) players from completed matches
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
    .where(
      and(
        eq(matchPlayersTable.isSpectator, 0),
        eq(matchesTable.status, "completed"),
        game ? eq(matchesTable.game, game) : undefined,
      ),
    );

  // Aggregate by user
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

  // Sort: points desc, wins desc, goal diff desc, goals for desc, fewer matches asc
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

router.get("/fifa", requireAuth, async (req: Request, res: Response) => {
  const rankings = await computeRankings("fifa");
  res.json(rankings);
});

router.get("/pes", requireAuth, async (req: Request, res: Response) => {
  const rankings = await computeRankings("pes");
  res.json(rankings);
});

router.get("/overall", requireAuth, async (req: Request, res: Response) => {
  const rankings = await computeRankings();
  res.json(rankings);
});

export { computeRankings };
export default router;
