import { EventEmitter } from "node:events";

jest.mock("node:child_process", () => {
  const actual = jest.requireActual("node:child_process");
  return { ...actual, spawn: jest.fn() };
});
jest.mock("../lib/resolve-project", () => ({ resolveProject: jest.fn() }));
jest.mock("../lib/vault-session", () => ({ unlockVaultForThisCommand: jest.fn() }));
jest.mock("../lib/project-key", () => ({ resolveProjectKey: jest.fn() }));
jest.mock("../lib/api-client", () => ({ apiRequest: jest.fn() }));
jest.mock("../lib/vault-client", () => ({
  decryptFile: jest.fn(),
  bytesToUtf8: (b: Uint8Array) => new TextDecoder().decode(b),
}));

import { spawn } from "node:child_process";
import { runCommand } from "./run";
import { resolveProject } from "../lib/resolve-project";
import { unlockVaultForThisCommand } from "../lib/vault-session";
import { resolveProjectKey } from "../lib/project-key";
import { apiRequest } from "../lib/api-client";
import { decryptFile } from "../lib/vault-client";
import type { ProjectDto } from "../lib/types";

const spawnMock = spawn as jest.MockedFunction<typeof spawn>;
const resolveProjectMock = resolveProject as jest.MockedFunction<typeof resolveProject>;
const unlockMock = unlockVaultForThisCommand as jest.MockedFunction<typeof unlockVaultForThisCommand>;
const projectKeyMock = resolveProjectKey as jest.MockedFunction<typeof resolveProjectKey>;
const apiRequestMock = apiRequest as jest.MockedFunction<typeof apiRequest>;
const decryptFileMock = decryptFile as jest.MockedFunction<typeof decryptFile>;

const PROJECT = { id: "proj-1", name: "demo" } as ProjectDto;
const SESSION = { masterKey: new Uint8Array(32), privateKey: new Uint8Array(32), email: "u@x.com" };

function mockFilesList(files: Array<{ id: string; filename: string; currentVersion: { id: string } | null }>) {
  apiRequestMock.mockImplementation(async (path: string) => {
    if (path === `/projects/${PROJECT.id}/files`) {
      return { files };
    }
    if (path.startsWith(`/projects/${PROJECT.id}/files/`)) {
      return { payload: new Uint8Array() };
    }
    throw new Error(`unexpected apiRequest: ${path}`);
  });
}

describe("runCommand", () => {
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    resolveProjectMock.mockResolvedValue(PROJECT);
    unlockMock.mockResolvedValue(SESSION);
    projectKeyMock.mockResolvedValue(new Uint8Array(32));
    exitSpy = jest.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  it("errors when no command is given", async () => {
    await expect(runCommand("demo", [])).rejects.toThrow(/Usage: nvault run/);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("refuses when the project cannot be resolved", async () => {
    resolveProjectMock.mockRejectedValue(
      new Error("Couldn't determine which project to use (no matching git remote). Pass a project name explicitly."),
    );

    await expect(runCommand(undefined, ["node", "-e", "0"])).rejects.toThrow(/Couldn't determine which project/);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("refuses when the project has no dotenv-style files", async () => {
    mockFilesList([{ id: "f1", filename: "README.md", currentVersion: { id: "v1" } }]);

    await expect(runCommand("demo", ["node", "-e", "0"])).rejects.toThrow(/No dotenv-style environment files/);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("refuses when dotenv files exist but define no variables", async () => {
    mockFilesList([{ id: "f1", filename: ".env", currentVersion: { id: "v1" } }]);
    decryptFileMock.mockResolvedValue(new TextEncoder().encode("# comments only\n\n"));

    await expect(runCommand("demo", ["node", "-e", "0"])).rejects.toThrow(/No environment variables to inject/);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("refuses when fetching file metadata fails", async () => {
    apiRequestMock.mockRejectedValue(new Error("network down"));

    await expect(runCommand("demo", ["node", "-e", "0"])).rejects.toThrow(/network down/);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("refuses when decryption fails without leaking decrypted values in stderr", async () => {
    mockFilesList([{ id: "f1", filename: ".env", currentVersion: { id: "v1" } }]);
    decryptFileMock.mockRejectedValue(new Error("Could not decrypt file (authentication tag mismatch)"));

    const stderrSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(runCommand("demo", ["node", "-e", "0"])).rejects.toThrow(/Could not decrypt file/);
    expect(spawnMock).not.toHaveBeenCalled();
    expect(stderrSpy.mock.calls.flat().join("\n")).not.toMatch(/injected|SECRET|TOKEN=/);

    stderrSpy.mockRestore();
  });

  it("injects decrypted vars and forwards a non-zero child exit code", async () => {
    mockFilesList([{ id: "f1", filename: ".env", currentVersion: { id: "v1" } }]);
    decryptFileMock.mockResolvedValue(new TextEncoder().encode('TOKEN="injected"\n'));

    const child = new EventEmitter();
    spawnMock.mockReturnValue(child as ReturnType<typeof spawn>);

    void runCommand("demo", ["mycmd", "arg"]);
    await new Promise((r) => setImmediate(r));

    expect(spawnMock).toHaveBeenCalledWith(
      expect.any(String),
      ["arg"],
      expect.objectContaining({
        env: expect.objectContaining({ TOKEN: "injected" }),
      }),
    );

    child.emit("exit", 42, null);
    expect(exitSpy).toHaveBeenCalledWith(42);
  });
});
