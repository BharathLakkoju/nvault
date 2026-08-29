import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section, SectionHeading } from "@/components/marketing/ui";
import { AuroraBackground } from "@/components/aurora-background";
import { BreadcrumbJsonLd, BlogJsonLd } from "@/components/marketing/json-ld";
import { pageMetadata } from "@/lib/seo";
import { formatPostDate, readingMinutes, toIsoTimestamp } from "@/lib/blog";
import { posts } from "@/content/blog";

export const metadata: Metadata = pageMetadata({
  title: "Blog",
  description:
    "Notes on secure environment configuration from the nvault team: why the product exists, how the encryption works, and how the CLI fits into real workflows.",
  path: "/blog",
});

export default function BlogIndexPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }]} />
      <BlogJsonLd
        posts={posts.map((p) => ({
          slug: p.slug,
          title: p.title,
          description: p.description,
          datePublished: toIsoTimestamp(p.date),
        }))}
      />

      <Section className="relative isolate pb-8">
        <AuroraBackground />
        <Container>
          <SectionHeading
            eyebrow="Blog"
            title="Notes on secure environment configuration"
            description="Why nvault exists, how it is built, and how zero-knowledge encryption holds up under a real threat model."
          />
        </Container>
      </Section>

      <Section className="pt-0">
        <Container>
          <ul className="mx-auto max-w-3xl divide-y divide-slate-200 dark:divide-slate-800">
            {posts.map((p) => (
              <li key={p.slug} className="py-8 first:pt-0">
                <article>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                    <time dateTime={toIsoTimestamp(p.date)}>{formatPostDate(p.date)}</time>
                    <span aria-hidden>·</span>
                    <span>{readingMinutes(p)} min read</span>
                  </div>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    <Link href={`/blog/${p.slug}`} className="focus-ring rounded hover:text-accent-600 dark:hover:text-accent-400">
                      {p.title}
                    </Link>
                  </h2>
                  <p className="mt-2 text-slate-600 dark:text-slate-300">{p.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="focus-ring mt-4 inline-block rounded text-sm font-semibold text-accent-600 hover:underline dark:text-accent-400"
                  >
                    Read post →
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </>
  );
}
