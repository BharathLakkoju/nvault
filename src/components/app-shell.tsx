"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ShieldCheck,
  Command,
  Folder,
  Building2,
  CreditCard,
  Laptop,
  Terminal,
  History,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Menu,
  User,
  Check,
  Plus,
  LogOut,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useOrganizations } from "@/hooks/use-organizations";
import { useProSubscription } from "@/hooks/use-billing";
import { useOrgContext } from "@/lib/org-context-store";
import { teamPlanLabel } from "@/lib/plan";
import type { OrgBillingStatus } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { Logo, LogoMark } from "@/components/marketing/logo";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Projects", icon: Folder },
  { href: "/settings/organizations", label: "Organizations", icon: Building2 },
  { href: "/settings/billing", label: "Plans & billing", icon: CreditCard },
  { href: "/settings/sessions", label: "Sessions", icon: Laptop },
  { href: "/settings/tokens", label: "CLI Tokens", icon: Terminal },
  { href: "/settings/security", label: "Activity", icon: History },
];

const SIDEBAR_STORAGE_KEY = "nvault.sidebar.collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
    } catch {
      /* private windows / disabled storage */
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-950/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={toggleCollapsed}
        pathname={pathname}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative flex flex-shrink-0 items-center gap-3 border-b border-line px-4 py-3 sm:px-7">
          <button
            aria-label="Open menu"
            className="focus-ring -ml-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted hover:bg-ink/[0.06] md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>

          {/* Mobile: search stays in the header flow */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-muted md:hidden"
          >
            <Search size={15} className="flex-shrink-0" />
            <span className="flex-1 truncate text-left">Search projects, files, people…</span>
          </button>

          {/* Desktop: search centered in the header */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="focus-ring absolute left-1/2 hidden w-full max-w-md -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] text-muted md:flex lg:max-w-lg"
          >
            <Search size={15} className="flex-shrink-0" />
            <span className="flex-1 truncate text-left">Search projects, files, people…</span>
            <kbd className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] leading-none text-muted">
              <Command size={12} />
              <span className="text-xs">K</span>
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden h-5 w-px bg-line sm:block" />
            <AccountBadge />
          </div>
        </header>

        <main className="dc-scroll flex-1 overflow-y-auto px-4 py-7 sm:px-10 sm:pb-16">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  pathname,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  pathname: string;
}) {
  const masterKey = useAuthStore((s) => s.masterKey);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface transition-transform md:static md:translate-x-0 md:transition-[width]",
        collapsed ? "md:w-[68px]" : "md:w-56",
        "w-64",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className={cn("flex flex-shrink-0 items-center gap-2.5 px-4 py-4", collapsed && "md:justify-center md:px-0")}>
        <Link href="/dashboard" className="focus-ring rounded">
          <Logo className={cn("text-[15px]", collapsed && "md:hidden")} />
          <LogoMark className={cn("hidden", collapsed && "md:block")} />
        </Link>
        <button
          onClick={onToggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "focus-ring ml-auto h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted hover:bg-ink/[0.06] hidden md:inline-flex",
            collapsed && "md:hidden",
          )}
        >
          <ChevronLeft size={14} />
        </button>
      </div>
      {collapsed && (
        <button
          onClick={onToggleCollapsed}
          title="Expand sidebar"
          className="focus-ring mx-auto mb-1 hidden h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-ink/[0.06] md:inline-flex"
        >
          <ChevronRight size={14} />
        </button>
      )}

      <nav className="dc-scroll flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard" || pathname.startsWith("/projects")
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "focus-ring flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px]",
                active
                  ? "bg-accent-500/15 text-accent-700 dark:text-accent-100"
                  : "text-ink/75 hover:bg-ink/[0.05]",
                collapsed && "md:justify-center",
              )}
            >
              <Icon
                size={17}
                className={cn("flex-shrink-0", active && "stroke-[2.25]")}
              />
              <span className={cn("truncate", collapsed && "md:hidden")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-shrink-0 flex-col border-t border-line pt-2">
        <div
          className={cn(
            "px-3 pb-1 pt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted",
            collapsed && "md:hidden",
          )}
        >
          Account
        </div>
        <WorkspaceSwitcher collapsed={collapsed} />
        <div className="flex flex-col gap-2.5 border-t border-line p-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 self-start rounded-md px-2 py-0.5 text-[11px]",
              collapsed && "md:hidden",
              masterKey
                ? "bg-accent-500/15 text-accent-700 dark:text-accent-200"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
            )}
          >
            <ShieldCheck size={12} className="fill-current" />
            {masterKey ? "Unlocked" : "Locked"}
          </span>
        </div>
      </div>
    </aside>
  );
}

/**
 * The workspace ("scope") switcher in the sidebar's bottom "Account" section.
 * Personal vault +
 * every ACTIVE org membership, each showing its plan and the caller's role.
 * Selecting a row only changes what the dashboard shows — the server always
 * re-derives access from membership (see org-context-store).
 */
function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { data: orgs } = useOrganizations();
  const { data: billing } = useProSubscription();
  const currentOrgId = useOrgContext((s) => s.currentOrgId);
  const hydrated = useOrgContext((s) => s.hydrated);
  const hydrate = useOrgContext((s) => s.hydrate);
  const setCurrentOrg = useOrgContext((s) => s.setCurrentOrg);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (hydrated && currentOrgId && orgs && !orgs.some((o) => o.id === currentOrgId)) {
      setCurrentOrg(null);
    }
  }, [hydrated, currentOrgId, orgs, setCurrentOrg]);

  const isPro = billing?.pro.status === "ACTIVE" || billing?.pro.status === "PAST_DUE";
  const activeOrgs = (orgs ?? []).filter((o) => o.status === "ACTIVE");
  const hasPendingInvite = (orgs ?? []).some((o) => o.status === "INVITED");
  const currentOrg = activeOrgs.find((o) => o.id === currentOrgId) ?? null;

  const CurrentIcon = currentOrg ? Building2 : User;
  const currentName = currentOrg ? currentOrg.name : "Personal";
  const currentPlan = currentOrg
    ? teamPlanLabel(currentOrg.tier)
    : isPro
      ? "Pro"
      : "Free";

  return (
    <div className={cn("px-3 pb-3", collapsed && "md:px-2")}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            title="Switch workspace"
            className={cn(
              "focus-ring flex w-full items-center gap-2.5 rounded-lg border border-line bg-canvas px-2.5 py-2 text-left hover:bg-ink/[0.04]",
              collapsed && "md:justify-center md:gap-0 md:px-0",
            )}
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-accent-500/15 text-accent-700 dark:text-accent-200">
              <CurrentIcon size={15} />
            </span>
            <span className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
              <span className="block truncate text-[13px] font-medium text-ink">{currentName}</span>
              <span className="block truncate text-[11px] text-muted">{currentPlan}</span>
            </span>
            <ChevronsUpDown
              size={14}
              className={cn("flex-shrink-0 text-muted", collapsed && "md:hidden")}
            />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-[70] w-60 rounded-lg border border-line bg-surface p-1 shadow-xl"
          >
            <DropdownMenu.Label className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
              Switch workspace
            </DropdownMenu.Label>

            <WorkspaceRow
              icon={User}
              name="Personal"
              detail={isPro ? "Pro plan" : "Free plan"}
              active={!currentOrgId}
              onSelect={() => setCurrentOrg(null)}
            />
            {activeOrgs.map((o) => (
              <WorkspaceRow
                key={o.id}
                icon={Building2}
                name={o.name}
                detail={`${teamPlanLabel(o.tier)} · ${o.role?.toLowerCase() ?? "member"}`}
                status={o.orgStatus}
                active={currentOrgId === o.id}
                onSelect={() => setCurrentOrg(o.id)}
              />
            ))}

            {hasPendingInvite && (
              <p className="px-2 py-1 text-[11px] text-muted">
                A pending invite becomes selectable once you have key access.
              </p>
            )}

            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Item asChild>
              <Link
                href="/settings/organizations"
                className="focus-ring flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink outline-none hover:bg-ink/[0.06]"
              >
                <Plus size={14} /> New organization
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild>
              <Link
                href="/settings/billing"
                className="focus-ring flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink outline-none hover:bg-ink/[0.06]"
              >
                <CreditCard size={14} /> Plans &amp; billing
              </Link>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function WorkspaceRow({
  icon: Icon,
  name,
  detail,
  status,
  active,
  onSelect,
}: {
  icon: LucideIcon;
  name: string;
  detail: string;
  status?: OrgBillingStatus;
  active: boolean;
  onSelect: () => void;
}) {
  const dot =
    status && status !== "ACTIVE"
      ? status === "SUSPENDED"
        ? "bg-red-500"
        : "bg-amber-500"
      : null;
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="focus-ring flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 outline-none hover:bg-ink/[0.06]"
    >
      <Icon size={15} className="flex-shrink-0 text-muted" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] text-ink">{name}</span>
          {dot && <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", dot)} />}
        </span>
        <span className="block truncate text-[11px] capitalize text-muted">{detail}</span>
      </span>
      {active && (
        <Check size={13} className="flex-shrink-0 text-accent-600 dark:text-accent-300" />
      )}
    </DropdownMenu.Item>
  );
}

function AccountBadge() {
  const user = useAuthStore((s) => s.user);
  const masterKey = useAuthStore((s) => s.masterKey);
  const lockVault = useAuthStore((s) => s.lockVault);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const initial = (user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label="Account menu"
          className="focus-ring flex h-7 w-7 items-center justify-center rounded-full bg-ink/10 text-xs font-medium text-ink"
        >
          {initial}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[70] min-w-[13rem] rounded-lg border border-line bg-surface p-1 shadow-xl"
        >
          {user?.email && (
            <div className="truncate px-2 py-1.5 text-xs text-muted">{user.email}</div>
          )}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          {masterKey && (
            <DropdownMenu.Item
              onSelect={() => lockVault()}
              className="focus-ring flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink outline-none hover:bg-ink/[0.06]"
            >
              <Lock size={14} />
              Lock vault
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item
            onSelect={() => void logout().then(() => router.replace("/login"))}
            className="focus-ring flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-600 outline-none hover:bg-red-500/10 dark:text-red-400"
          >
            <LogOut size={14} />
            Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
