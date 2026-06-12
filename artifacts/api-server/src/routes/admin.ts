import { Router, Request, Response } from "express";
import { db, usersTable, matchesTable, partiesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

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

router.post("/users/:userId/promote", requireAuth, async (req: Request, res: Response) => {
  if (!(await requireAdminRole(req, res))) return;

  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  // Prevent self-demotion/promotion weirdness
  if (userId === req.session.userId) {
    res.status(400).json({ error: "Cannot modify your own role" });
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

  const [updated] = await db
    .update(usersTable)
    .set({ role: "admin" })
    .where(eq(usersTable.id, userId))
    .returning();

  res.json(safeUser(updated));
});

router.delete("/users/:userId", requireAuth, async (req: Request, res: Response) => {
  if (!(await requireAdminRole(req, res))) return;

  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  if (userId === req.session.userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
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
