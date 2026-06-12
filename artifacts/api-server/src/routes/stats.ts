import { Router, Request, Response } from "express";
import { db, matchesTable, usersTable, partiesTable } from "@workspace/db";
import { eq, sql, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { buildMatchesWithPlayers } from "./matchHelpers";
import { computeRankings } from "./rankings";

const router = Router();

router.get("/dashboard", requireAuth, async (req: Request, res: Response) => {
  const [totalMatchesRow] = await db.select({ count: count() }).from(matchesTable);
  const [totalUsersRow] = await db.select({ count: count() }).from(usersTable);
  const [totalPartiesRow] = await db.select({ count: count() }).from(partiesTable);

  const [fifaRow] = await db
    .select({ count: count() })
    .from(matchesTable)
    .where(eq(matchesTable.game, "fifa"));
  const [pesRow] = await db
    .select({ count: count() })
    .from(matchesTable)
    .where(eq(matchesTable.game, "pes"));

  const recentMatches = await buildMatchesWithPlayers({});
  const topPlayers = await computeRankings();

  res.json({
    totalMatches: totalMatchesRow.count,
    totalUsers: totalUsersRow.count,
    totalParties: totalPartiesRow.count,
    fifaMatches: fifaRow.count,
    pesMatches: pesRow.count,
    recentMatches: recentMatches.slice(0, 5),
    topPlayers: topPlayers.slice(0, 5),
  });
});

export default router;
