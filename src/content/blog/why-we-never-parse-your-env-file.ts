import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "why-we-never-parse-your-env-file",
  title: "Why we never parse your .env file",
  description:
    "Dotenv syntax is not a standard. Tools disagree about quotes, comments, multiline values and interpolation. So nvault stores bytes, not key-value pairs.",
  date: "2026-07-23",
  author: "The nvault team",
  tags: ["product", "developer-experience"],
  blocks: [
    {
      t: "p",
      c: "It is tempting to treat a `.env` file as a dictionary. Parse it into keys and values, store those, and reconstruct the file on the way out. It would make search and diffing easy. We deliberately do not do it.",
    },
    { t: "h2", c: "There is no single dotenv format" },
    {
      t: "p",
      c: "Different libraries and runtimes disagree about nearly every edge case:",
    },
    {
      t: "ul",
      c: [
        "Whether `#` starts a comment mid-line or only at the start of a line.",
        "Whether values are trimmed, and whether quotes are preserved or stripped.",
        "How multiline values work — real newlines inside quotes, or `\\n` escapes.",
        "Whether `${OTHER_VAR}` is interpolated, and by whom.",
        "Whether `export ` prefixes are allowed.",
        "What happens with a key that appears twice.",
      ],
    },
    {
      t: "p",
      c: "If nvault parsed and re-serialised your file, it would have to pick one interpretation. The moment ours differs from the one your app actually uses, we have corrupted your config in a subtle, hard-to-spot way.",
    },
    { t: "h2", c: "Bytes in, same bytes out" },
    {
      t: "p",
      c: "nvault treats every configuration file as an opaque blob. What you upload is what you get back, exactly:",
    },
    {
      t: "ul",
      c: [
        "Comments and their placement.",
        "Quoting style, or the absence of quotes.",
        "Key ordering — including deliberate grouping.",
        "Blank lines and trailing whitespace.",
        "Multiline values, however they are expressed.",
        "File encoding, where the platform supports it.",
      ],
    },
    {
      t: "quote",
      c: "A backup you cannot trust to be byte-identical is not a backup. It is a suggestion.",
    },
    { t: "h2", c: "It is also the safer choice" },
    {
      t: "p",
      c: "A parser is code that runs on your secrets. A blob is not. Not parsing means there is no dotenv-parsing logic anywhere near your plaintext — one less place for a bug, an injection, or an unexpected transformation. It also means nvault works for files that are not dotenv at all: a service-account JSON, a TOML config, a PEM key you need alongside the project.",
    },
    { t: "h2", c: "The trade-off" },
    {
      t: "note",
      c: "Because the server sees only ciphertext and never structure, value-level features — \"show me every project using this API key\" — have to happen on the client, or not at all. We think faithful storage is worth more than server-side cleverness for data like this.",
    },
    {
      t: "p",
      c: "Store files as files. Give them back unchanged. Everything else is negotiable; that is not.",
    },
  ],
};
