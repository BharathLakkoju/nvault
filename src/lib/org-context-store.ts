"use client";

import { create } from "zustand";

/**
 * The organization the dashboard is currently scoped to. `null` means the
 * user's personal projects. This is a UI convenience ONLY — it filters what
 * the dashboard shows and picks the default target for "New Project". It is
 * never a security boundary: the server always re-derives access from
 * membership regardless of what is selected here.
 */
const STORAGE_KEY = "nvault.currentOrgId";

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(orgId: string | null) {
  try {
    if (orgId) localStorage.setItem(STORAGE_KEY, orgId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — private windows / disabled storage
  }
}

interface OrgContextState {
  currentOrgId: string | null;
  hydrated: boolean;
  setCurrentOrg: (orgId: string | null) => void;
  hydrate: () => void;
}

export const useOrgContext = create<OrgContextState>((set) => ({
  currentOrgId: null,
  hydrated: false,
  setCurrentOrg(orgId) {
    writeStored(orgId);
    set({ currentOrgId: orgId });
  },
  hydrate() {
    set({ currentOrgId: readStored(), hydrated: true });
  },
}));
