import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "why-we-built-envvault",
  title: "Why we built EnvVault",
  description:
    "Every team has a private ritual for moving .env files between machines. It is always insecure, and it always breaks. Here is the problem we set out to fix.",
  date: "2026-06-04",
  author: "The EnvVault team",
  tags: ["product", "background"],
  blocks: [
    {
      t: "p",
      c: "Ask any developer how they get a project's environment variables onto a new laptop and you will hear a confession. Someone pastes the `.env` into a Slack DM. Someone emails a `.env.production` to the new hire. Someone keeps the real values in a pinned message, a shared note, a password manager entry that is three months stale, or a USB stick in a drawer.",
    },
    {
      t: "p",
      c: "It works, right up until it doesn't. A key rotates and nobody updates the note. A value is missing and local dev fails with an error three layers deep. The file lands in a Git commit it should never have touched. A laptop is lost and nobody is quite sure what was on it.",
    },
    { t: "h2", c: "Configuration is sensitive data that moves" },
    {
      t: "p",
      c: "Environment files hold the crown jewels: `DATABASE_URL`, `STRIPE_SECRET_KEY`, `AWS_ACCESS_KEY`, `JWT_SECRET`, `OPENAI_API_KEY`. They are also **living documents**. They change every time you add a service, rotate a credential, or spin up a new environment. And they need to exist on every machine where the project runs — your laptop, your teammate's, a remote box, CI.",
    },
    {
      t: "p",
      c: "So you have data that is both highly sensitive and constantly in motion, and the tools most teams reach for are a chat app and a text file. That gap is the entire reason EnvVault exists.",
    },
    { t: "h2", c: "What we wanted instead" },
    {
      t: "ul",
      c: [
        "**Store it once.** One place that holds the current environment for each project, with history.",
        "**Restore it anywhere.** Clone the repo on a new machine, run one command, and the files are back — exactly as they were.",
        "**Trust no server.** The service that stores your secrets should not be able to read them. Not our staff, not a stolen database dump, not a subpoena.",
        "**Feel native.** A web app for managing projects, and a CLI that works over SSH and in WSL where a browser is a hassle.",
      ],
    },
    {
      t: "p",
      c: "The positioning we kept coming back to was not \"cloud storage for .env files.\" It was **your development environment, available anywhere** — a vault built around how config actually behaves, not a generic file bucket with a developer skin.",
    },
    { t: "h2", c: "The non-negotiable: zero knowledge" },
    {
      t: "p",
      c: "The first architectural decision was that encryption happens in your browser, before anything is uploaded. The server stores ciphertext and wrapped keys. It never sees a plaintext value and never sees the passphrase that would unlock one. We cover the mechanics in [How EnvVault works, end to end](/blog/how-envvault-works) and [Zero-knowledge encryption, explained for developers](/blog/zero-knowledge-encryption-explained).",
    },
    {
      t: "note",
      c: "The trade-off of zero knowledge is real: if you lose your vault passphrase, we cannot reset it, because we never had it. Keep it in a password manager. We think that is the right trade for data this sensitive.",
    },
    { t: "h2", c: "Where we are" },
    {
      t: "p",
      c: "The web application is live: authentication, projects, uploads and downloads, version history, and restore. The [CLI](/cli) is in preview, and the API is already shaped so it can grow without server changes. Further out is `envvault run`, which injects secrets straight into a process so a `.env` file never has to touch disk — more on that in [The road to envvault run](/blog/roadmap-envvault-run).",
    },
    {
      t: "p",
      c: "If you have ever pasted a secret into a chat window and felt a little bad about it, this one is for you.",
    },
  ],
};
