import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { posts } from "@/content/blog";

type ChangeFreq = MetadataRoute.Sitemap[number]["changeFrequency"];

/**
 * Static list of public marketing routes. Authenticated app routes are
 * deliberately excluded (see `noIndexPaths` in `lib/site`). Blog routes are
 * appended from the content index.
 */
const staticRoutes: ReadonlyArray<{ path: string; priority: number; changeFrequency: ChangeFreq }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/features", priority: 0.9, changeFrequency: "monthly" },
  { path: "/security", priority: 0.9, changeFrequency: "monthly" },
  { path: "/cli", priority: 0.8, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.8, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about", priority: 0.5, changeFrequency: "yearly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map(({ path, priority, changeFrequency }) => ({
    url: new URL(path, SITE_URL).toString(),
    lastModified: now,
    changeFrequency,
    priority,
  }));

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: new URL(`/blog/${post.slug}`, SITE_URL).toString(),
    lastModified: new Date(`${post.date}T00:00:00Z`),
    changeFrequency: "yearly" as ChangeFreq,
    priority: 0.6,
  }));

  return [...staticEntries, ...postEntries];
}
