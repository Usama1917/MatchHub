# MatchHub

Track FIFA/PES PlayStation matches between friends — login, create parties, submit results, and see live rankings.

## Run & Operate

- `pnpm dev:api` — run the API server
- `pnpm dev:web` — run the frontend
- `pnpm db:migrate` — apply SQL migrations to PostgreSQL
- `pnpm db:seed` — seed test accounts or env-configured admin accounts
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `PORT`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + express-session + connect-pg-simple
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- Frontend: React + Vite + Tailwind v4 + shadcn/ui
- State/Data fetching: TanStack Query (via generated hooks from `@workspace/api-client-react`)
- Build: esbuild (ESM bundle for API)

## Where things live

- `lib/api-spec/openapi.yaml` — source-of-truth OpenAPI spec
- `lib/db/src/schema/` — DB schema (users.ts, parties.ts, matches.ts)
- `artifacts/api-server/src/routes/` — all API route handlers
- `artifacts/matchhub/src/pages/` — all frontend pages
- `artifacts/matchhub/src/contexts/` — AuthContext, LanguageContext (AR/EN + RTL/LTR)
- `lib/api-client-react/src/generated/api.ts` — generated hooks (do not edit)
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas (do not edit)

## Architecture decisions

- **Contract-first**: OpenAPI spec defines the contract; frontend hooks + Zod schemas are generated from it via Orval. Run codegen after changing the spec.
- **Session auth**: Cookie-based sessions via `express-session` + `connect-pg-simple`. Sessions stored in the `session` table. `req.session.userId` identifies the logged-in user.
- **Scoring**: 1v1 winner gets 3 pts; 2v2/3v3 winner gets 2 pts per player. Losers always 0. Win type (penalties, golden goal) is recorded but doesn't affect points. Rankings/profile stats are derived from completed match records.
- **Dark gaming theme**: The HTML element has `class="dark"` applied in `index.html`. The CSS custom variant `dark (&:is(.dark *))` applies dark mode colors. Primary color is green (`142 71% 45%`).
- **Orval config**: zod output uses `mode: "single"` and absolute target path. No `workspace` or `schemas` fields — prevents barrel regeneration collisions. See `lib/api-spec/orval.config.ts`.

## Product

- **Auth**: Register / Login / Logout with secure session cookies
- **Parties**: Step-by-step wizard — pick members → game (FIFA/PES) → format (1v1/2v2/3v3) → arrange teams → confirm & start
- **Matches**: Create from party, submit result (score + win type), auto-calculate points
- **Rankings**: FIFA, PES, and Overall leaderboards with W/L/GD/Win%
- **Match History**: Filterable by game and format
- **Profiles**: Per-user stats and match history
- **Admin**: Stats dashboard, user management (promote to admin, delete)
- **Bilingual**: Arabic/English toggle in header; RTL/LTR applied to `<html>` element

## Seed test accounts

| Username  | Password     | Role  |
|-----------|--------------|-------|
| admin     | admin123     | admin |
| osama     | password123  | user  |
| ahmed     | password123  | user  |
| mido      | password123  | user  |
| khaled    | password123  | user  |
| mostafa   | password123  | user  |
| youssef   | password123  | user  |

These are created only by `pnpm db:seed`; the app does not create or depend on them at runtime. For production admin creation, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` and run `SEED_TEST_USERS=false pnpm db:seed`.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Session table**: `connect-pg-simple` needs the `session` table pre-created. `pnpm db:migrate` creates it.
- **Orval codegen**: After changing `openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`. The generated files in `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/` must not be manually edited.
- **isSpectator**: Stored as integer `0`/`1` in DB (not boolean). The Drizzle schema uses `integer` type for this field.
- **TypeScript imports**: Always import types from `@workspace/api-client-react` (the barrel export), NOT from `@workspace/api-client-react/src/generated/api.schemas`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
