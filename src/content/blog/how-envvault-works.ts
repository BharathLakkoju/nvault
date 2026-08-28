import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "how-envvault-works",
  title: "How EnvVault works, end to end",
  description:
    "Follow a single .env file from your editor to storage and back: what the browser does, what the API sees, and why the server can hold your secrets without being able to read them.",
  date: "2026-06-18",
  author: "The EnvVault team",
  tags: ["architecture", "security"],
  blocks: [
    {
      t: "p",
      c: "EnvVault has two surfaces — a [web app](/features) and a [CLI](/cli) — backed by one API and one data model. This post traces what happens to a file when you push it, and what happens when you pull it back.",
    },
    { t: "h2", c: "1. Unlock" },
    {
      t: "p",
      c: "Everything starts with your **vault passphrase**. It is never sent anywhere. In the browser (or the CLI process), it is run through PBKDF2-HMAC-SHA256 with a large iteration count and a random per-user salt to derive a Key Encryption Key. That KEK unwraps your **master key**, a random 256-bit value generated once at signup and stored server-side only in wrapped form.",
    },
    { t: "h2", c: "2. Encrypt" },
    {
      t: "p",
      c: "Each project has its own random **data key**, wrapped by the master key. When you push `.env`, the client:",
    },
    {
      t: "ol",
      c: [
        "Reads the file as raw bytes — no parsing, no normalisation. See [Why we never parse your .env file](/blog/why-we-never-parse-your-env-file).",
        "Encrypts those bytes with AES-256-GCM under the project data key, binding a content identifier as additional authenticated data.",
        "Uploads the ciphertext plus non-secret metadata: the file name, a size, a version marker.",
      ],
    },
    {
      t: "note",
      c: "Every wrap and encrypt step binds an identifier as AEAD additional authenticated data, so a ciphertext or wrapped key cannot be silently moved onto a different record without the tag check failing.",
    },
    { t: "h2", c: "3. Store" },
    {
      t: "p",
      c: "The API receives an opaque blob. Before it writes the blob to Postgres, the server encrypts it **again** under a key that lives only in the deployment environment, never in the database. This is the defense-in-depth layer covered in [Defense in depth: the second encryption layer](/blog/defense-in-depth-envelope-encryption). Relational metadata — users, projects, file names, version timestamps — lives in Postgres; the encrypted blobs are stored as objects.",
    },
    { t: "h2", c: "4. Pull" },
    {
      t: "p",
      c: "Restoring is the same path in reverse. The API decrypts its storage layer and returns the client ciphertext. The client unwraps the project key with the master key, decrypts the file, and writes it to disk — **with a confirmation prompt before overwriting anything that already exists**, and a backup of the previous contents.",
    },
    { t: "h2", c: "What each party can see" },
    {
      t: "ul",
      c: [
        "**Your browser / CLI:** everything — it holds the keys for the duration of the session.",
        "**The API:** file names, sizes, project structure, who owns what, and when things changed. Never plaintext values, never the passphrase, never an unwrapped key.",
        "**The database:** doubly-encrypted blobs and metadata. A dump on its own is inert.",
      ],
    },
    { t: "h2", c: "Why it is built this way" },
    {
      t: "p",
      c: "The design goal is that compromising the server should not compromise your secrets. Keeping encryption on the client and adding an independent server-side layer means an attacker needs the passphrase *and* the deployment's environment key *and* the data — three things that never sit together. We go deeper on the reasoning in [Why we encrypt on the client, not the server](/blog/client-side-vs-server-side-encryption).",
    },
  ],
};
