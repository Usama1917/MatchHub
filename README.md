# MatchHub

Track FIFA/PES PlayStation matches between friends: auth, parties, match results, rankings, history, profiles, and admin user management.

## Stack

- pnpm workspaces, Node.js 24, TypeScript
- Frontend: React, Vite, Tailwind CSS, shadcn/ui
- API: Express, cookie sessions, `connect-pg-simple`
- Database: PostgreSQL with Drizzle ORM schemas
- API client: OpenAPI + Orval generated React Query hooks

## Install

```sh
pnpm install
```

## Environment

Create `.env` from `.env.example` and set real values:

```sh
cp .env.example .env
```

Required for the API/serverless functions and scripts:

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: long random secret for signed session cookies

Required only for the local API process:

- `PORT`: API server port, use `4000`

Common hosting options:

- `CORS_ORIGIN`: allowed frontend origin(s), comma-separated
- `COOKIE_SECURE=true`: use for HTTPS hosting
- `COOKIE_SAME_SITE=lax`: use when frontend and API are on the same Vercel project
- `COOKIE_SAME_SITE=none`: use only when frontend and API are on different sites
- `TRUST_PROXY=true`: use behind a hosting proxy/load balancer

Frontend dev options:

- `FRONTEND_PORT`: Vite dev/preview port, defaults to `5173`
- `BASE_PATH`: frontend base path, defaults to `/`
- `API_PROXY_TARGET`: local API proxy target, defaults to `http://127.0.0.1:4000`

## Database

MatchHub uses PostgreSQL in all real app flows. Apply migrations before running the API:

```sh
pnpm db:migrate
```

The initial migration creates:

- `users`
- `parties`
- `party_members`
- `matches`
- `match_players`
- `session`

## Seed Test Accounts

Seed data is separate from production logic:

```sh
pnpm db:seed
```

Default test accounts:

| username | password    | role  |
|----------|-------------|-------|
| admin    | admin123    | admin |
| osama    | password123 | user  |
| ahmed    | password123 | user  |
| mido     | password123 | user  |
| khaled   | password123 | user  |
| mostafa  | password123 | user  |
| youssef  | password123 | user  |

For a production admin, set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and optionally `ADMIN_DISPLAY_NAME`, then run:

```sh
SEED_TEST_USERS=false pnpm db:seed
```

Do not store production passwords in source control.

## Development

Run the API:

```sh
pnpm dev:api
```

Run the frontend:

```sh
pnpm dev:web
```

Open `http://localhost:5173`.

## Build And Checks

```sh
pnpm run typecheck
pnpm run build
```

## Vercel + Supabase Hosting

MatchHub is configured for a single Vercel project. Vercel serves the Vite frontend from `artifacts/matchhub/dist/public` and runs the Express API through serverless functions in `api/*`. Keep the database on Supabase PostgreSQL through `DATABASE_URL`.

Create one Vercel project with these settings:

| Setting | Value |
|---------|-------|
| Root Directory | `.` |
| Framework Preset | `Other` |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm run typecheck && pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/matchhub run build` |
| Output Directory | `artifacts/matchhub/dist/public` |

Required Vercel environment variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `SESSION_SECRET` | Long random secret for signed session cookies |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAME_SITE` | `lax` |
| `TRUST_PROXY` | `true` |

Optional Vercel environment variables:

| Variable | When to set |
|----------|-------------|
| `CORS_ORIGIN` | Set to your Vercel/custom frontend origin if you want an explicit allow-list |
| `BASE_PATH` | Only if the frontend is hosted under a sub-path; default is `/` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_DISPLAY_NAME` | Only when seeding a production admin |
| `SEED_TEST_USERS` | Set to `false` for production admin-only seeding |

Do not set `PORT`, `FRONTEND_PORT`, or `API_PROXY_TARGET` in Vercel; those are local development settings.

Before the first production deploy, apply migrations against the Supabase database:

```sh
DATABASE_URL="your-supabase-postgres-url" pnpm db:migrate
```

Optionally seed a production admin:

```sh
DATABASE_URL="your-supabase-postgres-url" \
ADMIN_USERNAME="admin" \
ADMIN_PASSWORD="replace-with-a-real-password" \
SEED_TEST_USERS=false \
pnpm db:seed
```

Scores, player stats, and rankings are calculated from match records. Admin user management does not expose controls for editing scores, results, points, or player statistics.
