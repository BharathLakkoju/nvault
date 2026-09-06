import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { apiRequest, ApiError } from "./api-client";

export async function registerPasskey(): Promise<void> {
  const { options, challengeToken } = await apiRequest<{
    options: Parameters<typeof startRegistration>[0]["optionsJSON"];
    challengeToken: string;
  }>("/auth/webauthn/register/options", { method: "POST" });
  const response = await startRegistration({ optionsJSON: options });
  await apiRequest("/auth/webauthn/register/verify", {
    method: "POST",
    body: { response, challengeToken },
  });
}

/** Re-authenticates with a passkey so sensitive actions succeed for ~5 minutes. */
export async function verifyPasskeyStepUp(): Promise<void> {
  const { options, challengeToken } = await apiRequest<{
    options: Parameters<typeof startAuthentication>[0]["optionsJSON"];
    challengeToken: string;
  }>("/auth/webauthn/step-up/options", { method: "POST" });
  const response = await startAuthentication({ optionsJSON: options });
  await apiRequest("/auth/webauthn/step-up/verify", {
    method: "POST",
    body: { response, challengeToken },
  });
}

export function isPasskeyStepUpRequired(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && err.message.includes("Passkey verification");
}
