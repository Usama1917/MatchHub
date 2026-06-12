import { db, matchesTable, matchPlayersTable, usersTable, partiesTable } from "@workspace/db";
import { eq, inArray, and, desc } from "drizzle-orm";

function safeUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
  };
}

interface MatchFilters {
  matchIds?: number[];
  game?: string;
  matchFormat?: string;
  winType?: string;
  userId?: number;
}

export async function buildMatchesWithPlayers(filters: MatchFilters = {}) {
  let query = db
    .select()
    .from(matchesTable)
    .orderBy(desc(matchesTable.createdAt));

  const conditions: any[] = [];

  if (filters.matchIds && filters.matchIds.length > 0) {
    conditions.push(inArray(matchesTable.id, filters.matchIds));
  }
  if (filters.game) {
    conditions.push(eq(matchesTable.game, filters.game as any));
  }
  if (filters.matchFormat) {
    conditions.push(eq(matchesTable.matchFormat, filters.matchFormat as any));
  }
  if (filters.winType) {
    conditions.push(eq(matchesTable.winType, filters.winType as any));
  }

  const matches =
    conditions.length > 0
      ? await db
          .select()
          .from(matchesTable)
          .where(and(...conditions))
          .orderBy(desc(matchesTable.createdAt))
      : await db.select().from(matchesTable).orderBy(desc(matchesTable.createdAt));

  if (matches.length === 0) return [];

  const matchIds = matches.map((m) => m.id);

  // Get all players for these matches
  const players = await db
    .select({
      mp: matchPlayersTable,
      user: usersTable,
    })
    .from(matchPlayersTable)
    .innerJoin(usersTable, eq(matchPlayersTable.userId, usersTable.id))
    .where(inArray(matchPlayersTable.matchId, matchIds));

  // Get all creators
  const creatorIds = [...new Set(matches.map((m) => m.createdBy))];
  const creators = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, creatorIds));

  const creatorMap = new Map(creators.map((c) => [c.id, c]));

  const playersByMatch = new Map<number, any[]>();
  for (const { mp, user } of players) {
    if (!playersByMatch.has(mp.matchId)) playersByMatch.set(mp.matchId, []);
    playersByMatch.get(mp.matchId)!.push({
      id: mp.id,
      matchId: mp.matchId,
      userId: mp.userId,
      team: mp.team,
      isSpectator: mp.isSpectator === 1,
      result: mp.result,
      points: mp.points,
      goalsFor: mp.goalsFor,
      goalsAgainst: mp.goalsAgainst,
      user: safeUser(user),
    });
  }

  // If filtering by userId, only return matches where user participated
  let filteredMatches = matches;
  if (filters.userId) {
    filteredMatches = matches.filter((m) => {
      const matchPlayers = playersByMatch.get(m.id) || [];
      return matchPlayers.some((p: any) => p.userId === filters.userId);
    });
  }

  return filteredMatches.map((m) => ({
    id: m.id,
    partyId: m.partyId,
    game: m.game,
    matchFormat: m.matchFormat,
    teamAScore: m.teamAScore,
    teamBScore: m.teamBScore,
    winnerTeam: m.winnerTeam,
    winType: m.winType,
    status: m.status,
    createdBy: m.createdBy,
    startedAt: m.startedAt,
    finishedAt: m.finishedAt,
    createdAt: m.createdAt,
    players: playersByMatch.get(m.id) || [],
    creator: m.createdBy ? safeUser(creatorMap.get(m.createdBy)) : null,
  }));
}
