import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";

export default function handleVercelRequest(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (req.url && !req.url.startsWith("/api")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }

  return app(req, res);
}
