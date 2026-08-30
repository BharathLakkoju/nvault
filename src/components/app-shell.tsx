"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ShieldCheck,
  FolderSimple,
  Buildings,
  CreditCard,
  Devices,
  TerminalWindow,
  ClockCounterClockwise,
  MagnifyingGlass,
  Bell,
  CaretLeft,
  CaretRight,
  List as ListIcon,
  User,
  Check,
  SignOut,
  Lock,
  type Icon,
} from "@phosphor-icons/react";
import { useAuthStore } from "@/lib/auth-store";
import { useOrganizations } from "@/hooks/use-organizations";
import { useOrgContext } from "@/lib/org-context-store";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { Logo, LogoMark } from "@/components/marketing/logo";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Projects", icon: FolderSimple },
  { href: "/settings/organizations", label: "Organizations", icon: Buildings },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/settings/sessions", label: "Sessions", icon: Devices },
  { href: "/settings/tokens", label: "CLI Tokens", icon: TerminalWindow },
  { href: "/settings/security", label: "Activity", icon: ClockCounterClockwise },
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
        <header className="flex flex-shrink-0 items-center gap-3 border-b border-line px-4 py-3 sm:px-7">
          <button
            aria-label="Open menu"
            className="focus-ring -ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-ink/[0.06] md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <ListIcon size={18} />
          </button>

          <button
            onClick={() => setPaletteOpen(true)}
            className="focus-ring flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-muted sm:w-72"
          >
            <MagnifyingGlass size={15} />
            <span className="flex-1 truncate text-left">Search projects, files, people…</span>
            <span className="hidden rounded border border-line px-1.5 py-px text-[11px] sm:inline">⌘K</span>
          </button>

          <div className="flex-1" />

          <ThemeToggle />
          <button
            aria-label="Notifications"
            className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-ink/[0.06]"
          >
            <Bell size={17} />
          </button>
          <div className="h-5 w-px bg-line" />
          <AccountBadge />
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
          <CaretLeft size={14} />
        </button>
      </div>
      {collapsed && (
        <button
          onClick={onToggleCollapsed}
          title="Expand sidebar"
          className="focus-ring mx-auto mb-1 hidden h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-ink/[0.06] md:inline-flex"
        >
          <CaretRight size={14} />
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
              <Icon size={17} weight={active ? "fill" : "regular"} className="flex-shrink-0" />
              <span className={cn("truncate", collapsed && "md:hidden")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-shrink-0 flex-col">
        <div className={cn("border-t border-line px-3 pb-2 pt-2.5", collapsed && "md:hidden")}>
          <div className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
            Account
          </div>
          <OrgScopeList collapsed={collapsed} />
        </div>
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
            <ShieldCheck size={12} weight="fill" />
            {masterKey ? "Unlocked" : "Locked"}
          </span>
        </div>
      </div>
    </aside>
  );
}

function OrgScopeList({ collapsed }: { collapsed: boolean }) {
  const { data: orgs } = useOrganizations();
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

  const rows = [
    { id: null as string | null, name: "Personal", icon: User },
    ...(orgs ?? []).map((o) => ({ id: o.id, name: o.name, icon: Buildings })),
  ];

  return (
    <div className={cn("flex flex-col gap-0.5", collapsed && "md:hidden")}>
      {rows.map((row) => {
        const active = currentOrgId === row.id;
        const Icon = row.icon;
        return (
          <button
            key={row.id ?? "personal"}
            onClick={() => setCurrentOrg(row.id)}
            className={cn(
              "focus-ring flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px]",
              active ? "bg-accent-500/15 text-accent-700 dark:text-accent-100" : "text-ink/70 hover:bg-ink/[0.05]",
            )}
          >
            <Icon size={15} className="flex-shrink-0" />
            <span className="flex-1 truncate text-left">{row.name}</span>
            {active && <Check size={13} />}
          </button>
        );
      })}
    </div>
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
            <SignOut size={14} />
            Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
