import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "versioning-environment-files",
  title: "Versioning environment files, and why it matters",
  description:
    "Config changes are the invisible cause of half of \"it works on my machine.\" Treating every .env change as a version turns a debugging session into a diff.",
  date: "2026-07-16",
  author: "The EnvVault team",
  tags: ["product", "developer-experience"],
  blocks: [
    {
      t: "p",
      c: "Your source code is versioned. Your infrastructure is versioned. Your database schema is versioned. Your environment configuration — the thing most likely to differ between two machines and break one of them — usually is not.",
    },
    { t: "h2", c: "The failure mode" },
    {
      t: "p",
      c: "A teammate says local dev is broken. You compare notes. Eventually someone realises a `FEATURE_FLAG_X` was added to the shared config last Tuesday and never made it to their `.env`. Or a `REDIS_URL` was changed to point at a new instance and the old one still works just well enough to be confusing.",
    },
    {
      t: "p",
      c: "There is no artifact to look at. No history. Just two files that are almost the same and a slow process of elimination.",
    },
    { t: "h2", c: "Every push is a version" },
    {
      t: "p",
      c: "In EnvVault, each time you push a file it becomes a new, immutable version with its own metadata — when it was created, how large it is, which version is current. Nothing is overwritten in place. That gives you:",
    },
    {
      t: "ul",
      c: [
        "**A timeline.** \"This file changed on the 14th\" is often the whole answer.",
        "**Recovery.** Download an earlier version, or promote it back to current in one action, when a change turns out to be wrong.",
        "**Confidence to edit.** You can change a value knowing the previous one is not gone.",
      ],
    },
    { t: "h2", c: "Why not just diff the values?" },
    {
      t: "p",
      c: "Because the values are secrets, and EnvVault is [zero-knowledge](/blog/zero-knowledge-encryption-explained) — the server cannot compute a diff it cannot read. Version comparison happens on the client, where the data is decrypted, and only for you. The server's job is to store each encrypted version faithfully and never lose one.",
    },
    {
      t: "note",
      c: "Older encrypted versions stay readable. We treat backwards compatibility of stored data as a hard rule: a format change must never strand a version you might need to restore.",
    },
    { t: "h2", c: "The mental model" },
    {
      t: "quote",
      c: "Config is code that happens to live outside your repo. It deserves the same undo button.",
    },
    {
      t: "p",
      c: "Once environment files have history, a category of \"why is this broken\" questions stops being an investigation and starts being a lookup.",
    },
  ],
};
