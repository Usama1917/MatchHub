import { Router, Request, Response } from "express";
import {
  db,
  usersTable,
  matchesTable,
  partiesTable,
  matchPlayersTable,
  partyMembersTable,
} from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { parseIdParam } from "../lib/http";

const router = Router();

async function requireAdminRole(req: Request, res: Response): Promise<boolean> {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId))
    .limit(1);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

function safeUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
  };
}

router.get("/users", requireAuth, async (req: Request, res: Response) => {
  if (!(await requireAdminRole(req, res))) return;
  const users = await db.select().from(usersTable);
  res.json(users.map(safeUser));
});

async function getUserById(userId: number) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  return user;
}

async function countAdmins() {
  const [row] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));

  return row.count;
}

router.post("/users/:userId/promote", requireAuth, async (req: Request, res: Response) => {
  if (!(await requireAdminRole(req, res))) return;

  const userId = parseIdParam(req.params.userId);
  if (!userId) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  // Prevent self-demotion/promotion weirdness
  if (userId === req.session.userId) {
    res.status(400).json({ error: "Cannot modify your own role" });
    return;
  }

  const user = await getUserById(userId);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ role: "admin" })
    .where(eq(usersTable.id, userId))
    .returning();

  res.json(safeUser(updated));
});

router.post("/users/:userId/demote", requireAuth, async (req: Request, res: Response) => {
  if (!(await requireAdminRole(req, res))) return;

  const userId = parseIdParam(req.params.userId);
  if (!userId) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  if (userId === req.session.userId) {
    res.status(400).json({ error: "Cannot modify your own role" });
    return;
  }

  const user = await getUserById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.role !== "admin") {
    res.json(safeUser(user));
    return;
  }

  if ((await countAdmins()) <= 1) {
    res.status(400).json({ error: "Cannot demote the last admin" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ role: "user" })
    .where(eq(usersTable.id, userId))
    .returning();

  res.json(safeUser(updated));
});

router.delete("/users/:userId", requireAuth, async (req: Request, res: Response) => {
  if (!(await requireAdminRole(req, res))) return;

  const userId = parseIdParam(req.params.userId);
  if (!userId) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  if (userId === req.session.userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  const user = await getUserById(userId);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.role === "admin" && (await countAdmins()) <= 1) {
    res.status(400).json({ error: "Cannot delete the last admin" });
    return;
  }

  const [createdMatches] = await db
    .select({ count: count() })
    .from(matchesTable)
    .where(eq(matchesTable.createdBy, userId));
  const [matchPlayers] = await db
    .select({ count: count() })
    .from(matchPlayersTable)
    .where(eq(matchPlayersTable.userId, userId));
  const [createdParties] = await db
    .select({ count: count() })
    .from(partiesTable)
    .where(eq(partiesTable.createdBy, userId));
  const [partyMembers] = await db
    .select({ count: count() })
    .from(partyMembersTable)
    .where(eq(partyMembersTable.userId, userId));

  const hasActivity =
    createdMatches.count > 0 ||
    matchPlayers.count > 0 ||
    createdParties.count > 0 ||
    partyMembers.count > 0;

  if (hasActivity) {
    res.status(409).json({
      error:
        "Cannot delete users with parties or match history. Demote them instead.",
    });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, userId));
  res.json({ success: true, message: "User deleted" });
});

router.get("/stats", requireAuth, async (req: Request, res: Response) => {
  if (!(await requireAdminRole(req, res))) return;

  const [totalUsers] = await db.select({ count: count() }).from(usersTable);
  const [totalMatches] = await db.select({ count: count() }).from(matchesTable);
  const [totalParties] = await db.select({ count: count() }).from(partiesTable);
  const [adminCount] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));
  const [fifaCount] = await db
    .select({ count: count() })
    .from(matchesTable)
    .where(eq(matchesTable.game, "fifa"));
  const [pesCount] = await db
    .select({ count: count() })
    .from(matchesTable)
    .where(eq(matchesTable.game, "pes"));
  const [format1v1] = await db
    .select({ count: count() })
    .from(matchesTable)
    .where(eq(matchesTable.matchFormat, "1v1"));
  const [format2v2] = await db
    .select({ count: count() })
    .from(matchesTable)
    .where(eq(matchesTable.matchFormat, "2v2"));
  const [format3v3] = await db
    .select({ count: count() })
    .from(matchesTable)
    .where(eq(matchesTable.matchFormat, "3v3"));

  res.json({
    totalUsers: totalUsers.count,
    totalMatches: totalMatches.count,
    totalParties: totalParties.count,
    adminCount: adminCount.count,
    fifaMatches: fifaCount.count,
    pesMatches: pesCount.count,
    matchFormats: {
      "1v1": format1v1.count,
      "2v2": format2v2.count,
      "3v3": format3v3.count,
    },
  });
});

export default router;
