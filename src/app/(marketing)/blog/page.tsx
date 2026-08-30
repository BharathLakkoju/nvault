import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section, SectionHeading } from "@/components/marketing/ui";
import { AuroraBackground } from "@/components/aurora-background";
import { BreadcrumbJsonLd, BlogJsonLd } from "@/components/marketing/json-ld";
import { pageMetadata } from "@/lib/seo";
import { formatPostDate, readingMinutes, toIsoTimestamp, type BlogPost } from "@/lib/blog";
import { posts } from "@/content/blog";

export const metadata: Metadata = pageMetadata({
  title: "Blog",
  description:
    "Notes on secure environment configuration from the nvault team: why the product exists, how the encryption works, and how the CLI fits into real workflows.",
  path: "/blog",
});

function PostMeta({ post }: { post: BlogPost }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
      <time dateTime={toIsoTimestamp(post.date)}>{formatPostDate(post.date)}</time>
      <span aria-hidden>·</span>
      <span>{readingMinutes(post)} min read</span>
    </div>
  );
}

function TagRow({ tags }: { tags: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function FeaturedPost({ post }: { post: BlogPost }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
            Latest
          </span>
          <PostMeta post={post} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          <Link href={`/blog/${post.slug}`} className="focus-ring rounded after:absolute after:inset-0">
            {post.title}
          </Link>
        </h2>
        <p className="max-w-2xl text-slate-600 dark:text-slate-300">{post.description}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <TagRow tags={post.tags} />
          <span className="text-sm font-semibold text-accent-600 transition-transform group-hover:translate-x-0.5 dark:text-accent-400">
            Read post →
          </span>
        </div>
      </div>
    </article>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <article className="group relative flex h-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <PostMeta post={post} />
      <h3 className="text-lg font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-100">
        <Link href={`/blog/${post.slug}`} className="focus-ring rounded after:absolute after:inset-0">
          {post.title}
        </Link>
      </h3>
      <p className="line-clamp-3 flex-1 text-sm text-slate-600 dark:text-slate-300">{post.description}</p>
      <TagRow tags={post.tags} />
    </article>
  );
}

export default function BlogIndexPage() {
  const [featured, ...rest] = posts;

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
          <div className="mx-auto max-w-5xl">
            {featured && <FeaturedPost post={featured} />}

            {rest.length > 0 && (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>
            )}
          </div>
        </Container>
      </Section>
    </>
  );
}
