import { hostname } from "node:os";
import { spawn } from "node:child_process";
import { publicRequest, ApiError } from "../lib/api-client";
import { writeCredentials } from "../lib/config-dir";
import { color, symbols } from "../lib/colors";

interface DeviceStartResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresInSeconds: number;
  pollIntervalSeconds: number;
}

interface DeviceTokenResponse {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  user: { email: string };
}

function tryOpenBrowser(url: string): void {
  try {
    const child =
      process.platform === "darwin"
        ? spawn("open", [url], { stdio: "ignore", detached: true })
        : process.platform === "win32"
          ? spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true })
          : spawn("xdg-open", [url], { stdio: "ignore", detached: true });
    // spawn() reports a missing binary (e.g. no `xdg-open` over SSH/in a
    // container) asynchronously via this event, not by throwing — without
    // this handler it would crash the whole process.
    child.on("error", () => {});
    child.unref();
  } catch {
    // Best effort only — printing the URL above is the reliable fallback,
    // e.g. over SSH where there's no local browser to open at all.
  }
}

export async function loginCommand(): Promise<void> {
  const apiBaseUrl = process.env.ENVVAULT_API_URL ?? "http://localhost:4000/api/v1";
  const start = await publicRequest<DeviceStartResponse>("/auth/device/start", {
    method: "POST",
    body: { deviceName: hostname() },
  });

  const completeUrl = `${start.verificationUri}?user_code=${encodeURIComponent(start.userCode)}`;
  console.log(`\nOpen:\n${color.cyan(completeUrl)}\n`);
  console.log(`Enter code:\n${color.bold(start.userCode)}\n`);
  tryOpenBrowser(completeUrl);
  process.stdout.write("Waiting for authentication...");

  let pollIntervalMs = start.pollIntervalSeconds * 1000;
  const deadline = Date.now() + start.expiresInSeconds * 1000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    try {
      const result = await publicRequest<DeviceTokenResponse>("/auth/device/token", {
        method: "POST",
        body: { deviceCode: start.deviceCode },
      });
      writeCredentials({
        apiBaseUrl,
        accessToken: result.accessToken,
        accessTokenExpiresAt: new Date(Date.now() + result.accessTokenExpiresInSeconds * 1000).toISOString(),
        refreshToken: result.refreshToken,
        userEmail: result.user.email,
      });
      console.log(`\n\n${symbols.check} Device authenticated\n`);
      console.log(`Logged in as ${result.user.email}`);
      return;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "authorization_pending") {
          process.stdout.write(".");
          continue;
        }
        if (err.code === "slow_down") {
          pollIntervalMs += 2000;
          continue;
        }
        if (err.code === "access_denied") {
          throw new Error("\n\nLogin was denied.");
        }
        if (err.code === "expired_token") {
          throw new Error("\n\nThat login code expired. Please run `envvault login` again.");
        }
      }
      throw err;
    }
  }
  throw new Error("\n\nLogin timed out. Please run `envvault login` again.");
}
