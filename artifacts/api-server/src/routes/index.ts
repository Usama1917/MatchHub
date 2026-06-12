import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import partiesRouter from "./parties";
import matchesRouter from "./matches";
import rankingsRouter from "./rankings";
import statsRouter from "./stats";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use("/", healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/parties", partiesRouter);
router.use("/matches", matchesRouter);
router.use("/rankings", rankingsRouter);
router.use("/stats", statsRouter);
router.use("/admin", adminRouter);

export default router;
