import Link from "next/link";
import { cn } from "@/lib/cn";

/** Centred content column with the standard marketing gutter. */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-5xl px-4 sm:px-6", className)}>{children}</div>;
}

/** Vertical rhythm wrapper for a page section. */
export function Section({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("py-16 sm:py-24", className)} {...props}>
      {children}
    </section>
  );
}

/** Small uppercase kicker above a heading. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-wider text-accent-600 dark:text-accent-400">{children}</p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "text-left")}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
        {title}
      </h2>
      {description && <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">{description}</p>}
    </div>
  );
}

type CtaProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

/** Link styled as a button — used for marketing calls to action. */
export function CtaLink({ href, children, variant = "primary", className }: CtaProps) {
  const base =
    "focus-ring inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-colors";
  const styles =
    variant === "primary"
      ? "bg-accent-600 text-white hover:bg-accent-700"
      : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";
  const external = href.startsWith("http");
  if (external) {
    return (
      <a href={href} className={cn(base, styles, className)} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cn(base, styles, className)}>
      {children}
    </Link>
  );
}

/** A dark, horizontally-scrollable block for shell commands or code. */
export function CommandBlock({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 dark:border-slate-800">
      {label && (
        <div className="border-b border-white/10 px-4 py-2 text-xs font-medium text-slate-400">{label}</div>
      )}
      <pre className="overflow-x-auto px-4 py-3 text-[13px] leading-relaxed text-slate-200">
        <code>{children}</code>
      </pre>
    </div>
  );
}

/** Readable prose column for legal / long-form pages. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "space-y-4 text-slate-600 dark:text-slate-300",
        "[&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-slate-100",
        "[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-900 dark:[&_h3]:text-slate-100",
        "[&_a]:font-medium [&_a]:text-accent-600 hover:[&_a]:underline dark:[&_a]:text-accent-400",
        "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2",
        "[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm dark:[&_code]:bg-slate-800",
        "[&_p+p]:mt-4",
        "[&_table]:my-6 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:text-sm",
        "[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-900",
        "dark:[&_th]:border-slate-800 dark:[&_th]:bg-slate-900 dark:[&_th]:text-slate-100",
        "[&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top dark:[&_td]:border-slate-800",
      )}
    >
      {children}
    </div>
  );
}
