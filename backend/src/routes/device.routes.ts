// routes/device.routes.ts

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { deviceRegisterSchema, deviceRemoveSchema } from "../utils/schemas";
import {
  registerDeviceController,
  removeDeviceController,
  listDevicesController,
} from "../controllers/device.controller";
import { AuthenticatedRequest } from "../types";
import { Response } from "express";

const router = Router();

// GET /api/device
router.get(
  "/",
  requireAuth,
  (req, res) => void listDevicesController(req as AuthenticatedRequest, res as Response)
);

// POST /api/device/register
router.post(
  "/register",
  requireAuth,
  validate(deviceRegisterSchema),
  (req, res) => void registerDeviceController(req as AuthenticatedRequest, res as Response)
);

// POST /api/device/remove
router.post(
  "/remove",
  requireAuth,
  validate(deviceRemoveSchema),
  (req, res) => void removeDeviceController(req as AuthenticatedRequest, res as Response)
);

export default router;
