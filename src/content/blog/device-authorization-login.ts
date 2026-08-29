import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "device-authorization-login",
  title: "Logging in without typing a password into your terminal",
  description:
    "Pasting your account password into a CLI is a bad habit with real consequences. The device authorization flow gives the terminal access without ever seeing your credentials.",
  date: "2026-08-06",
  author: "The nvault team",
  tags: ["cli", "security"],
  blocks: [
    {
      t: "p",
      c: "Prompting for a password in a CLI seems harmless. It is not, quite:",
    },
    {
      t: "ul",
      c: [
        "Passwords typed into a terminal can land in shell history, in scrollback, in a screen recording, or in a CI log.",
        "A CLI that handles your password is a much more attractive supply-chain target.",
        "It trains people to paste their most important credential into whatever asks for it.",
      ],
    },
    { t: "h2", c: "The device flow" },
    {
      t: "p",
      c: "Instead, `nvault login` uses a browser-based device authorization flow — the same pattern smart TVs use to sign you into streaming apps:",
    },
    {
      t: "code",
      lang: "text",
      c: "$ nvault login\n\nOpen:  https://app.nvault.dev/device\nCode:  X7KD-29PL\n\nWaiting for authentication...\n✓ Device authenticated",
    },
    {
      t: "ol",
      c: [
        "The CLI asks the server to start a device authorization and gets back a short user code.",
        "You open the URL in a browser — on the same machine or your phone — sign in there (where your password manager works), and enter the code.",
        "The CLI has been polling; once you approve, it receives its own tokens. Your password was never in the terminal.",
      ],
    },
    { t: "h2", c: "What the CLI stores" },
    {
      t: "p",
      c: "The result of login is a **short-lived access token** and a refresh token — not your password, and not your [vault passphrase](/blog/zero-knowledge-encryption-explained), which is a separate secret you still supply per session to unlock encryption. Those tokens go into OS-appropriate secure storage: Keychain on macOS, the Credential Manager on Windows, the Secret Service API on Linux where available. Not a world-readable file in your home directory.",
    },
    { t: "h2", c: "Revocation" },
    {
      t: "p",
      c: "Every device that logs in shows up in the web app as a session, with its last-seen time. You can revoke any one of them — or all sessions except the current one — and the tokens stop working immediately. A lost laptop is a two-click problem, not a password-reset scramble.",
    },
    {
      t: "note",
      c: "Access tokens are intentionally short-lived so that a leaked one has a small window. The refresh happens quietly in the background; you re-run `nvault login` only when a device is fully de-authorised.",
    },
    {
      t: "quote",
      c: "The safest place to type your password is the one place already built to handle it: the browser, with your password manager.",
    },
  ],
};
