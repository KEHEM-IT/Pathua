// routes/analytics.routes.ts

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  getAnalyticsController,
  incrementQrController,
} from "../controllers/analytics.controller";
import { AuthenticatedRequest } from "../types";
import { Response } from "express";

const router = Router();

// GET /api/analytics?range=7d|30d|90d
router.get(
  "/",
  requireAuth,
  (req, res) => void getAnalyticsController(req as AuthenticatedRequest, res as Response)
);

// POST /api/analytics/qr — extension pings this when a QR is generated
router.post(
  "/qr",
  requireAuth,
  (req, res) => void incrementQrController(req as AuthenticatedRequest, res as Response)
);

export default router;
