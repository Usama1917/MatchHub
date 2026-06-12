import "dotenv/config";
import { scryptSync } from "node:crypto";
import { db, pool, usersTable } from "@workspace/db";

type SeedUser = {
  username: string;
  displayName: string;
  password: string;
  role: "user" | "admin";
};

const testUsers: SeedUser[] = [
  {
    username: "admin",
    displayName: "Admin",
    password: "admin123",
    role: "admin",
  },
  {
    username: "osama",
    displayName: "Osama",
    password: "password123",
    role: "user",
  },
  {
    username: "ahmed",
    displayName: "Ahmed",
    password: "password123",
    role: "user",
  },
  {
    username: "mido",
    displayName: "Mido",
    password: "password123",
    role: "user",
  },
  {
    username: "khaled",
    displayName: "Khaled",
    password: "password123",
    role: "user",
  },
  {
    username: "mostafa",
    displayName: "Mostafa",
    password: "password123",
    role: "user",
  },
  {
    username: "youssef",
    displayName: "Youssef",
    password: "password123",
    role: "user",
  },
];

function passwordHash(password: string, salt: string) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${hash}.${salt}`;
}

async function upsertUser(user: SeedUser) {
  const username = user.username.toLowerCase();

  await db
    .insert(usersTable)
    .values({
      username,
      displayName: user.displayName,
      passwordHash: passwordHash(user.password, `matchhub-${username}`),
      role: user.role,
    })
    .onConflictDoUpdate({
      target: usersTable.username,
      set: {
        displayName: user.displayName,
        passwordHash: passwordHash(user.password, `matchhub-${username}`),
        role: user.role,
      },
    });
}

function productionAdminFromEnv(): SeedUser | null {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username && !password) return null;
  if (!username || !password) {
    throw new Error(
      "ADMIN_USERNAME and ADMIN_PASSWORD must be provided together.",
    );
  }

  return {
    username,
    displayName: process.env.ADMIN_DISPLAY_NAME ?? username,
    password,
    role: "admin",
  };
}

async function seed() {
  const seededAccounts: SeedUser[] = [];

  if (process.env.SEED_TEST_USERS !== "false") {
    for (const user of testUsers) {
      await upsertUser(user);
      seededAccounts.push(user);
    }
  }

  const productionAdmin = productionAdminFromEnv();
  if (productionAdmin) {
    await upsertUser(productionAdmin);
    seededAccounts.push({
      ...productionAdmin,
      password: "<from ADMIN_PASSWORD>",
    });
  }

  if (seededAccounts.length === 0) {
    console.log("No seed accounts requested.");
    return;
  }

  console.table(
    seededAccounts.map((account) => ({
      username: account.username,
      password: account.password,
      role: account.role,
    })),
  );
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
