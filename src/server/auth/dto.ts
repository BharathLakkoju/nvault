import { z } from "zod";

/** Server-only request schemas that have no client-side counterpart. */
export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
