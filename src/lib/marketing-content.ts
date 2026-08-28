/**
 * Shared marketing copy used across the home page and the dedicated
 * feature / FAQ pages, so the two never drift.
 */

export interface Feature {
  title: string;
  description: string;
  /** Simple line-icon path drawn on a 24×24 viewBox with stroke="currentColor". */
  icon: string;
}

export const features: ReadonlyArray<Feature> = [
  {
    title: "Zero-knowledge encryption",
    description:
      "Files are encrypted in your browser with AES-256-GCM before they ever leave your machine. The server stores ciphertext and wrapped keys — never plaintext, never your passphrase.",
    icon: "M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3Z",
  },
  {
    title: "Organised by project",
    description:
      "Group .env, .env.local, .env.production and any other config file under the project it belongs to. Everything stays exactly as you uploaded it.",
    icon: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z",
  },
  {
    title: "Versioned history",
    description:
      "Every change to a file is a new version. Compare, download an earlier one, or restore it in a click when a config change breaks your dev environment.",
    icon: "M3 3v6h6M3 9a9 9 0 1 1 2.6 6.4",
  },
  {
    title: "Exact-fidelity storage",
    description:
      "Comments, quoting, multiline values, ordering, whitespace and encoding are preserved byte-for-byte. EnvVault never parses and rewrites your files.",
    icon: "M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6H8ZM14 3v6h6",
  },
  {
    title: "One-command restore",
    description:
      "Clone a repo on a new machine and pull its environment straight back into place — with an explicit prompt before anything on disk is overwritten.",
    icon: "M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  },
  {
    title: "Devices & audit trail",
    description:
      "See every active session, revoke any device instantly, and review a timestamped log of security-sensitive actions on your account.",
    icon: "M9 12l2 2 4-4M12 3a9 9 0 0 0-9 9c0 5 9 9 9 9s9-4 9-9a9 9 0 0 0-9-9Z",
  },
];

export interface Step {
  title: string;
  description: string;
}

export const howItWorks: ReadonlyArray<Step> = [
  {
    title: "Set a vault passphrase",
    description:
      "Chosen once, never transmitted. It derives the key that wraps everything else — so only you can unlock your vault.",
  },
  {
    title: "Push your config files",
    description:
      "Upload through the web app or the CLI. Encryption happens locally; the server only receives an opaque blob.",
  },
  {
    title: "Restore anywhere",
    description:
      "On any machine, unlock the vault and pull. EnvVault matches the project from your Git remote and writes the files back.",
  },
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const faqs: ReadonlyArray<FaqItem> = [
  {
    question: "Can EnvVault staff read my environment variables?",
    answer:
      "No. All encryption and decryption happens in your browser. The server stores only ciphertext and keys that are themselves wrapped by a key derived from your vault passphrase, which is never sent to us.",
  },
  {
    question: "What happens if I forget my vault passphrase?",
    answer:
      "Because the architecture is zero-knowledge, there is no recovery path — we cannot reset a passphrase we never had. Store it in a password manager and keep an offline backup of critical files.",
  },
  {
    question: "Does it change my .env files in any way?",
    answer:
      "No. Files are stored and restored byte-for-byte. Comments, quoting, ordering, multiline values and whitespace are all preserved. EnvVault treats config files as opaque data, not dotenv syntax to be re-serialised.",
  },
  {
    question: "How does versioning work?",
    answer:
      "Each upload of a file creates a new immutable version. You can view metadata for every version, download a previous one, or restore it as the current version. Older encrypted versions remain readable.",
  },
  {
    question: "Which files should I store?",
    answer:
      "Anything sensitive that your project needs but that you would not commit to Git: .env, .env.local, .env.development, .env.production, service-account JSON, and similar configuration files.",
  },
  {
    question: "Is there a command-line interface?",
    answer:
      "The web app is available today. A first-class CLI for headless, SSH and WSL workflows — including device-code login and 'envvault run' to inject secrets without writing a .env file — is on the roadmap and the API is already designed for it.",
  },
  {
    question: "How is the server-side storage protected?",
    answer:
      "As defense in depth, every blob the browser uploads is encrypted again on the server under a key that lives only in the deployment environment, never in the database. A stolen database dump on its own is inert.",
  },
  {
    question: "What does it cost?",
    answer:
      "EnvVault is free while in early access. See the pricing page for what is included and how paid plans are expected to be structured.",
  },
];
