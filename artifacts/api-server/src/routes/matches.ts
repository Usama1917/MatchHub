import { Router, Request, Response } from "express";
import {
  db,
  matchesTable,
  matchPlayersTable,
  partiesTable,
  partyMembersTable,
  usersTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { buildMatchesWithPlayers } from "./matchHelpers";
import { parseIdParam } from "../lib/http";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const game = req.query.game as string | undefined;
  const matchFormat = req.query.matchFormat as string | undefined;
  const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
  const winType = req.query.winType as string | undefined;

  const matches = await buildMatchesWithPlayers({ game, matchFormat, userId, winType });
  res.json(matches);
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { partyId, teamA, teamB } = req.body;
  const createdBy = req.session.userId!;

  if (!partyId || !Array.isArray(teamA) || !Array.isArray(teamB)) {
    res.status(400).json({ error: "partyId, teamA, and teamB are required" });
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

  // Validate team sizes match format
  const formatSizes: Record<string, number> = { "1v1": 1, "2v2": 2, "3v3": 3 };
  const required = formatSizes[party.matchFormat];
  if (teamAIds.length !== required || teamBIds.length !== required) {
    res
      .status(400)
      .json({ error: `Each team must have exactly ${required} player(s) for ${party.matchFormat}` });
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

  // Create match
  const [match] = await db
    .insert(matchesTable)
    .values({
      partyId,
      game: party.game,
      matchFormat: party.matchFormat,
      status: "in_progress",
      createdBy,
      startedAt: new Date(),
    })
    .returning();

  // Insert match players
  const matchPlayerValues = [];

  for (const userId of teamAIds) {
    matchPlayerValues.push({ matchId: match.id, userId, team: "team_a" as const, isSpectator: 0 });
  }
  for (const userId of teamBIds) {
    matchPlayerValues.push({ matchId: match.id, userId, team: "team_b" as const, isSpectator: 0 });
  }
  // Spectators: party members not in active players
  for (const userId of partyMemberIds) {
    if (!activePlayers.includes(userId)) {
      matchPlayerValues.push({ matchId: match.id, userId, team: null, isSpectator: 1 });
    }
  }

  if (matchPlayerValues.length > 0) {
    await db.insert(matchPlayersTable).values(matchPlayerValues as any);
  }

  // Update party status
  await db
    .update(partiesTable)
    .set({ status: "in_progress" })
    .where(eq(partiesTable.id, partyId));

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

  if (teamAScore === undefined || teamBScore === undefined) {
    res.status(400).json({ error: "Scores are required" });
    return;
  }
  if (teamAScore < 0 || teamBScore < 0) {
    res.status(400).json({ error: "Scores cannot be negative" });
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

  const currentUserId = req.session.userId!;
  const canSubmitResult =
    match.createdBy === currentUserId ||
    players.some((player) => player.userId === currentUserId);

  if (!canSubmitResult) {
    res.status(403).json({ error: "You can only submit results for your own matches" });
    return;
  }

  const teamAPlayers = players.filter((p) => p.team === "team_a");
  const teamBPlayers = players.filter((p) => p.team === "team_b");

  // Calculate points based on format
  const format = match.matchFormat;
  const winnerPoints = format === "1v1" ? 3 : 2;
  const loserPoints = 0;

  // Update each player's stats
  for (const player of teamAPlayers) {
    const isWinner = winnerTeam === "team_a";
    await db
      .update(matchPlayersTable)
      .set({
        result: isWinner ? "win" : "loss",
        points: isWinner ? winnerPoints : loserPoints,
        goalsFor: teamAScore,
        goalsAgainst: teamBScore,
      })
      .where(eq(matchPlayersTable.id, player.id));
  }

  for (const player of teamBPlayers) {
    const isWinner = winnerTeam === "team_b";
    await db
      .update(matchPlayersTable)
      .set({
        result: isWinner ? "win" : "loss",
        points: isWinner ? winnerPoints : loserPoints,
        goalsFor: teamBScore,
        goalsAgainst: teamAScore,
      })
      .where(eq(matchPlayersTable.id, player.id));
  }

  // Update match
  await db
    .update(matchesTable)
    .set({
      teamAScore,
      teamBScore,
      winnerTeam,
      winType,
      status: "completed",
      finishedAt: new Date(),
    })
    .where(eq(matchesTable.id, matchId));

  // Update party status
  await db
    .update(partiesTable)
    .set({ status: "completed" })
    .where(eq(partiesTable.id, match.partyId));

  const results = await buildMatchesWithPlayers({ matchIds: [matchId] });
  res.json(results[0]);
});

export default router;
