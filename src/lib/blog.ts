/**
 * Blog content model
 * ------------------
 * Posts are authored as small, typed data modules under `src/content/blog/`
 * rather than MDX — no extra build pipeline, no `dangerouslySetInnerHTML`, and
 * the content stays trivially serialisable for JSON-LD and metadata.
 *
 * A post body is an array of blocks. Text inside `p` / `li` / `quote` / `note`
 * supports a tiny inline syntax handled by `renderInline` in
 * `components/marketing/post-body`:
 *   `code`   → inline code
 *   **bold** → strong
 *   [label](/path) → internal link
 */

export type Block =
  | { t: "p"; c: string }
  | { t: "h2"; c: string }
  | { t: "h3"; c: string }
  | { t: "ul"; c: string[] }
  | { t: "ol"; c: string[] }
  | { t: "code"; lang?: string; c: string }
  | { t: "quote"; c: string }
  | { t: "note"; c: string };

export interface BlogPost {
  slug: string;
  title: string;
  /** ~150 chars; used for the card, meta description and OG description. */
  description: string;
  /** Publication date as `YYYY-MM-DD` (treated as UTC). */
  date: string;
  author: string;
  tags: string[];
  blocks: Block[];
}

/** Words in the human-readable parts of a post body. */
function wordCount(blocks: Block[]): number {
  let words = 0;
  for (const block of blocks) {
    if (block.t === "ul" || block.t === "ol") {
      words += block.c.join(" ").split(/\s+/).filter(Boolean).length;
    } else {
      words += String(block.c).split(/\s+/).filter(Boolean).length;
    }
  }
  return words;
}

/** Estimated reading time in whole minutes (>= 1), at ~200 wpm. */
export function readingMinutes(post: BlogPost): number {
  return Math.max(1, Math.round(wordCount(post.blocks) / 200));
}

/** "June 4, 2026" — formatted in UTC so it never shifts by timezone. */
export function formatPostDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** ISO 8601 timestamp for structured data / `<time dateTime>`. */
export function toIsoTimestamp(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toISOString();
}

export function sortByDateDesc(posts: readonly BlogPost[]): BlogPost[] {
  return [...posts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
