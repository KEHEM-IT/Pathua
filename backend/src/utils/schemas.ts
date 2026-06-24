// schemas.ts — Zod validation schemas for all API request bodies.
// Co-located here so routes stay thin and schemas are unit-testable.

import { z } from "zod";

const url = z.string().url("Must be a valid URL").max(2048);
const deviceIdSchema = z.string().uuid("deviceId must be a UUID");

export const shareSchema = z.object({
  title: z.string().min(1).max(500),
  url,
  favicon: z.string().url().max(2048).optional(),
  timestamp: z.string().datetime({ message: "timestamp must be an ISO 8601 datetime" }),
  deviceIds: z.array(deviceIdSchema).max(10).optional(),
});

export const deviceRegisterSchema = z.object({
  deviceId: deviceIdSchema,
  label: z.string().min(1).max(100),
  platform: z.enum(["android", "android-web"]),
  fcmToken: z.string().min(10).max(4096),
});

export const deviceRemoveSchema = z.object({
  deviceId: deviceIdSchema,
});

export const reshareSchema = z.object({
  deviceIds: z.array(deviceIdSchema).max(10).default([]),
});
