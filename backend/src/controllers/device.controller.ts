// device.controller.ts

import { Response } from "express";
import { AuthenticatedRequest, DeviceRegisterBody } from "../types";
import * as deviceService from "../services/device.service";
import { sendSuccess, sendError } from "../utils/helpers";

export async function registerDeviceController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const body = req.body as DeviceRegisterBody;
  const { uid } = req;

  // Enforce per-user device limit (prevents abuse)
  const existing = await deviceService.getDevices(uid);
  if (existing.length >= 10) {
    sendError(res, 400, "DEVICE_LIMIT", "Maximum of 10 devices per account");
    return;
  }

  const summary = await deviceService.registerDevice(
    uid,
    body.deviceId,
    body.label,
    body.platform,
    body.fcmToken
  );
  sendSuccess(res, summary, 201);
}

export async function removeDeviceController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { deviceId } = req.body as { deviceId: string };
  const { uid } = req;
  await deviceService.removeDevice(uid, deviceId);
  sendSuccess(res, { deviceId, removed: true });
}

export async function listDevicesController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { uid } = req;
  const devices = await deviceService.getDevices(uid);
  sendSuccess(res, devices.map(deviceService.toDeviceSummary));
}
