---
name: DB conventions
description: Non-obvious database schema decisions in this project
---

**isSpectator**: Stored as integer `0`/`1` not boolean. Drizzle uses `integer("is_spectator").notNull().default(0)`. When reading: `mp.isSpectator === 1` (not `mp.isSpectator === true`).

**Why:** PostgreSQL boolean columns require explicit casting; using integer avoids type mismatch issues with the Drizzle query builder in this setup.

**gameEnum / matchFormatEnum**: Defined in `lib/db/src/schema/parties.ts` and re-exported for use in `matches.ts`. Don't redefine them.

**Scoring rules**: 1v1 winner=3pts, loser=0. 2v2/3v3 winner=2pts per player, loser=0. Win type (normal/penalties/golden_goal) is recorded but doesn't change points.
