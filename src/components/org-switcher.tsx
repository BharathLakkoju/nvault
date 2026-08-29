"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useOrganizations } from "@/hooks/use-organizations";
import { useOrgContext } from "@/lib/org-context-store";
import { cn } from "@/lib/cn";

/**
 * Switches the dashboard's project scope between "Personal" and each org the
 * user belongs to. Purely a UI convenience — never a security boundary.
 */
export function OrgSwitcher({ className }: { className?: string }) {
  const { data: orgs } = useOrganizations();
  const currentOrgId = useOrgContext((s) => s.currentOrgId);
  const hydrated = useOrgContext((s) => s.hydrated);
  const hydrate = useOrgContext((s) => s.hydrate);
  const setCurrentOrg = useOrgContext((s) => s.setCurrentOrg);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // If the stored org is gone (left / deleted), fall back to Personal.
  useEffect(() => {
    if (hydrated && currentOrgId && orgs && !orgs.some((o) => o.id === currentOrgId)) {
      setCurrentOrg(null);
    }
  }, [hydrated, currentOrgId, orgs, setCurrentOrg]);

  const current = orgs?.find((o) => o.id === currentOrgId);
  const label = current ? current.name : "Personal";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "focus-ring inline-flex max-w-[12rem] items-center gap-1.5 truncate rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
            className,
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 21h18M6 21V7l6-4 6 4v14M10 9h4M10 13h4M10 17h4" />
          </svg>
          <span className="truncate">{label}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[14rem] rounded-md border border-slate-200 bg-white p-1 shadow-md dark:border-slate-800 dark:bg-slate-900"
        >
          <DropdownMenu.Item
            onSelect={() => setCurrentOrg(null)}
            className={cn(
              "focus-ring flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm outline-none",
              !currentOrgId
                ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
            )}
          >
            Personal
          </DropdownMenu.Item>

          {orgs && orgs.length > 0 && (
            <DropdownMenu.Separator className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
          )}

          {orgs?.map((org) => (
            <DropdownMenu.Item
              key={org.id}
              onSelect={() => setCurrentOrg(org.id)}
              className={cn(
                "focus-ring flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm outline-none",
                currentOrgId === org.id
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
              )}
            >
              <span className="truncate">{org.name}</span>
              {org.status === "INVITED" && (
                <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  pending
                </span>
              )}
              {org.orgStatus === "PENDING_PAYMENT" && (
                <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  unpaid
                </span>
              )}
              {org.orgStatus === "SUSPENDED" && (
                <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                  inactive
                </span>
              )}
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
          <DropdownMenu.Item asChild>
            <Link
              href="/settings/organizations"
              className="focus-ring block cursor-pointer rounded px-2 py-1.5 text-sm text-slate-600 outline-none hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Manage organizations…
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
