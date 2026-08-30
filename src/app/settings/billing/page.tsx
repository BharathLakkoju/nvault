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
import { useOrganizations } from "@/hooks/use-organizations";
import { formatDate } from "@/lib/format";
import { teamPlanLabel, orgStatusPresentation } from "@/lib/plan";
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
  const { data: orgs } = useOrganizations();
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
      useToastStore
        .getState()
        .push("success", "You're on Pro now — unlimited projects and version history.");
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

  const free = plan?.freeLimits;
  const freeSummary = free
    ? `Up to ${free.maxPersonalProjects} personal projects · last ${free.maxVersionsPerFile} versions of each file · ${free.maxBrowserSessions} devices`
    : "Up to 3 personal projects · limited history · limited devices";
  const proSummary = plan?.proLimits
    ? `${billing?.priceLabel ?? plan.proPriceLabel} · unlimited projects & history · ${plan.proLimits.maxBrowserSessions} devices`
    : `${billing?.priceLabel ?? ""} · unlimited personal projects`;

  return (
    <div>
      <h1 className="text-2xl font-medium text-ink sm:text-[28px]">Plans &amp; billing</h1>
      <p className="mt-0.5 text-muted">
        Manage your personal plan below. Each organization has its own subscription, managed by its
        owner.
      </p>

      <Card className="mt-6">
        <CardHeader
          kicker="Your plan"
          title={isPro ? "Pro" : "Free"}
          description={isPro ? proSummary : freeSummary}
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
        <CardHeader
          kicker="Organizations"
          title="Team plans"
          description="One subscription per organization. Only the owner can change an organization's plan."
        />
        {(orgs ?? []).length === 0 ? (
          <div className="px-5 py-4 text-sm text-ink/70">
            You&apos;re not in any organization yet. Create one to share encrypted projects with a
            team —{" "}
            <Link
              href="/settings/organizations"
              className="text-accent-600 hover:underline dark:text-accent-300"
            >
              from {plan?.teamTiers?.[0]?.priceLabel ?? "a monthly plan"} per organization
            </Link>
            .
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {(orgs ?? []).map((org) => {
              const pres = orgStatusPresentation(org.orgStatus);
              const isOwner = org.role === "OWNER";
              return (
                <li
                  key={org.id}
                  className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{org.name}</p>
                    <p className="text-xs text-muted">
                      {teamPlanLabel(org.tier)} · {org.role?.toLowerCase()} ·{" "}
                      <span
                        className={
                          pres.tone === "danger"
                            ? "text-red-600 dark:text-red-400"
                            : pres.tone === "warn"
                              ? "text-amber-600 dark:text-amber-500"
                              : "text-muted"
                        }
                      >
                        {pres.label}
                      </span>
                    </p>
                  </div>
                  {isOwner ? (
                    <Link href={`/organizations/${org.id}/billing`} className="shrink-0">
                      <Button variant="secondary">Manage billing</Button>
                    </Link>
                  ) : (
                    <span className="shrink-0 text-xs text-muted">
                      Managed by the organization owner
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
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
