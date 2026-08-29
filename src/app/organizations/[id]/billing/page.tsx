"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useChangeOrgTier,
  useOrgBilling,
  useOrgBillingPortal,
  useOrganization,
  useStartOrgCheckout,
} from "@/hooks/use-organizations";
import { formatDate } from "@/lib/format";
import { toastError, useToastStore } from "@/lib/toast-store";
import type { TeamTier } from "@/lib/types";

export default function OrgBillingPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <AppShell>
        <BillingContent id={id} />
      </AppShell>
    </RequireAuth>
  );
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PAST_DUE: "Payment failed — retrying",
  CANCELED: "Canceled",
  PENDING: "Awaiting payment",
  NONE: "No subscription",
};

function BillingContent({ id }: { id: string }) {
  const { data: org, isLoading: orgLoading } = useOrganization(id);
  const { data: billing, isLoading: billingLoading } = useOrgBilling(id);
  const portal = useOrgBillingPortal(id);
  const checkout = useStartOrgCheckout(id);
  const changeTier = useChangeOrgTier(id);
  const [pendingTier, setPendingTier] = useState<TeamTier | null>(null);

  if (orgLoading || billingLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  if (!org || org.self.role !== "OWNER") {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Only the organization owner can view billing.
        </p>
        <Link
          href={`/organizations/${id}`}
          className="mt-3 inline-block text-sm text-accent-600 hover:underline"
        >
          Back to organization
        </Link>
      </Card>
    );
  }

  const sub = billing?.subscription;
  const orgStatus = billing?.orgStatus ?? org.organization.orgStatus;
  const currentTier = sub?.tier ?? null;
  const tiers = billing?.tiers ?? [];
  const memberCount = billing?.memberCount ?? 0;

  async function openPortal() {
    try {
      const { url } = await portal.mutateAsync();
      window.location.href = url;
    } catch (err) {
      toastError(err, "Could not open the billing portal");
    }
  }

  async function goToCheckout(tier?: TeamTier) {
    try {
      const { url } = await checkout.mutateAsync(tier);
      window.location.href = url;
    } catch (err) {
      toastError(err, "Could not open checkout");
    }
  }

  async function applyTierChange(tier: TeamTier) {
    setPendingTier(tier);
    try {
      await changeTier.mutateAsync(tier);
      useToastStore.getState().push("success", "Plan updated — Polar will prorate the difference.");
    } catch (err) {
      toastError(err, "Could not change the plan");
    } finally {
      setPendingTier(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Billing — {org.organization.name}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          One flat subscription per organization, billed through Polar. {memberCount} member
          {memberCount === 1 ? "" : "s"} currently.
        </p>
      </div>

      <Card>
        <CardHeader title="Subscription" description="Managed on Polar's secure hosted pages." />
        <dl className="divide-y divide-slate-200 dark:divide-slate-800">
          <Row label="Status" value={STATUS_LABEL[sub?.status ?? "NONE"] ?? sub?.status ?? "—"} />
          <Row
            label="Plan"
            value={
              currentTier
                ? `${currentTier[0]}${currentTier.slice(1).toLowerCase()} · up to ${
                    tiers.find((t) => t.tier === currentTier)?.maxMembers ?? "?"
                  } members`
                : "—"
            }
          />
          <Row
            label="Current period ends"
            value={sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : "—"}
          />
          {sub?.cancelAtPeriodEnd && (
            <Row label="Scheduled to cancel" value="Access ends when the current period does" />
          )}
        </dl>
        <div className="flex flex-wrap gap-2 px-5 py-4">
          {orgStatus !== "ACTIVE" && (
            <Button onClick={() => goToCheckout()} loading={checkout.isPending}>
              {orgStatus === "PENDING_PAYMENT" ? "Complete payment" : "Renew subscription"}
            </Button>
          )}
          {sub?.manageable && (
            <Button variant="secondary" onClick={openPortal} loading={portal.isPending}>
              Manage billing
            </Button>
          )}
        </div>
      </Card>

      {orgStatus === "ACTIVE" && (
        <Card>
          <CardHeader
            title="Change plan"
            description="Upgrade or downgrade any time — Polar prorates the difference."
          />
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {tiers.map((t) => {
              const isCurrent = t.tier === currentTier;
              const tooSmall = t.maxMembers < memberCount;
              return (
                <li
                  key={t.tier}
                  className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <span className="text-sm font-medium capitalize text-slate-900 dark:text-slate-100">
                      {t.tier.toLowerCase()}
                    </span>
                    <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                      {t.priceLabel} · up to {t.maxMembers} members
                    </span>
                  </div>
                  {isCurrent ? (
                    <span className="text-xs font-medium text-accent-600 dark:text-accent-400">
                      Current plan
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={tooSmall}
                      loading={pendingTier === t.tier}
                      onClick={() => applyTierChange(t.tier)}
                      title={tooSmall ? "Remove members to fit this plan first" : undefined}
                    >
                      Switch
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Update your card, download invoices, or cancel from the Polar customer portal. nvault
        never sees or stores your payment details.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 text-sm">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}
