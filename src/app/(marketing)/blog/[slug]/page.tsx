import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container, Section, CtaLink } from "@/components/marketing/ui";
import { PostBody } from "@/components/marketing/post-body";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/marketing/json-ld";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";
import { formatPostDate, readingMinutes, toIsoTimestamp } from "@/lib/blog";
import { getPost, posts, relatedPosts } from "@/content/blog";

interface Params {
  params: { slug: string };
}

export const dynamicParams = false;

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: Params): Metadata {
  const post = getPost(params.slug);
  if (!post) return {};
  const base = pageMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    ogType: "article",
  });
  return {
    ...base,
    authors: [{ name: post.author }],
    keywords: post.tags,
    openGraph: {
      ...base.openGraph,
      type: "article",
      publishedTime: toIsoTimestamp(post.date),
      authors: [post.author],
      tags: post.tags,
    },
  };
}

export default function BlogPostPage({ params }: Params) {
  const post = getPost(params.slug);
  if (!post) notFound();

  const related = relatedPosts(post.slug);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ]}
      />
      <ArticleJsonLd
        title={post.title}
        description={post.description}
        path={`/blog/${post.slug}`}
        datePublished={toIsoTimestamp(post.date)}
        author={post.author}
      />

      <Section className="pb-0">
        <Container>
          <article className="mx-auto max-w-3xl">
            <Link
              href="/blog"
              className="focus-ring rounded text-sm font-medium text-accent-600 hover:underline dark:text-accent-400"
            >
              ← All posts
            </Link>

            <header className="mt-6 border-b border-slate-200 pb-8 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                <time dateTime={toIsoTimestamp(post.date)}>{formatPostDate(post.date)}</time>
                <span aria-hidden>·</span>
                <span>{readingMinutes(post)} min read</span>
                <span aria-hidden>·</span>
                <span>{post.author}</span>
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
                {post.title}
              </h1>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">{post.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </header>

            <div className="mt-8">
              <PostBody blocks={post.blocks} />
            </div>

            <div className="mt-14 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/40">
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{siteConfig.tagline}</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
                Create a vault, push your first project, and restore it anywhere.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <CtaLink href="/register">Get started free</CtaLink>
                <CtaLink href="/security" variant="secondary">
                  How it stays secure
                </CtaLink>
              </div>
            </div>
          </article>
        </Container>
      </Section>

      {related.length > 0 && (
        <Section>
          <Container>
            <div className="mx-auto max-w-3xl">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Related reading</h2>
              <ul className="mt-4 space-y-4">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/blog/${r.slug}`}
                      className="focus-ring rounded font-medium text-accent-600 hover:underline dark:text-accent-400"
                    >
                      {r.title}
                    </Link>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{r.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </Section>
      )}
    </>
  );
}
