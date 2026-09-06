"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Folder,
  Building2,
  CreditCard,
  Laptop,
  Terminal,
  History,
} from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { useOrganizations } from "@/hooks/use-organizations";
import { useOrgContext } from "@/lib/org-context-store";
import { cn } from "@/lib/cn";

interface Entry {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
  run: () => void;
}

const ICON_CLASS = "h-4 w-4";

/**
 * The ⌘K / Ctrl-K command palette. Jumps to a project, switches org scope, or
 * navigates to a settings page — a keyboard-first way around the app. Purely a
 * navigation aid; every destination re-checks authorization on its own.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const { data: projects } = useProjects();
  const { data: orgs } = useOrganizations();
  const setCurrentOrg = useOrgContext((s) => s.setCurrentOrg);

  const entries = useMemo<Entry[]>(() => {
    const close = () => onOpenChange(false);
    const list: Entry[] = [];
    for (const p of projects ?? []) {
      list.push({
        id: `project:${p.id}`,
        label: p.name,
        group: "Project",
        icon: <Folder className={ICON_CLASS} />,
        run: () => {
          router.push(`/projects/${p.id}`);
          close();
        },
      });
    }
    list.push({
      id: "scope:personal",
      label: "Personal projects",
      group: "Scope",
      icon: <Folder className={ICON_CLASS} />,
      run: () => {
        setCurrentOrg(null);
        router.push("/dashboard");
        close();
      },
    });
    for (const o of orgs ?? []) {
      list.push({
        id: `scope:${o.id}`,
        label: `${o.name} projects`,
        group: "Scope",
        icon: <Building2 className={ICON_CLASS} />,
        run: () => {
          setCurrentOrg(o.id);
          router.push("/dashboard");
          close();
        },
      });
    }
    const pages: [string, string, React.ReactNode][] = [
      ["/settings/organizations", "Organizations", <Building2 key="o" className={ICON_CLASS} />],
      ["/settings/billing", "Billing", <CreditCard key="b" className={ICON_CLASS} />],
      ["/settings/sessions", "Sessions", <Laptop key="s" className={ICON_CLASS} />],
      ["/settings/tokens", "CLI tokens", <Terminal key="t" className={ICON_CLASS} />],
      ["/settings/security", "Activity", <History key="a" className={ICON_CLASS} />],
    ];
    for (const [href, label, icon] of pages) {
      list.push({
        id: `page:${href}`,
        label,
        group: "Page",
        icon,
        run: () => {
          router.push(href);
          close();
        },
      });
    }
    return list;
  }, [projects, orgs, router, setCurrentOrg, onOpenChange]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.label.toLowerCase().includes(q) || e.group.toLowerCase().includes(q));
  }, [entries, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Focus after the element mounts.
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-center bg-slate-950/55 px-4 pt-[14vh] [animation:dc-fade-in_.12s_ease-out]"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="h-fit w-full max-w-xl overflow-hidden rounded-[14px] border border-line bg-surface shadow-2xl [animation:dc-pop-in_.14s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                filtered[active]?.run();
              } else if (e.key === "Escape") {
                onOpenChange(false);
              }
            }}
            placeholder="Jump to a project, org, or setting…"
            className="flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
          />
          <span className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted">esc</span>
        </div>
        <div className="dc-scroll flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted">No matches</div>
          )}
          {filtered.map((entry, i) => (
            <button
              key={entry.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => entry.run()}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-ink",
                i === active ? "bg-accent-500/12" : "hover:bg-ink/[0.04]",
              )}
            >
              <span className="text-accent-600 dark:text-accent-300">{entry.icon}</span>
              <span className="flex-1 truncate">{entry.label}</span>
              <span className="text-[11px] text-muted">{entry.group}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
