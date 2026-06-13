import { Router, Request, Response } from "express";
import {
  db,
  partyInvitationsTable,
  partiesTable,
  partyMembersTable,
  usersTable,
} from "@workspace/db";
import { eq, and, ne, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { parseIdParam } from "../lib/http";
import { usersInActiveParty } from "./parties";

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
  const me = req.session.userId!;

  const rows = await db
    .select({
      inv: partyInvitationsTable,
      party: partiesTable,
      fromUser: usersTable,
    })
    .from(partyInvitationsTable)
    .innerJoin(partiesTable, eq(partyInvitationsTable.partyId, partiesTable.id))
    .innerJoin(usersTable, eq(partyInvitationsTable.fromUserId, usersTable.id))
    .where(
      and(
        eq(partyInvitationsTable.toUserId, me),
        eq(partyInvitationsTable.status, "pending"),
        ne(partiesTable.status, "completed"),
      ),
    )
    .orderBy(desc(partyInvitationsTable.createdAt));

  res.json(
    rows.map(({ inv, party, fromUser }) => ({
      id: inv.id,
      partyId: inv.partyId,
      partyCode: party.code,
      status: inv.status,
      createdAt: inv.createdAt,
      fromUser: safeUser(fromUser),
    })),
  );
});

router.post("/:invitationId/accept", requireAuth, async (req: Request, res: Response) => {
  const invitationId = parseIdParam(req.params.invitationId);
  if (!invitationId) {
    res.status(400).json({ error: "Invalid invitation ID" });
    return;
  }

  const me = req.session.userId!;

  const [inv] = await db
    .select()
    .from(partyInvitationsTable)
    .where(
      and(
        eq(partyInvitationsTable.id, invitationId),
        eq(partyInvitationsTable.toUserId, me),
        eq(partyInvitationsTable.status, "pending"),
      ),
    )
    .limit(1);

  if (!inv) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }

  const busy = await usersInActiveParty([me], inv.partyId);
  if (busy.length > 0) {
    res.status(409).json({ error: "You are already in another active party" });
    return;
  }

  await db
    .insert(partyMembersTable)
    .values({ partyId: inv.partyId, userId: me })
    .onConflictDoNothing();

  await db
    .update(partyInvitationsTable)
    .set({ status: "accepted" })
    .where(eq(partyInvitationsTable.id, invitationId));

  res.json({ success: true, message: "Accepted" });
});

router.post("/:invitationId/reject", requireAuth, async (req: Request, res: Response) => {
  const invitationId = parseIdParam(req.params.invitationId);
  if (!invitationId) {
    res.status(400).json({ error: "Invalid invitation ID" });
    return;
  }

  const me = req.session.userId!;

  await db
    .update(partyInvitationsTable)
    .set({ status: "rejected" })
    .where(
      and(
        eq(partyInvitationsTable.id, invitationId),
        eq(partyInvitationsTable.toUserId, me),
        eq(partyInvitationsTable.status, "pending"),
      ),
    );

  res.json({ success: true, message: "Rejected" });
});

export default router;
