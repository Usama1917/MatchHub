---
name: Session table setup
description: How connect-pg-simple session store is configured in this project
---

`connect-pg-simple` tries to read `table.sql` from the dist directory to auto-create the session table. When bundled with esbuild, this file is missing and causes an ENOENT error.

**Fix applied:** Set `createTableIfMissing: false` in `app.ts` and create the session table manually via SQL:

```sql
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
```

**Why:** The esbuild bundle cannot include non-JS assets like `table.sql` from `node_modules`. Pre-creating the table and disabling auto-creation avoids the startup error.

**How to apply:** If the session table is missing after a DB reset, run the SQL above before starting the API server.
