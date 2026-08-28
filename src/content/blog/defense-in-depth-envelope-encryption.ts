import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "defense-in-depth-envelope-encryption",
  title: "Defense in depth: the second encryption layer",
  description:
    "The browser already encrypts your files. So why does the server encrypt them again before writing to Postgres? Because a database dump should be worth nothing.",
  date: "2026-07-09",
  author: "The EnvVault team",
  tags: ["security", "architecture"],
  blocks: [
    {
      t: "p",
      c: "EnvVault's client-side encryption means the ciphertext that reaches the API is already unreadable without your passphrase. We could store that blob directly. We don't. Every blob is encrypted a second time on the server before it touches the database.",
    },
    { t: "h2", c: "The layer" },
    {
      t: "code",
      lang: "text",
      c: "client ciphertext\n   ──▶ AES-256-GCM( key = STORAGE_ENCRYPTION_KEY, AAD = storage key )\n   ──▶ [version:1][iv:12][gcmTag:16][ciphertext]  ──▶ storage_objects.data",
    },
    {
      t: "p",
      c: "`STORAGE_ENCRYPTION_KEY` is a 32-byte key that lives only in the deployment's environment — a secrets manager, a platform environment variable — and **never in the database**. The blob format is versioned so the scheme can evolve without making old data unreadable.",
    },
    { t: "h2", c: "What it defends against" },
    {
      t: "ul",
      c: [
        "**A stolen database dump.** The most common real-world exposure. On its own it now contains only doubly-encrypted blobs and metadata — the server key is not in it, and neither is your passphrase.",
        "**A read-only SQL injection or backup misconfiguration.** Same result: no usable data.",
        "**Accidental replication to the wrong place.** A copied database is inert without the environment key.",
      ],
    },
    { t: "h2", c: "What it does not do" },
    {
      t: "p",
      c: "This layer is not a substitute for client-side encryption, and we are careful not to describe it as one. If an attacker has **both** the database and the running server's environment, this layer is defeated — but they still only have your client ciphertext, which is useless without your passphrase. The two layers protect against different attackers:",
    },
    {
      t: "ul",
      c: [
        "Client layer → protects against us, and against anyone who compromises the server.",
        "Server layer → protects against anyone who gets the data but not the live environment.",
      ],
    },
    {
      t: "quote",
      c: "Layers are valuable when each one fails independently. A database leak and an environment-variable leak are different incidents with different causes.",
    },
    { t: "h2", c: "Key rotation" },
    {
      t: "note",
      c: "Rotating `STORAGE_ENCRYPTION_KEY` naively would make existing blobs unreadable, so it is treated as a permanent per-environment secret. A safe rotation path re-encrypts stored objects under the new key as a migration; the versioned blob header exists precisely so that can be done incrementally.",
    },
    {
      t: "p",
      c: "The short version: your data is encrypted by you, and then encrypted again by us, with keys that live in different places and leak for different reasons.",
    },
  ],
};
