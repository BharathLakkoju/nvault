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

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Billing</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your personal plan. Organization billing is managed on each organization&apos;s own
          billing page.
        </p>
      </div>

      <Card>
        <CardHeader
          title={isPro ? "Pro" : "Free"}
          description={
            isPro
              ? `${billing?.priceLabel} · unlimited personal projects`
              : `Up to ${plan?.freeMaxPersonalProjects ?? 5} personal projects, unlimited files & version history`
          }
        />

        {isPro && billing && (
          <dl className="divide-y divide-slate-200 dark:divide-slate-800">
            <Row label="Status" value={STATUS_LABEL[billing.pro.status] ?? billing.pro.status} />
            <Row
              label="Renews"
              value={
                billing.pro.currentPeriodEnd ? formatDate(billing.pro.currentPeriodEnd) : "—"
              }
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
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Paid plans aren&apos;t enabled on this server.
            </p>
          )}
          {billing?.pro.manageable && (
            <Button variant="secondary" onClick={openPortal} loading={portal.isPending}>
              Manage billing
            </Button>
          )}
        </div>

        {isPro && (
          <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Update your card, download invoices, or cancel from the Polar customer portal. nvault
            never sees or stores your payment details.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Teams"
          description="Shared, end-to-end encrypted projects for a group."
        />
        <div className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
          Need to share environment files with teammates? Create an{" "}
          <Link href="/settings/organizations" className="text-accent-600 hover:underline">
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
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}
