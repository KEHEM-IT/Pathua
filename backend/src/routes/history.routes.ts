// routes/history.routes.ts

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  getHistoryController,
  deleteHistoryController,
} from "../controllers/history.controller";
import { reshareController } from "../controllers/share.controller";
import { validate } from "../middleware/validate.middleware";
import { reshareSchema } from "../utils/schemas";
import { AuthenticatedRequest } from "../types";
import { Response } from "express";

const router = Router();

// GET /api/history
router.get(
  "/",
  requireAuth,
  (req, res) => void getHistoryController(req as AuthenticatedRequest, res as Response)
);

// DELETE /api/history/:shareId
router.delete(
  "/:shareId",
  requireAuth,
  (req, res) => void deleteHistoryController(req as AuthenticatedRequest, res as Response)
);

// POST /api/history/:shareId/reshare
router.post(
  "/:shareId/reshare",
  requireAuth,
  validate(reshareSchema),
  (req, res) => void reshareController(req as AuthenticatedRequest, res as Response)
);

export default router;
