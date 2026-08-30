/**
 * CLI ⇄ API integration for `nvault run -- <cmd>` — the zero-disk-footprint
 * path. `node:child_process.spawn` is stubbed so the injected environment can
 * be inspected and the process-exit handoff driven synchronously; every other
 * layer (API, Postgres, client-side decrypt, dotenv parse) is real.
 */
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

jest.mock("node:child_process", () => {
  const actual = jest.requireActual("node:child_process");
  return { ...actual, spawn: jest.fn() };
});
import { spawn } from "node:child_process";

import {
  captureConsole,
  cleanupAccounts,
  clearAccountEnv,
  createAccount,
  disconnectDb,
  installFetchShim,
  resetRateLimit,
  uninstallFetchShim,
  useAccountEnv,
} from "./harness";
import { projectCreateCommand } from "../../cli/src/commands/project";
import { pushCommand } from "../../cli/src/commands/push";
import { runCommand } from "../../cli/src/commands/run";

const describeIf = process.env.DATABASE_URL ? describe : describe.skip;
const spawnMock = spawn as unknown as jest.Mock;

class ExitError extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`);
  }
}

describeIf("nvault run (integration)", () => {
  let cwdBefore: string;
  const tmpDirs: string[] = [];
  let cc: ReturnType<typeof captureConsole>;
  let exitSpy: jest.SpyInstance;

  beforeAll(() => {
    cwdBefore = process.cwd();
    installFetchShim();
  });

  afterAll(async () => {
    uninstallFetchShim();
    process.chdir(cwdBefore);
    await cleanupAccounts();
    await disconnectDb();
    for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await resetRateLimit();
    cc = captureConsole();
    spawnMock.mockReset();
    exitSpy = jest
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        throw new ExitError(code ?? 0);
      }) as never);
  });

  afterEach(() => {
    cc.restore();
    exitSpy.mockRestore();
    clearAccountEnv();
    process.chdir(cwdBefore);
  });

  const mkTmp = (): string => {
    const d = mkdtempSync(join(tmpdir(), "nvault-run-it-"));
    tmpDirs.push(d);
    return d;
  };

  /**
   * Drives runCommand up to the point it calls the (mocked) spawn. Returns the
   * fake child + the spawn call args. Surfaces any real rejection from the
   * async chain instead of hiding it.
   */
  async function driveToSpawn(project: string, parts: string[]) {
    const child = new EventEmitter();
    spawnMock.mockReturnValue(child);

    let rejection: unknown;
    let settled = false;
    // runCommand's returned promise only settles via process.exit; we watch for
    // an *early* rejection (auth/decrypt failure) so the test fails loudly.
    void runCommand(project, parts).then(
      () => {
        settled = true;
      },
      (err) => {
        rejection = err;
        settled = true;
      },
    );

    // The chain does real remote-Postgres round trips; wait in wall-clock time,
    // not micro-task ticks.
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (spawnMock.mock.calls.length > 0 || (settled && rejection)) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    if (rejection) throw rejection;
    if (spawnMock.mock.calls.length === 0) {
      throw new Error("runCommand never reached spawn() and did not reject within 30s");
    }
    const [command, args, options] = spawnMock.mock.calls[0];
    return { child, command, args, options };
  }

  it("injects decrypted vars into the child env and never writes a file", async () => {
    const acct = await createAccount();
    useAccountEnv(acct);
    await projectCreateCommand("runproj");

    const dir = mkTmp();
    writeFileSync(
      join(dir, ".env"),
      'INJECTED_TOKEN="top-secret-value"\nPEM_KEY="line1\\nline2"\nPORT=4599\n',
    );
    process.chdir(dir);
    await pushCommand("runproj", ".env", { yes: true });

    const { child, args, options } = await driveToSpawn("runproj", ["mycmd", "arg1"]);

    expect(args).toEqual(["arg1"]);
    expect(options.env.INJECTED_TOKEN).toBe("top-secret-value");
    expect(options.env.PEM_KEY).toBe("line1\nline2");
    expect(options.env.PORT).toBe("4599");
    expect(options.stdio).toBe("inherit");
    expect(cc.text()).toMatch(/Injecting: \.env/);

    // Child exits 0 → the CLI mirrors the code via process.exit (our spy throws).
    expect(() => child.emit("exit", 0, null)).toThrow(ExitError);
  });

  it("mirrors a non-zero child exit code", async () => {
    const acct = await createAccount();
    useAccountEnv(acct);
    await projectCreateCommand("runproj2");
    const dir = mkTmp();
    writeFileSync(join(dir, ".env"), "A=1\n");
    process.chdir(dir);
    await pushCommand("runproj2", ".env", { yes: true });

    const { child } = await driveToSpawn("runproj2", ["cmd"]);

    let caught: unknown;
    try {
      child.emit("exit", 37, null);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ExitError);
    expect((caught as ExitError).code).toBe(37);
  });

  it("errors when no command is given after --", async () => {
    const acct = await createAccount();
    useAccountEnv(acct);
    await expect(runCommand("whatever", [])).rejects.toThrow(/Usage: nvault run/);
  });
});
