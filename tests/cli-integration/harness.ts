/**
 * CLI ⇄ API integration harness.
 *
 * The CLI's own command functions (cli/src/commands/*) are executed for real.
 * Their only outside contact is `globalThis.fetch`; here that is swapped for a
 * shim that routes every request the CLI makes to the actual Next.js Route
 * Handlers (src/app/api/v1/**), which in turn hit the real Postgres in
 * DATABASE_URL — exactly the path a `npm i -g` install would take, minus the
 * network hop.
 *
 * What this proves that the existing tests/integration/api.spec.ts cannot:
 * the CLI's argument parsing, project resolution, git detection, on-disk
 * credential handling, passphrase → master-key unlock, client-side
 * encrypt/decrypt, byte-preservation on push/pull, backup-before-overwrite,
 * and secret injection for `run` all work end to end against a live API.
 *
 * Requires DATABASE_URL (see tests/integration/setup.ts). Skipped otherwise.
 */
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import * as crypto from "@/lib/crypto";

// The CLI talks to this synthetic origin; the shim intercepts it and passes
// anything else through to the real fetch.
export const CLI_API_ORIGIN = "http://cli-harness.local";
export const CLI_API_BASE_URL = `${CLI_API_ORIGIN}/api/v1`;

type RouteHandler = (
  req: NextRequest,
  ctx: { params: Record<string, string> },
) => Promise<Response> | Response;

interface RouteDef {
  method: string;
  pattern: RegExp;
  keys?: string[];
  load: () => RouteHandler;
}

// Ordered most-specific first. `pattern` matches the path *after* `/api/v1`.
const ROUTES: RouteDef[] = [
  { method: "GET", pattern: /^\/auth\/me$/, load: () => require("@/app/api/v1/auth/me/route").GET },
  {
    method: "GET",
    pattern: /^\/auth\/vault\/keypair$/,
    load: () => require("@/app/api/v1/auth/vault/keypair/route").GET,
  },
  {
    method: "POST",
    pattern: /^\/auth\/vault\/keypair$/,
    load: () => require("@/app/api/v1/auth/vault/keypair/route").POST,
  },
  {
    method: "POST",
    pattern: /^\/auth\/tokens$/,
    load: () => require("@/app/api/v1/auth/tokens/route").POST,
  },
  {
    method: "POST",
    pattern: /^\/auth\/register$/,
    load: () => require("@/app/api/v1/auth/register/route").POST,
  },
  {
    method: "GET",
    pattern: /^\/projects\/by-git-remote$/,
    load: () => require("@/app/api/v1/projects/by-git-remote/route").GET,
  },
  { method: "GET", pattern: /^\/projects$/, load: () => require("@/app/api/v1/projects/route").GET },
  { method: "POST", pattern: /^\/projects$/, load: () => require("@/app/api/v1/projects/route").POST },
  {
    method: "GET",
    pattern: /^\/projects\/([^/]+)\/files\/([^/]+)\/versions\/([^/]+)$/,
    keys: ["id", "fileId", "versionId"],
    load: () =>
      require("@/app/api/v1/projects/[id]/files/[fileId]/versions/[versionId]/route").GET,
  },
  {
    method: "GET",
    pattern: /^\/projects\/([^/]+)\/files\/([^/]+)\/versions$/,
    keys: ["id", "fileId"],
    load: () => require("@/app/api/v1/projects/[id]/files/[fileId]/versions/route").GET,
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/files\/([^/]+)\/restore$/,
    keys: ["id", "fileId"],
    load: () => require("@/app/api/v1/projects/[id]/files/[fileId]/restore/route").POST,
  },
  {
    method: "DELETE",
    pattern: /^\/projects\/([^/]+)\/files\/([^/]+)$/,
    keys: ["id", "fileId"],
    load: () => require("@/app/api/v1/projects/[id]/files/[fileId]/route").DELETE,
  },
  {
    method: "GET",
    pattern: /^\/projects\/([^/]+)\/files$/,
    keys: ["id"],
    load: () => require("@/app/api/v1/projects/[id]/files/route").GET,
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/files$/,
    keys: ["id"],
    load: () => require("@/app/api/v1/projects/[id]/files/route").POST,
  },
  {
    method: "GET",
    pattern: /^\/projects\/([^/]+)$/,
    keys: ["id"],
    load: () => require("@/app/api/v1/projects/[id]/route").GET,
  },
  {
    method: "DELETE",
    pattern: /^\/projects\/([^/]+)$/,
    keys: ["id"],
    load: () => require("@/app/api/v1/projects/[id]/route").DELETE,
  },
  {
    method: "GET",
    pattern: /^\/organizations\/([^/]+)$/,
    keys: ["id"],
    load: () => require("@/app/api/v1/organizations/[id]/route").GET,
  },
];

let realFetch: typeof globalThis.fetch;
export const shimCalls: Array<{ method: string; path: string; status: number }> = [];

export function installFetchShim(): void {
  realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init: RequestInit = {}) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const url = new URL(rawUrl);
    if (url.origin !== CLI_API_ORIGIN) {
      return realFetch(input as RequestInfo, init);
    }

    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = (init.method ?? "GET").toUpperCase();
    const route = ROUTES.find((r) => r.method === method && r.pattern.test(path));
    if (!route) {
      return Response.json(
        { statusCode: 500, message: `harness: no route for ${method} ${path}` },
        { status: 500 },
      );
    }

    const match = path.match(route.pattern)!;
    const params: Record<string, string> = {};
    (route.keys ?? []).forEach((k, i) => {
      params[k] = decodeURIComponent(match[i + 1]);
    });

    const headers = new Headers((init.headers as HeadersInit) ?? {});
    let body: BodyInit | undefined;
    if (init.body != null && method !== "GET") {
      body = init.body as BodyInit;
      if (typeof init.body === "string" && !headers.has("content-length")) {
        headers.set("content-length", String(Buffer.byteLength(init.body, "utf8")));
      }
    }

    const req = new NextRequest(`http://localhost${url.pathname}${url.search}`, {
      method,
      headers,
      body,
    });

    const res = await route.load()(req, { params });
    shimCalls.push({ method, path, status: res.status });
    return res;
  }) as typeof globalThis.fetch;
}

export function uninstallFetchShim(): void {
  if (realFetch) globalThis.fetch = realFetch;
}

/** Direct (non-shim) call into a route handler — used only for test setup. */
async function directCall(
  load: () => RouteHandler,
  opts: {
    method: string;
    path: string;
    params?: Record<string, string>;
    body?: unknown;
    token?: string;
  },
) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const body = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  if (body !== undefined) {
    headers["content-length"] = String(Buffer.byteLength(body, "utf8"));
  }
  const req = new NextRequest(`http://localhost${opts.path}`, {
    method: opts.method,
    headers,
    body,
  });
  const res = await load()(req, { params: opts.params ?? {} });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

export interface TestAccount {
  email: string;
  userId: string;
  passphrase: string;
  /** Opaque `evk_…` Personal Access Token — what the CLI actually uses. */
  pat: string;
  /** Short-lived access JWT from register (setup only). */
  jwt: string;
}

const db = require("@/server/db").db as import("@/generated/prisma/client").PrismaClient;
const createdUserIds: string[] = [];

/** Registers a fresh account and mints a CLI Personal Access Token for it. */
export async function createAccount(
  passphrase = "harness vault passphrase 2026",
  opts: { pro?: boolean } = {},
): Promise<TestAccount> {
  const email = `cli_it_${randomUUID()}@example.com`;
  const password = "cli integration account password 123";
  const provisioned = await crypto.provisionVault(passphrase);

  const reg = await directCall(() => require("@/app/api/v1/auth/register/route").POST, {
    method: "POST",
    path: "/api/v1/auth/register",
    body: {
      email,
      password,
      kdfSalt: provisioned.keyMaterial.kdfSalt,
      kdfIterations: provisioned.keyMaterial.kdfIterations,
      wrappedMasterKey: provisioned.keyMaterial.wrappedMasterKey,
    },
  });
  if (reg.status !== 201) {
    throw new Error(`harness: register failed ${reg.status} ${JSON.stringify(reg.body)}`);
  }
  const userId = reg.body.user.id as string;
  const jwt = reg.body.accessToken as string;
  createdUserIds.push(userId);

  // CLI access is a paid feature, but the plan a given test wants to exercise
  // varies (some assert Free-tier caps). Mint the harness PAT directly so setup
  // stays plan-agnostic — the paywall itself is covered in the API suite.
  const { createApiToken } = require("@/server/auth/api-tokens") as typeof import("@/server/auth/api-tokens");
  const minted = await createApiToken(userId, { name: "cli harness" }, { hasCliAccess: true });

  if (opts.pro !== false) {
    await grantPro(userId);
  }

  return { email, userId, passphrase, pat: minted.token, jwt };
}

export async function cleanupAccounts(): Promise<void> {
  if (createdUserIds.length) {
    await db.user.deleteMany({ where: { id: { in: createdUserIds.splice(0) } } });
  }
}

/** Clears the shared-IP register/login rate-limit window between tests. */
export async function resetRateLimit(): Promise<void> {
  await db.rateLimitHit.deleteMany().catch(() => {});
}

export async function disconnectDb(): Promise<void> {
  await db.$disconnect();
}

export { db, crypto };

/**
 * Points the CLI's env-var auth path at the harness. Every command that needs
 * the vault also reads NVAULT_PASSPHRASE here so nothing hits an interactive
 * prompt (which would hang a non-TTY test).
 */
export function useAccountEnv(account: TestAccount): void {
  process.env.NVAULT_API_URL = CLI_API_BASE_URL;
  process.env.NVAULT_TOKEN = account.pat;
  process.env.NVAULT_PASSPHRASE = account.passphrase;
}

export function clearAccountEnv(): void {
  delete process.env.NVAULT_API_URL;
  delete process.env.NVAULT_TOKEN;
  delete process.env.NVAULT_PASSPHRASE;
  delete process.env.ENVVAULT_API_URL;
  delete process.env.ENVVAULT_TOKEN;
  delete process.env.ENVVAULT_PASSPHRASE;
}

/**
 * Grants an account an active Pro subscription by writing the row directly —
 * the same shortcut the seed harness uses (Polar is never reachable in
 * tests). Cascades away when the user is deleted in cleanup.
 */
export async function grantPro(userId: string): Promise<void> {
  await db.subscription.create({
    data: {
      plan: "PRO",
      ownerUserId: userId,
      status: "ACTIVE",
      polarCustomerId: `cus_cli_it_${userId.slice(0, 8)}`,
      polarSubscriptionId: `sub_cli_it_${userId.slice(0, 8)}`,
      polarProductId: process.env.POLAR_PRO_PRODUCT_ID ?? "prod_pro_cli_it",
      currentPeriodEnd: new Date(Date.now() + 28 * 864e5),
      cancelAtPeriodEnd: false,
    },
  });
}

/**
 * Creates a personal project straight through the API (unlock vault → wrap a
 * fresh project key → POST /projects), optionally with a git remote so
 * `nvault init` / `status` detection can be exercised. Mirrors what the CLI's
 * own `project create` does, plus the `gitRemoteUrl` field.
 */
export async function createProjectViaApi(
  account: TestAccount,
  name: string,
  opts: { gitRemoteUrl?: string } = {},
): Promise<{ id: string; name: string }> {
  const me = await directCall(() => require("@/app/api/v1/auth/me/route").GET, {
    method: "GET",
    path: "/api/v1/auth/me",
    token: account.pat,
  });
  const masterKey = await crypto.unlockVault(account.passphrase, me.body.vaultKeyMaterial);
  const id = randomUUID();
  const { wrappedProjectKey } = await crypto.createProjectKey(masterKey, id);
  const res = await directCall(() => require("@/app/api/v1/projects/route").POST, {
    method: "POST",
    path: "/api/v1/projects",
    token: account.pat,
    body: { id, name, wrappedProjectKey, ...(opts.gitRemoteUrl ? { gitRemoteUrl: opts.gitRemoteUrl } : {}) },
  });
  if (res.status !== 201) {
    throw new Error(`harness: createProject failed ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { id: res.body.project.id as string, name };
}

/** Silences (and records) console output for the duration of a test. */
export function captureConsole(): { lines: string[]; text: () => string; restore: () => void } {
  const lines: string[] = [];
  const push = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  };
  const logSpy = jest.spyOn(console, "log").mockImplementation(push);
  const errSpy = jest.spyOn(console, "error").mockImplementation(push);
  return {
    lines,
    text: () => lines.join("\n"),
    restore: () => {
      logSpy.mockRestore();
      errSpy.mockRestore();
    },
  };
}
