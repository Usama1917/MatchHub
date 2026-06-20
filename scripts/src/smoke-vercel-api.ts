import "dotenv/config";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { type AddressInfo } from "node:net";

process.env.DATABASE_URL ??=
  "postgres://matchhub_user:change-me@127.0.0.1:5432/matchhub";
process.env.SESSION_SECRET ??= "local-vercel-api-smoke-test-secret";
process.env.COOKIE_SECURE ??= "false";
process.env.COOKIE_SAME_SITE ??= "lax";
process.env.TRUST_PROXY ??= "false";
process.env.LOG_LEVEL ??= "silent";

type VercelRequest = IncomingMessage & {
  query?: Record<string, string | string[]>;
};

type VercelHandler = (
  req: VercelRequest,
  res: ServerResponse,
) => unknown | Promise<unknown>;

function addQueryToRequest(req: VercelRequest) {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of url.searchParams) {
    const current = query[key];

    if (Array.isArray(current)) {
      current.push(value);
    } else if (typeof current === "string") {
      query[key] = [current, value];
    } else {
      query[key] = value;
    }
  }

  if (url.pathname.startsWith("/api/")) {
    query["path"] = url.pathname.slice("/api/".length);
  }

  req.query = query;
}

async function closeServer(server: http.Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

const require = createRequire(import.meta.url);
const handler = require("../../api/index.js") as VercelHandler;

const server = http.createServer((req, res) => {
  const vercelReq = req as VercelRequest;

  // Simulate the real production routing shape: Vercel rewrites /api/:path* to
  // the bare destination "/api" and carries the original path on req.query.path.
  // This is the case the plain /?path= test cannot reproduce.
  if (req.url === "/__vercel_dest/health") {
    vercelReq.url = "/api";
    vercelReq.query = { path: ["health"] };
  } else {
    addQueryToRequest(vercelReq);
  }

  void Promise.resolve(handler(vercelReq, res)).catch((err: unknown) => {
    console.error(err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Smoke test handler error");
    }
  });
});

await new Promise<void>((resolve) => {
  server.listen(0, "127.0.0.1", resolve);
});

try {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Unable to determine smoke test server address.");
  }

  const { port } = address as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const health = await fetch(`${baseUrl}/api/health`);
  const healthBody = await health.text();

  if (health.status !== 200) {
    throw new Error(
      `GET /api/health expected 200, received ${health.status}: ${healthBody}`,
    );
  }

  const catchAllHealth = await fetch(`${baseUrl}/?path=health`);
  const catchAllHealthBody = await catchAllHealth.text();

  if (catchAllHealth.status !== 200) {
    throw new Error(
      `GET /?path=health expected 200, received ${catchAllHealth.status}: ${catchAllHealthBody}`,
    );
  }

  // Production-shaped routing: req.url === "/api" with the path on req.query.path.
  const destHealth = await fetch(`${baseUrl}/__vercel_dest/health`);
  const destHealthBody = await destHealth.text();

  if (destHealth.status !== 200) {
    throw new Error(
      `destination-only /api (query.path=health) expected 200, received ${destHealth.status}: ${destHealthBody}`,
    );
  }

  const me = await fetch(`${baseUrl}/api/auth/me`);

  if (me.status === 404) {
    throw new Error("GET /api/auth/me returned 404");
  }

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });

  if (login.status === 404) {
    const loginBody = await login.text();
    throw new Error(`POST /api/auth/login returned 404: ${loginBody}`);
  }

  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
  });

  if (logout.status === 404) {
    throw new Error("POST /api/auth/logout returned 404");
  }

  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });

  if (register.status === 404) {
    throw new Error("POST /api/auth/register returned 404");
  }

  console.log(
    `Vercel API smoke passed: health=${health.status}, me=${me.status}, login=${login.status}, logout=${logout.status}, register=${register.status}`,
  );
} finally {
  await closeServer(server);
}
