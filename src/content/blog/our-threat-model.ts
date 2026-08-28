import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "our-threat-model",
  title: "Our threat model: what EnvVault protects, and what it doesn't",
  description:
    "A security product should be able to state plainly which attackers it stops and which it does not. Here is ours, without the marketing gloss.",
  date: "2026-08-20",
  author: "The EnvVault team",
  tags: ["security"],
  blocks: [
    {
      t: "p",
      c: "Every security claim is relative to an attacker. \"Secure\" on its own means nothing. This is the set of threats EnvVault is designed to address, and — just as important — the ones it is not.",
    },
    { t: "h2", c: "What EnvVault is designed to stop" },
    {
      t: "ul",
      c: [
        "**A breach of our infrastructure.** Database dump, storage bucket access, read-only injection: all yield doubly-encrypted blobs and metadata, no plaintext. See [Defense in depth](/blog/defense-in-depth-envelope-encryption).",
        "**Us.** Staff, operators, and anyone who compels us cannot produce plaintext, because client-side encryption means we never hold the keys. See [Why we encrypt on the client](/blog/client-side-vs-server-side-encryption).",
        "**Credential sprawl.** One encrypted source instead of copies in chat, email, and notes. See [The real cost of a leaked .env file](/blog/the-real-cost-of-a-leaked-env-file).",
        "**A leaked or stolen device.** Sessions are individually revocable; access tokens are short-lived.",
        "**Tampering with stored data.** AEAD with bound identifiers means a modified or swapped blob fails its authentication check rather than decrypting to something wrong.",
        "**ID-guessing between accounts.** Non-guessable identifiers and a server-side authorization check on every project, file, and version operation.",
      ],
    },
    { t: "h2", c: "What EnvVault does not claim to stop" },
    {
      t: "ul",
      c: [
        "**A compromise of your own machine.** If malware is running as you while your vault is unlocked, it can read what you can read. No remote service can fix a compromised endpoint.",
        "**A weak or reused vault passphrase.** Key derivation raises the cost of guessing, but a passphrase in someone else's breach corpus is still a risk. Use a long, unique one from a password manager.",
        "**Loss of your passphrase.** There is no recovery. That is the deliberate cost of the server not being able to read your data.",
        "**Shoulder-surfing, phishing your browser session, or a malicious browser extension** with access to the page while the vault is open.",
        "**Metadata exposure in a breach.** We minimise it, but file names, sizes, timestamps, and project structure are visible to the server by necessity and would be visible in a breach of it.",
      ],
    },
    { t: "h2", c: "Assumptions we make" },
    {
      t: "ol",
      c: [
        "TLS is intact between your machine and the API.",
        "Your browser's WebCrypto implementation is trustworthy.",
        "Your operating system's secure credential storage is trustworthy.",
        "You keep your passphrase out of the hands of others and out of reach of your future forgetful self.",
      ],
    },
    {
      t: "note",
      c: "If any of these assumptions is wrong for your situation, the guarantees change. We would rather say that clearly than imply protection we cannot deliver.",
    },
    {
      t: "quote",
      c: "A threat model you can read in five minutes is worth more than a compliance badge you cannot.",
    },
  ],
};
