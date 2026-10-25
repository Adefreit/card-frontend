import "./buffer-shim";
import matter from "gray-matter";

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  summary: string;
  coverImage?: string;
  coverImageAlt?: string;
  body: string;
}

export const BLOG_LIST_TITLE = "Blog | Legendary Profiles";
export const BLOG_LIST_DESCRIPTION =
  "News, product updates and roadmap notes from the developer of Legendary Profiles.";

const rawPosts = import.meta.glob("../../documents/blog/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function toIsoDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function parsePost(path: string, raw: string): BlogPost | null {
  const { data, content } = matter(raw);
  if (data.draft === true && import.meta.env.PROD) return null;

  // Slug comes from the file name, e.g. 2026-10-25-welcome.md -> welcome
  const fileName = path.split("/").pop()!.replace(/\.md$/, "");
  const slug = fileName.replace(/^\d{4}-\d{2}-\d{2}-/, "");

  return {
    slug,
    title: String(data.title ?? slug),
    date: toIsoDate(data.date),
    summary: String(data.summary ?? ""),
    coverImage: data.coverImage ? String(data.coverImage) : undefined,
    coverImageAlt: data.coverImageAlt ? String(data.coverImageAlt) : undefined,
    body: content.trim(),
  };
}

export const BLOG_POSTS: BlogPost[] = Object.entries(rawPosts)
  .map(([path, raw]) => parsePost(path, raw))
  .filter((post): post is BlogPost => post !== null)
  .sort((a, b) => b.date.localeCompare(a.date));

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function formatPostDate(isoDate: string): string {
  if (!isoDate) return "";
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
