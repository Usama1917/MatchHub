import { Router, type IRouter, type RequestHandler } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const healthCheck: RequestHandler = (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
};

router.get("/health", healthCheck);
router.get("/healthz", healthCheck);

export default router;
