import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "roadmap-nvault-run",
  title: "The road to nvault run: secrets without a file on disk",
  description:
    "The safest .env file is the one that never exists. nvault run will fetch, decrypt, and inject configuration straight into a process. Here is where it fits.",
  date: "2026-08-27",
  author: "The nvault team",
  tags: ["cli", "roadmap"],
  blocks: [
    {
      t: "p",
      c: "Everything nvault does today assumes your project ultimately wants a `.env` file on disk. We store it encrypted, version it, and restore it safely — but at the end there is still a plaintext file sitting in your working directory.",
    },
    {
      t: "p",
      c: "For a lot of workflows that file is unnecessary. Your process needs the values in its environment; it does not need them written down. That is what `nvault run` is for.",
    },
    { t: "h2", c: "The idea" },
    {
      t: "code",
      lang: "bash",
      c: "nvault run -- npm run dev\nnvault run -- pytest\nnvault run --project portfolio-analytics -- ./deploy.sh",
    },
    {
      t: "ol",
      c: [
        "The CLI resolves the project (Git remote or explicit flag) and fetches the encrypted config.",
        "It decrypts in memory, using the vault passphrase for the session.",
        "It spawns the child process with those values in its environment, streams through stdio, and forwards the exit code.",
        "When the process exits, the secrets leave with it. Nothing was written to disk.",
      ],
    },
    { t: "h2", c: "Why it is a differentiator" },
    {
      t: "ul",
      c: [
        "**No file to leak.** The most common exposure path — a committed or copied `.env` — is not available if there is no `.env`.",
        "**No stale config.** The process always gets the current version from the vault; there is no local copy to drift.",
        "**CI-friendly.** A runner fetches secrets for exactly one command and never persists them into the workspace.",
      ],
    },
    { t: "h2", c: "What we are being careful about" },
    {
      t: "p",
      c: "Injecting secrets into a process is a sharp tool, and we would rather ship it right than ship it early:",
    },
    {
      t: "ul",
      c: [
        "Child environments are readable by that process and its descendants — `nvault run` is not a sandbox, and we will document exactly what it does and does not isolate.",
        "On some platforms a process's environment is visible to other processes of the same user; the docs will be explicit about that.",
        "It must fail closed: if decryption or fetch fails, the command does not run with partial or empty config.",
        "It must not leak values into its own logs, error messages, or crash output.",
      ],
    },
    { t: "h2", c: "Where it sits on the roadmap" },
    {
      t: "note",
      c: "Order of operations: stabilise the core vault (done for the web app, in progress for the [CLI](/cli)), then device-flow login and push/pull, then `nvault run`. Team sharing, RBAC, and secret rotation come after that. We are keeping the MVP focused on purpose — see [Why we built nvault](/blog/why-we-built-nvault).",
    },
    {
      t: "quote",
      c: "The endgame is that \"where is the .env file\" stops being a question you ever have to answer.",
    },
  ],
};
