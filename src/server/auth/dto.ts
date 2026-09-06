import { z } from "zod";

/** Server-only request schemas that have no client-side counterpart. */
export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const WebAuthnChallengeTokenSchema = z.object({
  challengeToken: z.string().min(1),
});

export const WebAuthnRegistrationVerifySchema = WebAuthnChallengeTokenSchema.extend({
  response: z.unknown(),
});

export const WebAuthnStepUpVerifySchema = WebAuthnRegistrationVerifySchema;
