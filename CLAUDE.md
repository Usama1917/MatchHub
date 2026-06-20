# CLAUDE.md

Guidance for working in this repo. Track FIFA/PES PlayStation matches between friends:
auth, parties, match results, rankings, history, profiles, private ranks, admin.

## Commands

```sh
pnpm install                 # install (pnpm workspaces, Node 24)
pnpm dev:api                 # API server (reads PORT from .env)
pnpm dev:web                 # frontend (Vite); proxies /api -> API_PROXY_TARGET
pnpm run typecheck           # full typecheck across all packages (Vercel build gate)
pnpm run build               # typecheck + build all packages
pnpm db:migrate              # apply SQL migrations (needs DATABASE_URL)
pnpm db:seed                 # seed test accounts (admin/admin123, others/password123)
pnpm smoke:vercel-api        # build api + run the Vercel serverless-shape smoke test
pnpm --filter @workspace/api-spec run codegen   # regenerate API hooks + Zod from OpenAPI
```

Test accounts after `pnpm db:seed`: `admin`/`admin123` (admin), `osama`/`ahmed`/`mido`/`khaled`/`mostafa`/`youssef` all `password123`.

## Architecture

pnpm monorepo. **Contract-first**: `lib/api-spec/openapi.yaml` is the source of truth; the
React Query hooks (`lib/api-client-react`) and Zod schemas (`lib/api-zod`) are **generated**
from it via Orval.

- `lib/api-spec/openapi.yaml` — OpenAPI spec (edit this, then run codegen)
- `lib/db/src/schema/` — Drizzle schema (users, parties, matches, follows, closeFriends, invitations, groups)
- `lib/db/migrations/` — raw SQL migrations applied by `scripts/src/migrate.ts` (tracked in `_matchhub_migrations`)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/matchhub/src/pages/` — frontend pages; `src/contexts/` — Auth + Language (AR/EN, RTL/LTR)
- `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/` — **generated, do NOT hand-edit**

Stack: Express 5 + express-session + connect-pg-simple; PostgreSQL + Drizzle; React + Vite + Tailwind v4 + shadcn/ui; TanStack Query.

### Conventions
- After editing `openapi.yaml`, run codegen and update call sites. Never edit generated files.
- Import types from the barrel `@workspace/api-client-react`, not the generated subpaths.
- Auth is cookie sessions (`req.session.userId`). Use `requireAuth` / `requireAdmin` middleware (both verify against the DB).
- `isSpectator` is an integer `0/1` in the DB, exposed as boolean in API responses.
- Wrap multi-write operations in `db.transaction(...)`.

## Domain logic (non-obvious)
- **Scoring**: 1v1 winner = 3 pts; 2v2/3v3 winner = 2 pts/player; losers 0. Win type
  (penalties/golden goal) is recorded but doesn't affect points. Rankings/stats derive from
  completed match records. Winner must match the higher score; a draw needs a tiebreaker win type.
- **Party lifecycle**: a match counts active players + spectators (party members not playing).
  One active (non-completed) party per user. Submitting a result does **NOT** complete the party —
  the party stays `in_progress` so more matches can be played; only the creator's explicit
  "Close Party" completes it. Closing a party that still has an in-progress match prompts to
  cancel the match (`DELETE /matches/:id`, not-completed only) or submit its result.
- **Private ranks (groups)**: a completed match counts toward a rank only when ≥2 of its
  non-spectator players are members **and** the match was created on/after the rank's `createdAt`
  (the rank scores from scratch, not players' whole history — see `computeGroupRankings(memberIds, game, since)`).
  Rankings UI has Rank / Match History tabs (`GET /groups/:id/matches`).
- **Close friends** (`close_friends` table): directed edges. When two users are **mutual** close
  friends, adding one to a party the other creates joins them immediately (no invitation) — see
  `mutualCloseFriendIds` in `routes/parties.ts`.

## Local development
- `dotenv` loads `.env` from each package's own dir, not the repo root. The API reads `.env` via a
  symlink `artifacts/api-server/.env -> ../../.env` (gitignored). `db:migrate`/`db:seed` need
  `DATABASE_URL` passed inline (their cwd is `scripts/`).
- **Port note**: another local project (Warqless) uses port 4000, so this repo's local `.env` uses
  `PORT=4100` and `API_PROXY_TARGET=http://127.0.0.1:4100`. The frontend reads `API_PROXY_TARGET`
  from `process.env`, so start it with that var:
  `API_PROXY_TARGET=http://127.0.0.1:4100 pnpm dev:web`. (README/.env.example keep the documented `4000`.)

## Deployment — Vercel + Supabase (READ before deploying)
Single Vercel project: Vite static frontend served from repo-root `public/` (the matchhub build
copies `dist/public` there); Express API runs via the serverless function in `api/index.js`
(imports `artifacts/api-server/dist/vercel.mjs`). Build settings live in `vercel.json` — do not
override them in the dashboard.

- **Migrations are NOT run by the Vercel build.** After deploying code with new migrations you MUST
  run them against Supabase yourself, or the app 500s on missing tables/columns:
  ```sh
  DATABASE_URL="<supabase-session-pooler-uri>?sslmode=no-verify" pnpm db:migrate
  ```
  Use the Supabase **Session/Transaction pooler** host (`aws-0-<region>.pooler.supabase.com`),
  NOT the direct `db.<ref>.supabase.co` host (IPv6-only; fails from most networks). `sslmode=no-verify`
  is needed because Supabase's chain isn't in Node's default trust store.
- Required Vercel env: `DATABASE_URL` (use the pooler URI), `SESSION_SECRET`, `COOKIE_SECURE=true`,
  `COOKIE_SAME_SITE=lax`, `TRUST_PROXY=true`. Note: `COOKIE_SAME_SITE=none` requires
  `COOKIE_SECURE=true` or the server throws at startup (intentional guard).
- Optional perf: tune `PG_POOL_MAX` low for serverless; pooler URL already mitigates connection fan-out.

## Gotchas
- `connect-pg-simple` needs the `session` table — created by `db:migrate`.
- Vite `dev:web` won't pick up the API port unless `API_PROXY_TARGET` is exported (see Local development).
- Don't commit `.env`, the `artifacts/api-server/.env` symlink, or `public/` (all gitignored).
- Production DB credentials: if a Supabase password is ever exposed, rotate it
  (Supabase → Settings → Database → Reset password) and update `DATABASE_URL` in Vercel.
