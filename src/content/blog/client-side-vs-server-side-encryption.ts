import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "client-side-vs-server-side-encryption",
  title: "Why we encrypt on the client, not the server",
  description:
    "Server-side encryption is easier to build and easier to use. We still chose client-side. Here is the threat model that made the decision for us.",
  date: "2026-07-02",
  author: "The nvault team",
  tags: ["security", "architecture"],
  blocks: [
    {
      t: "p",
      c: "Most \"encrypted\" storage products encrypt on the server. The data arrives in plaintext over TLS, the server encrypts it at rest, and the server holds the key. It is simple, it is fast, and for a lot of data it is completely reasonable.",
    },
    {
      t: "p",
      c: "For a vault whose entire contents are production credentials, it is not enough. Here is why.",
    },
    { t: "h2", c: "Server-side encryption protects against one thing" },
    {
      t: "p",
      c: "It protects against **theft of the storage medium** — someone walks off with a disk or a database backup. That is worth having. But it does not protect against:",
    },
    {
      t: "ul",
      c: [
        "A compromise of the running application, which has the key in memory and the data flowing through it in plaintext.",
        "A malicious insider with production access.",
        "A subpoena or legal order compelling the operator to produce plaintext.",
        "A misconfigured log, error tracker, or debugging session that captures a request body.",
        "A supply-chain compromise of a server dependency.",
      ],
    },
    {
      t: "p",
      c: "In every one of those cases, the plaintext and the key are both on the server, so the plaintext is available.",
    },
    { t: "h2", c: "Client-side encryption removes the server from the trust boundary" },
    {
      t: "p",
      c: "If the bytes are already ciphertext when they leave your machine, and the key is derived from a passphrase the server never receives, then none of the scenarios above yield secrets. The server genuinely cannot help an attacker, because it never had the material.",
    },
    {
      t: "quote",
      c: "The strongest guarantee you can give a user is one you are technically unable to break yourself.",
    },
    { t: "h2", c: "What it costs" },
    {
      t: "ul",
      c: [
        "**No passphrase recovery.** Covered honestly everywhere we can — the server has nothing to reset.",
        "**Server-side search is limited.** We can search names and metadata, not values, because we cannot read values.",
        "**Key management moves to the client.** The browser and CLI have to derive, hold, and zero keys carefully. That is real engineering, and it is where we spend effort.",
      ],
    },
    { t: "h2", c: "We did not stop there" },
    {
      t: "p",
      c: "Client-side encryption is the primary defense, but we still add a second, independent encryption layer on the server so that a database dump alone is inert even before the client layer is considered. That is [Defense in depth: the second encryption layer](/blog/defense-in-depth-envelope-encryption).",
    },
    {
      t: "note",
      c: "Rule of thumb: encrypt on the server when you need the server to work with the data. Encrypt on the client when the whole point is that the server should not be able to.",
    },
  ],
};
