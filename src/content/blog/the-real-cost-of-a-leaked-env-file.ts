import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "the-real-cost-of-a-leaked-env-file",
  title: "The real cost of a leaked .env file",
  description:
    "A leaked environment file is rarely one incident. It is a credential rotation, an audit, a customer email, and a week you do not get back. Why secrets sprawl is expensive.",
  date: "2026-06-11",
  author: "The nvault team",
  tags: ["security", "background"],
  blocks: [
    {
      t: "p",
      c: "The dangerous thing about a `.env` file is not its size. It is the **blast radius**. A single file can contain the database password, the payment processor key, the mail provider token, the object-storage credentials, and the signing secret for your own auth system. Whoever holds it can often act as your application.",
    },
    { t: "h2", c: "How they leak" },
    {
      t: "ul",
      c: [
        "Committed to Git — then force-pushed away, but still in the reflog, in forks, and in every clone.",
        "Pasted into a chat tool or ticket, where it is now indexed, backed up, and retained per that vendor's policy.",
        "Left on a decommissioned laptop or a shared CI runner.",
        "Copied into a screenshot or a screen share.",
        "Sent to the wrong person with a similar name in the autocomplete.",
      ],
    },
    {
      t: "p",
      c: "None of these require an attacker to be sophisticated. They require a normal workday and a normal mistake.",
    },
    { t: "h2", c: "What the cleanup actually costs" },
    {
      t: "p",
      c: "Say a production `.env` is exposed. The response is not \"delete the message.\" It is:",
    },
    {
      t: "ol",
      c: [
        "Rotate every credential in the file. Some rotate cleanly; some require coordinated deploys; some have a propagation delay where things are half-broken.",
        "Audit access logs for each affected system for the exposure window, which is often \"we are not sure when it started.\"",
        "Check whether the signing secret was in there. If it was, every token you have ever issued is now suspect.",
        "Decide whether this is a disclosable event for your customers or your compliance regime.",
        "Write the postmortem, and change the process so it does not happen again.",
      ],
    },
    {
      t: "quote",
      c: "The message took two seconds to send. The rotation took two days.",
    },
    { t: "h2", c: "The fix is to shrink the surface" },
    {
      t: "p",
      c: "You cannot eliminate human error. You can make the safe path the easy one, so the file never needs to be pasted anywhere. That means:",
    },
    {
      t: "ul",
      c: [
        "One canonical, encrypted copy of each project's environment — not five copies in five tools.",
        "Retrieval that is a command, not a copy-paste: `nvault pull`.",
        "Storage where a breach of the provider yields ciphertext, not secrets — see [Our threat model](/blog/our-threat-model).",
        "History, so you can see when a value changed and revert a bad edit instead of reconstructing it from memory.",
      ],
    },
    {
      t: "note",
      c: "nvault does not stop you from also committing a secret to Git — nothing can. But when the vault is the obvious place to get config, the `.env` stops being a thing you move around by hand, and most of the leak paths above simply close.",
    },
    {
      t: "p",
      c: "Secrets sprawl is a tax you pay in small amounts every day and one large amount on the worst day. Consolidating to one encrypted source is how you stop paying it.",
    },
  ],
};
