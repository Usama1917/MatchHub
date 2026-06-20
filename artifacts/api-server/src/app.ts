import "dotenv/config";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const PgSession = ConnectPgSimple(session);

const app: Express = express();
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required.");
}

if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

const corsOrigins = process.env.CORS_ORIGIN
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigin =
  corsOrigins && corsOrigins.length > 0
    ? corsOrigins
    : process.env.NODE_ENV === "production"
      ? false
      : true;

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const cookieSecure = process.env.COOKIE_SECURE === "true";
const cookieSameSite = process.env.COOKIE_SAME_SITE === "none" ? "none" : "lax";

// Browsers silently drop SameSite=None cookies that are not also Secure, which
// would make every login appear to succeed then immediately log out. Fail loudly
// at startup instead of shipping a silently-broken session.
if (cookieSameSite === "none" && !cookieSecure) {
  throw new Error("COOKIE_SAME_SITE=none requires COOKIE_SECURE=true");
}

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: false,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: cookieSecure,
      httpOnly: true,
      sameSite: cookieSameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

app.use("/api", router);

app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const cause = err instanceof Error ? err.cause : undefined;
    req.log.error({ err, cause }, "Unhandled API error");
    const isProduction = process.env.NODE_ENV === "production";
    res.status(500).json({
      error: isProduction
        ? "Internal server error"
        : err instanceof Error
          ? err.message
          : "Internal server error",
      cause: isProduction
        ? undefined
        : cause instanceof Error
          ? cause.message
          : cause,
    });
  },
);

export default app;
