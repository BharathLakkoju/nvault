import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "the-cli-is-a-product",
  title: "The CLI is a product, not an afterthought",
  description:
    "A lot of developer tools ship a thin API wrapper and call it a CLI. For nvault the terminal is a first-class surface, because that is where the hard use cases live.",
  date: "2026-07-30",
  author: "The nvault team",
  tags: ["cli", "developer-experience"],
  blocks: [
    {
      t: "p",
      c: "The web app is the right place to browse projects, review version history, and manage devices. But the moment you actually need your environment restored, you are often somewhere a browser is a nuisance: an SSH session into a remote box, a fresh WSL install, a container, a CI job.",
    },
    {
      t: "p",
      c: "That is the CLI's job, and it is why we treat it as a product with its own design goals rather than a generated client.",
    },
    { t: "h2", c: "What \"first-class\" means here" },
    {
      t: "ul",
      c: [
        "**Runs where you actually are.** Windows, macOS, Linux, WSL, SSH, cloud VMs, CI. No assumption that a GUI or a browser is reachable.",
        "**Authenticates without a password in the terminal.** A device-code flow you approve in a browser on any device — see [Logging in without typing a password into your terminal](/blog/device-authorization-login).",
        "**Stores credentials in the OS keychain**, not a plaintext dotfile.",
        "**Explains itself.** Project detection tells you which Git remote matched which project, so it is never magic — see [Finding the right project from your Git remote](/blog/project-detection-from-git).",
        "**Is scriptable.** Meaningful exit codes, a non-interactive mode, output that is readable and greppable.",
        "**Never overwrites local files silently.** A prompt and a backup, always.",
      ],
    },
    { t: "h2", c: "One domain model, two surfaces" },
    {
      t: "p",
      c: "The CLI and the web app talk to the same versioned API and share the same validation and crypto primitives. That is a deliberate constraint: business logic is not allowed to live in one surface and not the other. A file pushed from the CLI is indistinguishable from one pushed via the web, because the same code encrypted it.",
    },
    {
      t: "quote",
      c: "If the CLI and the web app can disagree about what a \"project\" is, you have two products and a support problem.",
    },
    { t: "h2", c: "The workflow we are optimising for" },
    {
      t: "code",
      lang: "bash",
      c: "git clone git@github.com:acme/portfolio-analytics.git\ncd portfolio-analytics\nnvault init      # detects the repo, matches the project\nnvault pull      # restores .env, .env.local, .env.production",
    },
    {
      t: "p",
      c: "Four commands from nothing to a working environment on a new machine. Getting that to feel effortless — and safe — is the whole point.",
    },
    {
      t: "note",
      c: "The CLI is in preview. The [CLI page](/cli) has installation steps and an interactive walkthrough of each command.",
    },
  ],
};
