import { Router, Request, Response } from "express";
import {
  db,
  partiesTable,
  partyMembersTable,
  partyInvitationsTable,
  closeFriendsTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray, ne, desc, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { parseIdParam } from "../lib/http";
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

  const pending = await db
    .select({ user: usersTable })
    .from(partyInvitationsTable)
    .innerJoin(usersTable, eq(partyInvitationsTable.toUserId, usersTable.id))
    .where(
      and(
        eq(partyInvitationsTable.partyId, party.id),
        eq(partyInvitationsTable.status, "pending"),
      ),
    );

  return {
    id: party.id,
    createdBy: party.createdBy,
    code: party.code,
    status: party.status,
    createdAt: party.createdAt,
    members: members.map(({ user }) => safeUser(user)),
    creator: creator ? safeUser(creator) : null,
    pendingInvites: pending.map(({ user }) => safeUser(user)),
  };
}

// Returns the subset of userIds that are currently members of an active
// (pending/in_progress) party. A player can only be in one active party at a time.
async function usersInActiveParty(
  userIds: number[],
  excludePartyId?: number,
): Promise<number[]> {
  if (userIds.length === 0) return [];

  const conditions = [
    inArray(partyMembersTable.userId, userIds),
    ne(partiesTable.status, "completed"),
  ];
  if (excludePartyId) {
    conditions.push(ne(partiesTable.id, excludePartyId));
  }

  const rows = await db
    .select({ userId: partyMembersTable.userId })
    .from(partyMembersTable)
    .innerJoin(partiesTable, eq(partyMembersTable.partyId, partiesTable.id))
    .where(and(...conditions));

  return Array.from(new Set(rows.map((r) => r.userId)));
}

// Returns the subset of candidateIds who are MUTUAL close friends with userId
// (each has marked the other as a close friend).
async function mutualCloseFriendIds(
  userId: number,
  candidateIds: number[],
): Promise<number[]> {
  if (candidateIds.length === 0) return [];

  const iMarked = await db
    .select({ id: closeFriendsTable.closeFriendId })
    .from(closeFriendsTable)
    .where(
      and(
        eq(closeFriendsTable.userId, userId),
        inArray(closeFriendsTable.closeFriendId, candidateIds),
      ),
    );
  const iMarkedIds = iMarked.map((r) => r.id);
  if (iMarkedIds.length === 0) return [];

  const theyMarked = await db
    .select({ id: closeFriendsTable.userId })
    .from(closeFriendsTable)
    .where(
      and(
        eq(closeFriendsTable.closeFriendId, userId),
        inArray(closeFriendsTable.userId, iMarkedIds),
      ),
    );
  return theyMarked.map((r) => r.id);
}

async function insertPartyWithUniqueCode(createdBy: number) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generatePartyCode();
    try {
      const [party] = await db
        .insert(partiesTable)
        .values({ createdBy, code, status: "pending" })
        .returning();
      return party;
    } catch (err: any) {
      // 23505 = unique_violation (code collision); retry with a new code.
      if (err?.code === "23505" && attempt < 5) continue;
      throw err;
    }
  }
  throw new Error("Could not generate a unique party code");
}

// Admin-only: returns every party (including join codes). Regular members use
// /active, /lookup, and /:partyId for the parties they belong to.
router.get("/", requireAdmin, async (_req: Request, res: Response) => {
  const parties = await db
    .select()
    .from(partiesTable)
    .orderBy(desc(partiesTable.createdAt))
    .limit(50);

  const result = await Promise.all(parties.map(buildPartyResponse));
  res.json(result);
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const createdBy = req.session.userId!;
  const { memberIds } = req.body ?? {};

  const requestedIds = Array.isArray(memberIds)
    ? memberIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];

  // The creator is always a member. Extra members are optional (others can
  // join later with the party code).
  const allMemberIds = Array.from(new Set([createdBy, ...requestedIds]));

  const users = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, allMemberIds));

  if (users.length !== allMemberIds.length) {
    res.status(400).json({ error: "One or more users not found" });
    return;
  }

  // Only the creator must be free of another active party. Invited members are
  // not committed yet — their active-party rule is enforced when they accept.
  const creatorBusy = await usersInActiveParty([createdBy]);
  if (creatorBusy.length > 0) {
    res.status(409).json({ error: "You are already in an active party" });
    return;
  }

  // Mutual close friends who are currently free join the party immediately,
  // skipping the invitation step. Everyone else gets a pending invitation.
  const requestedInvitees = allMemberIds.filter((uid) => uid !== createdBy);
  const mutualClose = await mutualCloseFriendIds(createdBy, requestedInvitees);
  const busyClose =
    mutualClose.length > 0 ? await usersInActiveParty(mutualClose) : [];
  const busySet = new Set(busyClose);
  const directIds = mutualClose.filter((id) => !busySet.has(id));
  const directSet = new Set(directIds);
  const inviteeIds = requestedInvitees.filter((uid) => !directSet.has(uid));

  const party = await insertPartyWithUniqueCode(createdBy);

  // The creator and any free mutual close friends join immediately.
  await db
    .insert(partyMembersTable)
    .values(
      [createdBy, ...directIds].map((userId) => ({ partyId: party.id, userId })),
    );

  if (inviteeIds.length > 0) {
    await db
      .insert(partyInvitationsTable)
      .values(
        inviteeIds.map((toUserId) => ({
          partyId: party.id,
          fromUserId: createdBy,
          toUserId,
          status: "pending" as const,
        })),
      )
      .onConflictDoNothing();
  }

  res.status(201).json(await buildPartyResponse(party));
});

// NOTE: /active and /lookup must be declared before /:partyId so they are not
// captured by the param route.
router.get("/active", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  const [row] = await db
    .select({ party: partiesTable })
    .from(partyMembersTable)
    .innerJoin(partiesTable, eq(partyMembersTable.partyId, partiesTable.id))
    .where(
      and(
        eq(partyMembersTable.userId, userId),
        ne(partiesTable.status, "completed"),
      ),
    )
    .orderBy(desc(partiesTable.createdAt))
    .limit(1);

  if (!row) {
    res.json(null);
    return;
  }

  res.json(await buildPartyResponse(row.party));
});

router.get("/lookup", requireAuth, async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
  if (!code) {
    res.status(400).json({ error: "Code is required" });
    return;
  }

  const [party] = await db
    .select()
    .from(partiesTable)
    .where(eq(partiesTable.code, code))
    .limit(1);

  if (!party) {
    res.status(404).json({ error: "Party not found" });
    return;
  }

  res.json(await buildPartyResponse(party));
});

router.get("/:partyId", requireAuth, async (req: Request, res: Response) => {
  const partyId = parseIdParam(req.params.partyId);
  if (!partyId) {
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

router.post("/:partyId/join", requireAuth, async (req: Request, res: Response) => {
  const partyId = parseIdParam(req.params.partyId);
  if (!partyId) {
    res.status(400).json({ error: "Invalid party ID" });
    return;
  }

  const userId = req.session.userId!;

  const [party] = await db
    .select()
    .from(partiesTable)
    .where(eq(partiesTable.id, partyId))
    .limit(1);

  if (!party) {
    res.status(404).json({ error: "Party not found" });
    return;
  }

  if (party.status === "completed") {
    res.status(400).json({ error: "This party is already completed" });
    return;
  }

  // Joining by id requires proving knowledge of the party's join code (the
  // same code the /lookup flow returns). This prevents enumerating party ids
  // and injecting yourself into parties you were not invited to.
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (code !== party.code) {
    res.status(403).json({ error: "Invalid party code" });
    return;
  }

  const [existing] = await db
    .select()
    .from(partyMembersTable)
    .where(
      and(
        eq(partyMembersTable.partyId, partyId),
        eq(partyMembersTable.userId, userId),
      ),
    )
    .limit(1);

  if (existing) {
    // Already a member — joining is idempotent.
    res.json(await buildPartyResponse(party));
    return;
  }

  const busy = await usersInActiveParty([userId], partyId);
  if (busy.length > 0) {
    res.status(409).json({ error: "You are already in another active party" });
    return;
  }

  await db.insert(partyMembersTable).values({ partyId, userId });

  res.json(await buildPartyResponse(party));
});

router.post("/:partyId/close", requireAuth, async (req: Request, res: Response) => {
  const partyId = parseIdParam(req.params.partyId);
  if (!partyId) {
    res.status(400).json({ error: "Invalid party ID" });
    return;
  }

  const userId = req.session.userId!;

  const [party] = await db
    .select()
    .from(partiesTable)
    .where(eq(partiesTable.id, partyId))
    .limit(1);

  if (!party) {
    res.status(404).json({ error: "Party not found" });
    return;
  }

  if (party.createdBy !== userId) {
    res.status(403).json({ error: "Only the creator can close the party" });
    return;
  }

  const [updated] = await db
    .update(partiesTable)
    .set({ status: "completed" })
    .where(eq(partiesTable.id, partyId))
    .returning();

  res.json(await buildPartyResponse(updated));
});

export { usersInActiveParty };
export default router;
