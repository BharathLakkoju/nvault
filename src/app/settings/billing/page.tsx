"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  usePersonalBillingPortal,
  useProSubscription,
  useStartProCheckout,
} from "@/hooks/use-billing";
import { usePlanInfo } from "@/hooks/use-plan-info";
import { formatDate } from "@/lib/format";
import { toastError, useToastStore } from "@/lib/toast-store";

export default function BillingPage() {
  return (
    <RequireAuth>
      <AppShell>
        <BillingContent />
      </AppShell>
    </RequireAuth>
  );
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PAST_DUE: "Payment failed — retrying",
  CANCELED: "Canceled",
  PENDING: "Awaiting payment",
  NONE: "Free plan",
};

function BillingContent() {
  const { data: plan } = usePlanInfo();
  const { data: billing, isLoading, refetch } = useProSubscription();
  const checkout = useStartProCheckout();
  const portal = usePersonalBillingPortal();
  const searchParams = useSearchParams();

  const justPaid = searchParams.get("welcome") === "1";
  const status = billing?.pro.status ?? "NONE";
  const isPro = status === "ACTIVE" || status === "PAST_DUE";

  useEffect(() => {
    if (!justPaid || isPro) return;
    const t = setInterval(() => void refetch(), 3000);
    return () => clearInterval(t);
  }, [justPaid, isPro, refetch]);

  useEffect(() => {
    if (justPaid && isPro) {
      useToastStore.getState().push("success", "You're on Pro now — unlimited personal projects.");
    }
  }, [justPaid, isPro]);

  async function upgrade() {
    try {
      const { url } = await checkout.mutateAsync();
      window.location.href = url;
    } catch (err) {
      toastError(err, "Could not start checkout");
    }
  }

  async function openPortal() {
    try {
      const { url } = await portal.mutateAsync();
      window.location.href = url;
    } catch (err) {
      toastError(err, "Could not open the billing portal");
    }
  }

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <h1 className="text-2xl font-medium text-ink sm:text-[28px]">Billing</h1>
      <p className="mt-0.5 text-muted">
        Your personal plan. Organization billing is managed on each organization&apos;s own billing
        page.
      </p>

      <Card className="mt-6">
        <CardHeader
          kicker="Personal"
          title={isPro ? "Pro" : "Free"}
          description={
            isPro
              ? `${billing?.priceLabel} · unlimited personal projects`
              : `Up to ${plan?.freeMaxPersonalProjects ?? 5} personal projects, unlimited files & version history`
          }
        />

        {isPro && billing && (
          <dl className="divide-y divide-line">
            <Row label="Status" value={STATUS_LABEL[billing.pro.status] ?? billing.pro.status} />
            <Row
              label="Renews"
              value={billing.pro.currentPeriodEnd ? formatDate(billing.pro.currentPeriodEnd) : "—"}
            />
            {billing.pro.cancelAtPeriodEnd && (
              <Row label="Scheduled to cancel" value="Access ends at the period end" />
            )}
          </dl>
        )}

        <div className="flex flex-wrap gap-2 px-5 py-4">
          {!isPro && plan?.billingEnabled && (
            <Button onClick={upgrade} loading={checkout.isPending}>
              Upgrade to Pro — {plan.proPriceLabel}
            </Button>
          )}
          {!isPro && !plan?.billingEnabled && (
            <p className="text-sm text-muted">Paid plans aren&apos;t enabled on this server.</p>
          )}
          {billing?.pro.manageable && (
            <Button variant="secondary" onClick={openPortal} loading={portal.isPending}>
              Manage billing
            </Button>
          )}
        </div>

        {isPro && (
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            Update your card, download invoices, or cancel from the Polar customer portal. nvault
            never sees or stores your payment details.
          </p>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader kicker="Teams" title="Shared vaults" description="End-to-end encrypted projects for a group." />
        <div className="px-5 py-4 text-sm text-ink/70">
          Need to share environment files with teammates? Create an{" "}
          <Link href="/settings/organizations" className="text-accent-600 hover:underline dark:text-accent-300">
            organization
          </Link>{" "}
          — from {plan?.teamTiers?.[0]?.priceLabel ?? "a monthly plan"} per organization, billed
          separately.
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
