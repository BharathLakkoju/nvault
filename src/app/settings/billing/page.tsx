"use client";

import Link from "next/link";
import { ShieldCheck } from "@phosphor-icons/react";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";

/**
 * Billing overview. nvault is free during early access and has no paid plan
 * to manage yet — this page reflects that state honestly rather than showing
 * a fabricated subscription. The planned tier structure lives on the public
 * pricing page.
 */
const PLANNED_TIERS: ReadonlyArray<{ name: string; price: string; note: string }> = [
  { name: "Early access", price: "Free", note: "Everything in the vault, unlimited projects and files" },
  { name: "Pro", price: "TBD", note: "Per user / month — for individual developers" },
  { name: "Team", price: "TBD", note: "Per organization — shared vaults and member management" },
];

export default function BillingPage() {
  return (
    <RequireAuth>
      <AppShell>
        <div>
          <h1 className="text-2xl font-medium text-ink sm:text-[28px]">Billing</h1>
          <p className="mt-0.5 text-muted">
            nvault is free while it&apos;s in early access — there&apos;s nothing to pay for yet.
          </p>

          <Card className="mt-6 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-accent-600 dark:text-accent-300">
                  Current plan
                </div>
                <div className="mt-1 text-lg font-medium text-ink">Early access — free</div>
                <p className="mt-0.5 text-sm text-muted">
                  Unlimited personal and organization projects, full version history, no card on file.
                </p>
              </div>
              <Tag variant="accent">
                <ShieldCheck size={12} weight="fill" />
                Active
              </Tag>
            </div>
          </Card>

          <div className="mt-3 flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3 text-[13px] text-muted">
            Paid plans aren&apos;t available yet. When they are, billing will be handled by a dedicated
            payments provider — card details never reach nvault.
          </div>

          <h3 className="mb-3 mt-8 text-base font-medium text-ink">Planned plans</h3>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {PLANNED_TIERS.map((tier) => (
              <div key={tier.name} className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
                <div className="text-sm font-medium text-ink">{tier.name}</div>
                <div className="text-2xl font-medium text-ink">
                  {tier.price}
                  {tier.price !== "Free" && (
                    <span className="ml-1 text-[13px] text-muted">/ mo</span>
                  )}
                </div>
                <p className="text-xs text-muted">{tier.note}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm text-muted">
            See the{" "}
            <Link href="/pricing" className="text-accent-600 hover:underline dark:text-accent-300">
              full pricing page
            </Link>{" "}
            for what each plan is expected to include.
          </p>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
