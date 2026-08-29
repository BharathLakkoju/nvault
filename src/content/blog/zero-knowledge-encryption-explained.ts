import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "zero-knowledge-encryption-explained",
  title: "Zero-knowledge encryption, explained for developers",
  description:
    "What \"the server can't read your data\" actually means: key derivation, key wrapping, AEAD, and the specific hierarchy nvault uses to make it true.",
  date: "2026-06-25",
  author: "The nvault team",
  tags: ["security", "cryptography"],
  blocks: [
    {
      t: "p",
      c: "\"Zero-knowledge\" is an overloaded phrase. In nvault's case it has a precise, checkable meaning: the server never holds the information needed to decrypt your files. Here is how that is arranged.",
    },
    { t: "h2", c: "Passwords are not keys" },
    {
      t: "p",
      c: "A passphrase is low-entropy and human-chosen; an encryption key needs to be high-entropy and uniform. You bridge the gap with a **key derivation function**. nvault uses PBKDF2-HMAC-SHA256 with a large iteration count and a random 128-bit salt per user. The iteration count is stored per user, so it can be raised over time without breaking existing vaults — re-derivation just happens on the next unlock.",
    },
    {
      t: "code",
      lang: "text",
      c: "vault passphrase\n   │  PBKDF2-HMAC-SHA256 (many iterations, random salt)\n   ▼\nKey Encryption Key (KEK)   — derived fresh on every unlock, never stored",
    },
    { t: "h2", c: "Key wrapping: a chain, not a single key" },
    {
      t: "p",
      c: "If the passphrase directly encrypted every file, changing it would mean re-encrypting everything. Instead the KEK only ever encrypts (\"wraps\") the next key down:",
    },
    {
      t: "code",
      lang: "text",
      c: "KEK  ──wrap──▶  Master Key      (one per account, random 256-bit)\nMaster Key  ──wrap──▶  Project Key  (one per project, random 256-bit)\nProject Key  ──encrypt──▶  file version ciphertext",
    },
    {
      t: "p",
      c: "The server stores the master key and project keys **only in wrapped form** (`wrappedMasterKey`, `wrappedProjectKey`). Without the KEK — which requires the passphrase — they are meaningless bytes. Changing your passphrase re-wraps one key, not your whole history.",
    },
    { t: "h2", c: "AEAD and bound identifiers" },
    {
      t: "p",
      c: "Every encryption step uses AES-256-GCM, an **authenticated** cipher: decryption fails loudly if the ciphertext was tampered with. nvault also passes an identifier as *additional authenticated data* at each step — `\"master-key\"`, `\"project:<id>\"`, `\"<contentId>\"`. The identifier is not secret, but it is covered by the authentication tag, so a blob encrypted for one record cannot be silently swapped onto another; the tag check fails.",
    },
    { t: "h2", c: "What this buys you" },
    {
      t: "ul",
      c: [
        "A database dump reveals metadata and doubly-encrypted blobs — no secrets. (There is a [second server-side layer](/blog/defense-in-depth-envelope-encryption) on top of this.)",
        "A malicious or compelled operator cannot produce plaintext they never had the keys for.",
        "A bug that logs a request body logs ciphertext, not secrets.",
      ],
    },
    { t: "h2", c: "The honest cost" },
    {
      t: "note",
      c: "There is no \"forgot passphrase\" link, because there is nothing on our side to reset. If the passphrase is lost, the data wrapped under it is unrecoverable. Use a password manager, and keep offline backups of anything you truly cannot lose. This is the deliberate trade for data this sensitive — see [Our threat model](/blog/our-threat-model).",
    },
  ],
};
