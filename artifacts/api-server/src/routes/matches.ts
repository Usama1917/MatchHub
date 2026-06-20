import { Router, Request, Response } from "express";
import {
  db,
  matchesTable,
  matchPlayersTable,
  partiesTable,
  partyMembersTable,
  usersTable,
} from "@workspace/db";
import { eq, and, ne, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { buildMatchesWithPlayers } from "./matchHelpers";
import { usersInActiveParty } from "./parties";
import { parseIdParam } from "../lib/http";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const game = req.query.game as string | undefined;
  const matchFormat = req.query.matchFormat as string | undefined;
  const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
  const winType = req.query.winType as string | undefined;
  const partyId = req.query.partyId ? parseInt(req.query.partyId as string) : undefined;

  const matches = await buildMatchesWithPlayers({ game, matchFormat, userId, winType, partyId });
  res.json(matches);
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { partyId, game, matchFormat, teamA, teamB } = req.body;
  const createdBy = req.session.userId!;

  if (!partyId || !Array.isArray(teamA) || !Array.isArray(teamB)) {
    res.status(400).json({ error: "partyId, teamA, and teamB are required" });
    return;
  }
  if (!game || !["fifa", "pes"].includes(game)) {
    res.status(400).json({ error: "Game must be fifa or pes" });
    return;
  }
  if (!matchFormat || !["1v1", "2v2", "3v3"].includes(matchFormat)) {
    res.status(400).json({ error: "Match format must be 1v1, 2v2, or 3v3" });
    return;
  }

  const teamAIds = teamA.map(Number);
  const teamBIds = teamB.map(Number);

  // Validate no overlap
  const overlap = teamAIds.filter((id: number) => teamBIds.includes(id));
  if (overlap.length > 0) {
    res.status(400).json({ error: "Players cannot be on both teams" });
    return;
  }

  // Get party
  const [party] = await db
    .select()
    .from(partiesTable)
    .where(eq(partiesTable.id, partyId))
    .limit(1);

  if (!party) {
    res.status(400).json({ error: "Party not found" });
    return;
  }

  // Validate team sizes match the chosen format
  const formatSizes: Record<string, number> = { "1v1": 1, "2v2": 2, "3v3": 3 };
  const required = formatSizes[matchFormat];
  if (teamAIds.length !== required || teamBIds.length !== required) {
    res
      .status(400)
      .json({ error: `Each team must have exactly ${required} player(s) for ${matchFormat}` });
    return;
  }

  // Get all party members
  const partyMembers = await db
    .select()
    .from(partyMembersTable)
    .where(eq(partyMembersTable.partyId, partyId));
  const partyMemberIds = partyMembers.map((pm) => pm.userId);

  // All active players must be party members
  const activePlayers = [...teamAIds, ...teamBIds];
  const nonMembers = activePlayers.filter((id: number) => !partyMemberIds.includes(id));
  if (nonMembers.length > 0) {
    res.status(400).json({ error: "All players must be party members" });
    return;
  }

  // Guard the one-active-party rule: no active player may belong to a different
  // active party (e.g. they joined another room since this party last played).
  const busy = await usersInActiveParty(activePlayers, partyId);
  if (busy.length > 0) {
    res.status(409).json({
      error: "One or more players are already in another active party",
    });
    return;
  }

  // Create the match, its player rows, and flip the party to in_progress as a
  // single atomic unit so a mid-way failure cannot leave orphaned state.
  const match = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(matchesTable)
      .values({
        partyId,
        game,
        matchFormat,
        status: "in_progress",
        createdBy,
        startedAt: new Date(),
      })
      .returning();

    const matchPlayerValues = [];
    for (const userId of teamAIds) {
      matchPlayerValues.push({ matchId: created.id, userId, team: "team_a" as const, isSpectator: 0 });
    }
    for (const userId of teamBIds) {
      matchPlayerValues.push({ matchId: created.id, userId, team: "team_b" as const, isSpectator: 0 });
    }
    // Spectators: party members not in active players
    for (const userId of partyMemberIds) {
      if (!activePlayers.includes(userId)) {
        matchPlayerValues.push({ matchId: created.id, userId, team: null, isSpectator: 1 });
      }
    }

    if (matchPlayerValues.length > 0) {
      await tx.insert(matchPlayersTable).values(matchPlayerValues as any);
    }

    await tx
      .update(partiesTable)
      .set({ status: "in_progress" })
      .where(eq(partiesTable.id, partyId));

    return created;
  });

  const results = await buildMatchesWithPlayers({ matchIds: [match.id] });
  res.status(201).json(results[0]);
});

router.get("/:matchId", requireAuth, async (req: Request, res: Response) => {
  const matchId = parseIdParam(req.params.matchId);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID" });
    return;
  }

  const results = await buildMatchesWithPlayers({ matchIds: [matchId] });
  if (results.length === 0) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  res.json(results[0]);
});

router.post("/:matchId/result", requireAuth, async (req: Request, res: Response) => {
  const matchId = parseIdParam(req.params.matchId);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID" });
    return;
  }

  const { teamAScore, teamBScore, winnerTeam, winType } = req.body;

  const scoreA = Number(teamAScore);
  const scoreB = Number(teamBScore);
  if (
    teamAScore === undefined ||
    teamBScore === undefined ||
    teamAScore === null ||
    teamBScore === null ||
    teamAScore === "" ||
    teamBScore === "" ||
    !Number.isInteger(scoreA) ||
    !Number.isInteger(scoreB) ||
    scoreA < 0 ||
    scoreB < 0
  ) {
    res.status(400).json({ error: "Scores must be non-negative integers" });
    return;
  }
  if (!winnerTeam || !["team_a", "team_b"].includes(winnerTeam)) {
    res.status(400).json({ error: "Winner team must be team_a or team_b" });
    return;
  }
  if (!winType || !["normal", "penalties", "golden_goal"].includes(winType)) {
    res.status(400).json({ error: "Invalid win type" });
    return;
  }
  // The recorded winner must be consistent with the score. A draw is only
  // valid when decided by a tiebreaker (penalties / golden goal).
  if (scoreA !== scoreB) {
    const higher = scoreA > scoreB ? "team_a" : "team_b";
    if (winnerTeam !== higher) {
      res
        .status(400)
        .json({ error: "Winner must be the team with the higher score" });
      return;
    }
  } else if (winType === "normal") {
    res.status(400).json({
      error: "A draw requires a tiebreaker win type (penalties or golden goal)",
    });
    return;
  }

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId))
    .limit(1);

  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  if (match.status === "completed") {
    res.status(400).json({ error: "Match result already submitted" });
    return;
  }

  // Get active players
  const players = await db
    .select()
    .from(matchPlayersTable)
    .where(and(eq(matchPlayersTable.matchId, matchId), eq(matchPlayersTable.isSpectator, 0)));

  // Only the party creator or the match creator may submit the result.
  const [party] = await db
    .select()
    .from(partiesTable)
    .where(eq(partiesTable.id, match.partyId))
    .limit(1);

  const currentUserId = req.session.userId!;
  const canSubmitResult =
    match.createdBy === currentUserId || party?.createdBy === currentUserId;

  if (!canSubmitResult) {
    res
      .status(403)
      .json({ error: "Only the party or match creator can submit the result" });
    return;
  }

  const teamAPlayers = players.filter((p) => p.team === "team_a");
  const teamBPlayers = players.filter((p) => p.team === "team_b");

  // Calculate points based on format
  const format = match.matchFormat;
  const winnerPoints = format === "1v1" ? 3 : 2;
  const loserPoints = 0;

  // Apply all writes atomically. The match update is a compare-and-swap on
  // status, so two concurrent submissions cannot both complete the match.
  let alreadyCompleted = false;
  await db.transaction(async (tx) => {
    const completed = await tx
      .update(matchesTable)
      .set({
        teamAScore: scoreA,
        teamBScore: scoreB,
        winnerTeam,
        winType,
        status: "completed",
        finishedAt: new Date(),
      })
      .where(
        and(eq(matchesTable.id, matchId), ne(matchesTable.status, "completed")),
      )
      .returning({ id: matchesTable.id });

    if (completed.length === 0) {
      alreadyCompleted = true;
      return;
    }

    for (const player of teamAPlayers) {
      const isWinner = winnerTeam === "team_a";
      await tx
        .update(matchPlayersTable)
        .set({
          result: isWinner ? "win" : "loss",
          points: isWinner ? winnerPoints : loserPoints,
          goalsFor: scoreA,
          goalsAgainst: scoreB,
        })
        .where(eq(matchPlayersTable.id, player.id));
    }

    for (const player of teamBPlayers) {
      const isWinner = winnerTeam === "team_b";
      await tx
        .update(matchPlayersTable)
        .set({
          result: isWinner ? "win" : "loss",
          points: isWinner ? winnerPoints : loserPoints,
          goalsFor: scoreB,
          goalsAgainst: scoreA,
        })
        .where(eq(matchPlayersTable.id, player.id));
    }

    // The party stays open (in_progress) after a match finishes so the creator
    // can start more matches or close it explicitly. Submitting a result must
    // not auto-close the whole party.
  });

  if (alreadyCompleted) {
    res.status(400).json({ error: "Match result already submitted" });
    return;
  }

  const results = await buildMatchesWithPlayers({ matchIds: [matchId] });
  res.json(results[0]);
});

// Cancel (delete) a match that has not been completed. Used when closing a
// party that still has a match in progress. match_players cascade on delete.
router.delete("/:matchId", requireAuth, async (req: Request, res: Response) => {
  const matchId = parseIdParam(req.params.matchId);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID" });
    return;
  }

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId))
    .limit(1);

  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  if (match.status === "completed") {
    res.status(400).json({ error: "Cannot cancel a completed match" });
    return;
  }

  const [party] = await db
    .select()
    .from(partiesTable)
    .where(eq(partiesTable.id, match.partyId))
    .limit(1);

  const me = req.session.userId!;
  if (match.createdBy !== me && party?.createdBy !== me) {
    res
      .status(403)
      .json({ error: "Only the party or match creator can cancel the match" });
    return;
  }

  await db.delete(matchesTable).where(eq(matchesTable.id, matchId));

  res.json({ success: true, message: "Match cancelled" });
});

export default router;
