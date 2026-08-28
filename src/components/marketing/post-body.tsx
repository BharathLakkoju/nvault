import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import type { Block } from "@/lib/blog";

/**
 * Renders the tiny inline syntax allowed in post text:
 *   `code`, **bold**, [label](/path)
 * The regex is anchored to those three forms only; anything else is plain text,
 * so post content can never inject markup.
 */
const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

export function renderInline(text: string): ReactNode {
  const parts = text.split(INLINE);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em] text-slate-800 dark:bg-slate-800 dark:text-slate-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      return (
        <Link key={i} href={href} className="font-medium text-accent-600 hover:underline dark:text-accent-400">
          {label}
        </Link>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function BlockView({ block }: { block: Block }) {
  switch (block.t) {
    case "h2":
      return <h2 className="mt-12 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{block.c}</h2>;
    case "h3":
      return <h3 className="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">{block.c}</h3>;
    case "p":
      return <p className="mt-5 leading-relaxed text-slate-600 dark:text-slate-300">{renderInline(block.c)}</p>;
    case "ul":
      return (
        <ul className="mt-5 list-disc space-y-2 pl-6 text-slate-600 dark:text-slate-300">
          {block.c.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="mt-5 list-decimal space-y-2 pl-6 text-slate-600 dark:text-slate-300">
          {block.c.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case "code":
      return (
        <pre className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-[13px] leading-relaxed text-slate-200 dark:border-slate-800">
          <code>{block.c}</code>
        </pre>
      );
    case "quote":
      return (
        <blockquote className="mt-6 border-l-2 border-accent-500 pl-4 text-lg italic text-slate-700 dark:text-slate-200">
          {renderInline(block.c)}
        </blockquote>
      );
    case "note":
      return (
        <div className="mt-6 rounded-lg border border-accent-200 bg-accent-50 p-4 text-sm text-slate-700 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-slate-200">
          {renderInline(block.c)}
        </div>
      );
  }
}

export function PostBody({ blocks }: { blocks: readonly Block[] }) {
  return (
    <div className="text-base">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}
