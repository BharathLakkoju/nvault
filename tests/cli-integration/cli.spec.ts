/**
 * CLI ⇄ API integration: real cli/src command functions against real Route
 * Handlers + Postgres. See ./harness.ts.
 *
 * Run: pnpm test:cli:integration   (needs DATABASE_URL; ALLOW_UNSAFE_INTEGRATION_DB=1
 * to target a non-"*test*" database such as the shared Neon dev DB).
 */
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  captureConsole,
  clearAccountEnv,
  cleanupAccounts,
  createAccount,
  createProjectViaApi,
  db,
  disconnectDb,
  grantPro,
  installFetchShim,
  resetRateLimit,
  uninstallFetchShim,
  useAccountEnv,
  type TestAccount,
} from "./harness";

import { loginCommand } from "../../cli/src/commands/login";
import { projectCreateCommand } from "../../cli/src/commands/project";
import { projectsCommand } from "../../cli/src/commands/projects";
import { pushCommand } from "../../cli/src/commands/push";
import { pullCommand } from "../../cli/src/commands/pull";
import { filesCommand } from "../../cli/src/commands/files";
import { historyCommand } from "../../cli/src/commands/history";
import { restoreCommand } from "../../cli/src/commands/restore";
import { deleteCommand } from "../../cli/src/commands/delete";
import { statusCommand } from "../../cli/src/commands/status";
import { initCommand } from "../../cli/src/commands/init";
import { readCredentials, clearCredentials } from "../../cli/src/lib/config-dir";
import { ApiError } from "../../cli/src/lib/api-client";

const describeIf = process.env.DATABASE_URL ? describe : describe.skip;

/** A deliberately awkward .env: comment, quotes, CRLF, multiline, trailing space + no EOL newline. */
const TRICKY_ENV = Buffer.from(
  "# nvault harness fixture\r\n" +
    'DATABASE_URL="postgres://u:p@localhost:5432/db?ssl=true"\n' +
    "API_KEY = sk-test-do-not-log   \n" +
    'PEM="-----BEGIN KEY-----\\nline2\\n-----END KEY-----"\n' +
    "EMPTY=\n" +
    "# trailing content with no newline\n" +
    "LAST=value-without-final-newline",
  "utf8",
);

describeIf("nvault CLI ⇄ API (integration)", () => {
  let tmpDirs: string[] = [];
  let cwdBefore: string;
  let cc: ReturnType<typeof captureConsole>;

  const mkTmp = (): string => {
    const d = mkdtempSync(join(tmpdir(), "nvault-cli-it-"));
    tmpDirs.push(d);
    return d;
  };
  const chdir = (d: string) => process.chdir(d);

  beforeAll(() => {
    cwdBefore = process.cwd();
    // login writes here; keep it off the real user config dir.
    process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "nvault-cli-cfg-"));
    installFetchShim();
  });

  afterAll(async () => {
    uninstallFetchShim();
    process.chdir(cwdBefore);
    await cleanupAccounts();
    await disconnectDb();
    for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
    rmSync(process.env.XDG_CONFIG_HOME!, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await resetRateLimit();
    cc = captureConsole();
  });

  afterEach(() => {
    cc.restore();
    clearAccountEnv();
    clearCredentials();
    process.chdir(cwdBefore);
  });

  // ---------------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------------

  describe("login", () => {
    it("verifies the token against the API and writes 0600 credentials", async () => {
      const acct = await createAccount();
      clearAccountEnv(); // force the on-disk path

      await loginCommand({ apiUrl: "http://cli-harness.local", token: acct.pat });

      const creds = readCredentials();
      expect(creds).toEqual({
        apiBaseUrl: "http://cli-harness.local/api/v1",
        token: acct.pat,
        userEmail: acct.email,
      });
      const credPath = join(process.env.XDG_CONFIG_HOME!, "nvault", "credentials.json");
      expect((statSync(credPath).mode & 0o777).toString(8)).toBe("600");
      expect(cc.text()).toContain(`Logged in as ${acct.email}`);
    });

    it("rejects a syntactically wrong token before touching the network", async () => {
      await expect(
        loginCommand({ apiUrl: "http://cli-harness.local", token: "not-an-nvault-token" }),
      ).rejects.toThrow(/nvault access token/);
    });

    it("surfaces a friendly error for a revoked/invalid token (401)", async () => {
      await expect(
        loginCommand({ apiUrl: "http://cli-harness.local", token: "evk_deadbeefdeadbeefdeadbeef" }),
      ).rejects.toThrow(/rejected|revoked|expired/i);
      expect(readCredentials()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // projects
  // ---------------------------------------------------------------------------

  describe("projects", () => {
    it("`project create` then shows up in `projects`", async () => {
      const acct = await createAccount();
      useAccountEnv(acct);

      await projectCreateCommand("alpha-svc");
      cc.lines.length = 0;
      await projectsCommand();

      expect(cc.text()).toContain("alpha-svc");
      const row = await db.project.findFirst({ where: { name: "alpha-svc", ownerId: acct.userId } });
      expect(row).toBeTruthy();
    });

    it("Free account: CLI commands are refused without Pro", async () => {
      const acct = await createAccount(undefined, { pro: false });
      useAccountEnv(acct);

      await expect(projectCreateCommand("p1")).rejects.toMatchObject({
        name: "ApiError",
        status: 403,
      });
    });

    it("gives a clear error when an explicit project name doesn't exist", async () => {
      const acct = await createAccount();
      useAccountEnv(acct);
      await expect(filesCommand("ghost-project")).rejects.toThrow(/No project named "ghost-project"/);
    });
  });

  // ---------------------------------------------------------------------------
  // push / pull — byte preservation, backup-before-overwrite
  // ---------------------------------------------------------------------------

  describe("push / pull", () => {
    async function seededProject(): Promise<{ acct: TestAccount; project: string }> {
      const acct = await createAccount();
      useAccountEnv(acct);
      await projectCreateCommand("portfolio-analytics");
      return { acct, project: "portfolio-analytics" };
    }

    it("round-trips file bytes exactly (comments, quotes, CRLF, multiline, no final newline)", async () => {
      const { project } = await seededProject();

      const pushDir = mkTmp();
      writeFileSync(join(pushDir, ".env"), TRICKY_ENV);
      chdir(pushDir);
      await pushCommand(project, undefined, { yes: true });

      const pullDir = mkTmp();
      chdir(pullDir);
      await pullCommand(project, undefined, {});

      const pulled = readFileSync(join(pullDir, ".env"));
      expect(pulled.equals(TRICKY_ENV)).toBe(true);
    });

    it("auto-detects every .env* candidate in the working directory", async () => {
      const { project } = await seededProject();
      const dir = mkTmp();
      writeFileSync(join(dir, ".env"), "A=1\n");
      writeFileSync(join(dir, ".env.production"), "A=2\n");
      writeFileSync(join(dir, ".env.local"), "A=3\n");
      writeFileSync(join(dir, "notes.txt"), "ignored\n");
      chdir(dir);

      await pushCommand(project, undefined, { yes: true });

      cc.lines.length = 0;
      await filesCommand(project);
      const out = cc.text();
      expect(out).toContain(".env");
      expect(out).toContain(".env.production");
      expect(out).toContain(".env.local");
      expect(out).not.toContain("notes.txt");
    });

    it("refuses to push sensitive files non-interactively without --yes", async () => {
      const { project } = await seededProject();
      const dir = mkTmp();
      writeFileSync(join(dir, ".env"), "SECRET=x\n");
      chdir(dir);
      await expect(pushCommand(project, ".env", {})).rejects.toThrow(/non-interactive shell without --yes/);
    });

    it("backs up a differing local file before overwrite, and skips identical ones", async () => {
      const { project } = await seededProject();
      const pushDir = mkTmp();
      writeFileSync(join(pushDir, ".env"), "TOKEN=stored\n");
      chdir(pushDir);
      await pushCommand(project, undefined, { yes: true });

      const work = mkTmp();
      chdir(work);
      await pullCommand(project, undefined, {}); // first pull: clean write
      expect(readFileSync(join(work, ".env"), "utf8")).toBe("TOKEN=stored\n");

      // Local edit, then pull again → backup created, fresh copy written.
      writeFileSync(join(work, ".env"), "TOKEN=locally-changed\n");
      await pullCommand(project, undefined, { yes: true });
      const backups = readdirSync(work).filter((f) => f.startsWith(".env.bak."));
      expect(backups).toHaveLength(1);
      expect(readFileSync(join(work, backups[0]), "utf8")).toBe("TOKEN=locally-changed\n");
      expect(readFileSync(join(work, ".env"), "utf8")).toBe("TOKEN=stored\n");

      // Third pull, unchanged → no new backup.
      await pullCommand(project, undefined, {});
      expect(readdirSync(work).filter((f) => f.startsWith(".env.bak."))).toHaveLength(1);
    });

    it("the server only ever persists ciphertext (envelope-wrapped, no plaintext)", async () => {
      const { acct, project } = await seededProject();
      const dir = mkTmp();
      writeFileSync(join(dir, ".env"), "STRIPE_SECRET_KEY=sk_live_HARNESS_PLAINTEXT_MARKER\n");
      chdir(dir);
      await pushCommand(project, undefined, { yes: true });

      const row = await db.project.findFirstOrThrow({
        where: { name: project, ownerId: acct.userId },
      });
      const blob = await db.storageObject.findFirst({
        where: { key: { startsWith: `projects/${row.id}/` } },
      });
      expect(blob).toBeTruthy();
      expect(blob!.data[0]).toBe(1); // server envelope format-version prefix
      const asText = Buffer.from(blob!.data).toString("latin1");
      expect(asText).not.toContain("sk_live_HARNESS_PLAINTEXT_MARKER");
      expect(asText).not.toContain("STRIPE_SECRET_KEY");
    });
  });

  // ---------------------------------------------------------------------------
  // versioning: history / restore
  // ---------------------------------------------------------------------------

  describe("history / restore", () => {
    it("Free account: PAT-authenticated vault unlock is refused without Pro", async () => {
      const acct = await createAccount(undefined, { pro: false });
      useAccountEnv(acct);

      await expect(filesCommand("verproj")).rejects.toMatchObject({
        name: "ApiError",
        status: 403,
      });
    });

    it("Pro: `restore .env 1` re-publishes v1's bytes as a new version", async () => {
      const acct = await createAccount();
      useAccountEnv(acct);
      await projectCreateCommand("proproj");

      const dir = mkTmp();
      chdir(dir);
      const v1 = "STAGE=one\n";
      writeFileSync(join(dir, ".env"), v1);
      await pushCommand("proproj", ".env", { yes: true });
      writeFileSync(join(dir, ".env"), "STAGE=two\n");
      await pushCommand("proproj", ".env", { yes: true });
      writeFileSync(join(dir, ".env"), "STAGE=three\n");
      await pushCommand("proproj", ".env", { yes: true });

      cc.lines.length = 0;
      await restoreCommand(".env", "1", { project: "proproj" });
      expect(cc.text()).toMatch(/Restored v1 as new v4/);

      const outDir = mkTmp();
      chdir(outDir);
      await pullCommand("proproj", undefined, {});
      expect(readFileSync(join(outDir, ".env"), "utf8")).toBe(v1);
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  it("`delete <project> <file>` removes the file after confirmation bypass", async () => {
    const acct = await createAccount();
    useAccountEnv(acct);
    await projectCreateCommand("delproj");
    const dir = mkTmp();
    chdir(dir);
    writeFileSync(join(dir, ".env"), "X=1\n");
    await pushCommand("delproj", ".env", { yes: true });

    await deleteCommand("delproj", ".env", { yes: true });

    cc.lines.length = 0;
    await filesCommand("delproj");
    expect(cc.text()).toContain("No files yet.");
  });

  // ---------------------------------------------------------------------------
  // git-based project detection: init / status
  // ---------------------------------------------------------------------------

  describe("git detection", () => {
    const gitInit = (dir: string, remote: string) => {
      execFileSync("git", ["init", "-q"], { cwd: dir });
      execFileSync("git", ["remote", "add", "origin", remote], { cwd: dir });
    };

    it("`init` matches the repo by its origin remote and restores files", async () => {
      const remote = `https://github.com/harness/detect-${Date.now()}.git`;
      const acct = await createAccount();
      useAccountEnv(acct);
      const project = await createProjectViaApi(acct, "detected-app", { gitRemoteUrl: remote });

      // Seed a file into that project from a scratch dir.
      const seedDir = mkTmp();
      chdir(seedDir);
      writeFileSync(join(seedDir, ".env"), "DETECTED=yes\n");
      await pushCommand(project.name, ".env", { yes: true });

      // Fresh clone-like dir with the same remote, no project name passed.
      const repoDir = mkTmp();
      gitInit(repoDir, remote);
      chdir(repoDir);
      cc.lines.length = 0;
      await initCommand();

      expect(cc.text()).toContain(remote);
      expect(cc.text()).toContain("detected-app");
      expect(readFileSync(join(repoDir, ".env"), "utf8")).toBe("DETECTED=yes\n");
      // init offers to add .env to .gitignore (defaults yes in non-TTY).
      expect(readFileSync(join(repoDir, ".gitignore"), "utf8")).toContain(".env");
    });

    it("`status` compares local files to the stored version via remote match", async () => {
      const remote = `https://github.com/harness/status-${Date.now()}.git`;
      const acct = await createAccount();
      useAccountEnv(acct);
      const project = await createProjectViaApi(acct, "status-app", { gitRemoteUrl: remote });

      const dir = mkTmp();
      gitInit(dir, remote);
      chdir(dir);
      writeFileSync(join(dir, ".env"), "V=1\n");
      await pushCommand(project.name, ".env", { yes: true });

      cc.lines.length = 0;
      await statusCommand();
      expect(cc.text()).toMatch(/\.env.*up to date/s);

      writeFileSync(join(dir, ".env"), "V=2-locally\n");
      cc.lines.length = 0;
      await statusCommand();
      expect(cc.text()).toMatch(/\.env.*differs/s);
    });

    it("`init` outside a git repo exits cleanly with guidance", async () => {
      const acct = await createAccount();
      useAccountEnv(acct);
      const dir = mkTmp();
      chdir(dir);
      cc.lines.length = 0;
      await initCommand();
      expect(cc.text()).toMatch(/No git remote detected/);
    });
  });

  // ---------------------------------------------------------------------------
  // auth failures
  // ---------------------------------------------------------------------------

  it("a revoked token makes every authenticated command fail with 401", async () => {
    const acct = await createAccount();
    useAccountEnv(acct);
    await projectCreateCommand("willfail");

    // Revoke the PAT directly.
    await db.session.updateMany({
      where: { userId: acct.userId },
      data: { revokedAt: new Date() },
    });

    await expect(projectsCommand()).rejects.toMatchObject({ name: "ApiError", status: 401 });
  });

  it("ApiError is the typed failure the CLI surfaces (not a raw fetch/JSON error)", async () => {
    const acct = await createAccount();
    useAccountEnv(acct);
    const err = await filesCommand("nope").catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    // resolveProject throws a plain Error here; ApiError is used for transport-level failures.
    expect(err).not.toBeInstanceOf(ApiError);
  });
});
