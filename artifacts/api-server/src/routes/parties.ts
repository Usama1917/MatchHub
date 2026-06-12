import { Router, Request, Response } from "express";
import { db, partiesTable, partyMembersTable, usersTable } from "@workspace/db";
import { eq, inArray, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

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

async function buildPartyResponse(party: any) {
  const members = await db
    .select({ pm: partyMembersTable, user: usersTable })
    .from(partyMembersTable)
    .innerJoin(usersTable, eq(partyMembersTable.userId, usersTable.id))
    .where(eq(partyMembersTable.partyId, party.id));

  const [creator] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, party.createdBy))
    .limit(1);

  return {
    id: party.id,
    createdBy: party.createdBy,
    game: party.game,
    matchFormat: party.matchFormat,
    status: party.status,
    createdAt: party.createdAt,
    members: members.map(({ user }) => safeUser(user)),
    creator: creator ? safeUser(creator) : null,
  };
}

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const parties = await db
    .select()
    .from(partiesTable)
    .orderBy(desc(partiesTable.createdAt))
    .limit(50);

  const result = await Promise.all(parties.map(buildPartyResponse));
  res.json(result);
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { memberIds, game, matchFormat } = req.body;
  const createdBy = req.session.userId!;

  if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 2) {
    res.status(400).json({ error: "At least 2 members required" });
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

  // Ensure creator is included
  const allMemberIds = Array.from(new Set([createdBy, ...memberIds.map(Number)]));

  // Verify all users exist
  const users = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, allMemberIds));

  if (users.length !== allMemberIds.length) {
    res.status(400).json({ error: "One or more users not found" });
    return;
  }

  const [party] = await db
    .insert(partiesTable)
    .values({ createdBy, game, matchFormat, status: "pending" })
    .returning();

  await db.insert(partyMembersTable).values(
    allMemberIds.map((userId) => ({ partyId: party.id, userId })),
  );

  res.status(201).json(await buildPartyResponse(party));
});

router.get("/:partyId", requireAuth, async (req: Request, res: Response) => {
  const partyId = parseInt(req.params.partyId);
  if (isNaN(partyId)) {
    res.status(400).json({ error: "Invalid party ID" });
    return;
  }

  const [party] = await db
    .select()
    .from(partiesTable)
    .where(eq(partiesTable.id, partyId))
    .limit(1);

  if (!party) {
    res.status(404).json({ error: "Party not found" });
    return;
  }

  res.json(await buildPartyResponse(party));
});

export default router;
