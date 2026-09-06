import type { PolarSubscriptionData } from "./service";

export function parsePolarModifiedAt(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function subscriptionIdentityMatches(
  existing:
    | { polarSubscriptionId: string | null; polarCustomerId: string | null }
    | null
    | undefined,
  data: Pick<PolarSubscriptionData, "id" | "customerId">,
): boolean {
  if (existing?.polarSubscriptionId && existing.polarSubscriptionId !== data.id) return false;
  if (
    existing?.polarCustomerId &&
    data.customerId &&
    existing.polarCustomerId !== data.customerId
  ) {
    return false;
  }
  return true;
}

export function isStalePolarEvent(
  storedModifiedAt: Date | null | undefined,
  eventModifiedAt: Date | null,
): boolean {
  if (!storedModifiedAt || !eventModifiedAt) return false;
  return eventModifiedAt.getTime() <= storedModifiedAt.getTime();
}
