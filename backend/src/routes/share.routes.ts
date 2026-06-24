// routes/share.routes.ts

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { shareSchema, reshareSchema } from "../utils/schemas";
import { shareController, reshareController } from "../controllers/share.controller";
import { AuthenticatedRequest } from "../types";
import { Response } from "express";

const router = Router();

// POST /api/share
router.post(
  "/",
  requireAuth,
  validate(shareSchema),
  (req, res) => void shareController(req as AuthenticatedRequest, res as Response)
);

// POST /api/share/:shareId/reshare
router.post(
  "/:shareId/reshare",
  requireAuth,
  validate(reshareSchema),
  (req, res) => void reshareController(req as AuthenticatedRequest, res as Response)
);

export default router;
