import { z } from "zod";

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const DeviceStartRequestSchema = z.object({
  deviceName: z.string().trim().max(120).optional(),
});

export const DeviceTokenRequestSchema = z.object({
  deviceCode: z.string().min(1),
});
