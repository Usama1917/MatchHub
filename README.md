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

Required for the API and scripts:

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: long random secret for signed session cookies
- `PORT`: API server port

Common hosting options:

- `CORS_ORIGIN`: allowed frontend origin(s), comma-separated
- `COOKIE_SECURE=true`: use for HTTPS hosting
- `COOKIE_SAME_SITE=none`: use when frontend and API are on different sites
- `TRUST_PROXY=true`: use behind a hosting proxy/load balancer

Frontend dev options:

- `FRONTEND_PORT`: Vite dev/preview port, defaults to `5173`
- `BASE_PATH`: frontend base path, defaults to `/`
- `API_PROXY_TARGET`: local API proxy target, defaults to `http://localhost:8080`

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

## Hosting Notes

1. Provision PostgreSQL.
2. Set `DATABASE_URL`, `SESSION_SECRET`, `PORT`, and hosting cookie/CORS vars.
3. Run `pnpm install --frozen-lockfile`.
4. Run `pnpm db:migrate`.
5. Optionally run `SEED_TEST_USERS=false pnpm db:seed` with admin env vars.
6. Run `pnpm run build`.
7. Start the API with `pnpm --filter @workspace/api-server run start`.
8. Serve `artifacts/matchhub/dist/public` as the frontend static bundle.

Scores, player stats, and rankings are calculated from match records. Admin user management does not expose controls for editing scores, results, points, or player statistics.
