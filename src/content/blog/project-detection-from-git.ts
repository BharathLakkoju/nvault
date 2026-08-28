import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "project-detection-from-git",
  title: "Finding the right project from your Git remote",
  description:
    "envvault init should know which environment to restore without being told. It does that by reading your Git remote — deterministically, and never silently.",
  date: "2026-08-13",
  author: "The EnvVault team",
  tags: ["cli", "developer-experience"],
  blocks: [
    {
      t: "p",
      c: "You have just cloned a repo onto a new machine. You want its environment files back. The CLI should not make you remember or type a project name — it should look at where you are and figure it out.",
    },
    { t: "h2", c: "How detection works" },
    {
      t: "p",
      c: "`envvault init` reads the Git remote of the current directory, normalises it, and asks the API whether a project is associated with that remote.",
    },
    {
      t: "code",
      lang: "text",
      c: "$ cd portfolio-analytics\n$ envvault init\n\nGit repository:   github.com/acme/portfolio-analytics\nMatching project: portfolio-analytics\n\nRestore 3 files into this directory?\n  .env  .env.local  .env.production",
    },
    {
      t: "p",
      c: "Normalisation matters: `git@github.com:acme/portfolio-analytics.git` and `https://github.com/acme/portfolio-analytics` and the same URL with a trailing slash all resolve to one canonical form before the lookup.",
    },
    { t: "h2", c: "Deterministic and explainable" },
    {
      t: "p",
      c: "Two properties we care about:",
    },
    {
      t: "ul",
      c: [
        "**Deterministic** — the same directory always resolves to the same project. No fuzzy matching on folder names, no guessing.",
        "**Explainable** — the CLI prints which remote it read and which project it matched, before doing anything. If that mapping is wrong, you see it immediately.",
      ],
    },
    { t: "h2", c: "Git is a convenience, not a requirement" },
    {
      t: "p",
      c: "Plenty of real situations have no usable remote: a repo that has not been pushed, a monorepo with several deployable apps, a directory that is not a Git repo at all. In all of those you can select the project explicitly — `envvault pull <project>` — and the CLI gets out of the way. Detection is there to save you typing when it can, not to be the only path.",
    },
    { t: "h2", c: "Stable identifiers underneath" },
    {
      t: "note",
      c: "The remote is a lookup key, not the project's identity. Projects have stable, non-guessable internal identifiers, so you can rename a repo, move it between hosts, or change the remote URL without losing the link — you just re-associate the new remote.",
    },
    {
      t: "quote",
      c: "Good automation tells you what it decided and why, then lets you override it.",
    },
    {
      t: "p",
      c: "The goal is that `envvault init` becomes the fastest way to bring a project's environment back on a machine that has never seen it.",
    },
  ],
};
