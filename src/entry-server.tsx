import { renderToString } from "react-dom/server";
import { Route, Routes, StaticRouter } from "react-router-dom";
import BlogListPage from "./features/blog/BlogListPage";
import BlogPostPage from "./features/blog/BlogPostPage";
import {
  BLOG_LIST_DESCRIPTION,
  BLOG_LIST_TITLE,
  BLOG_POSTS,
} from "./features/blog/posts";
import SiteFooter from "./features/layout/SiteFooter";

export interface PrerenderedRoute {
  path: string;
  html: string;
  head: string;
  lastmod?: string;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderPage(path: string): string {
  return renderToString(
    <StaticRouter location={path}>
      <div className="site-shell">
        <div className="site-shell__content">
          <Routes>
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
          </Routes>
        </div>
        <SiteFooter />
      </div>
    </StaticRouter>,
  );
}

function buildHead(opts: {
  title: string;
  description: string;
  url: string;
  type: "website" | "article";
  image?: string;
  jsonLd?: object;
}): string {
  const { title, description, url, type, image, jsonLd } = opts;
  const tags = [
    `<title>${escapeAttr(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<link rel="canonical" href="${escapeAttr(url)}" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:url" content="${escapeAttr(url)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:site_name" content="Legendary Profiles" />`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
  ];
  if (image) {
    tags.push(`<meta property="og:image" content="${escapeAttr(image)}" />`);
  }
  if (jsonLd) {
    // "<" is escaped so post content can never close the script tag
    tags.push(
      `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`,
    );
  }
  return tags.join("\n    ");
}

export function getPrerenderRoutes(siteUrl: string): PrerenderedRoute[] {
  const base = siteUrl.replace(/\/$/, "");
  const abs = (path: string) => (path.startsWith("http") ? path : `${base}${path}`);

  const routes: PrerenderedRoute[] = [
    {
      path: "/blog",
      html: renderPage("/blog"),
      head: buildHead({
        title: BLOG_LIST_TITLE,
        description: BLOG_LIST_DESCRIPTION,
        url: abs("/blog"),
        type: "website",
      }),
      lastmod: BLOG_POSTS[0]?.date,
    },
  ];

  for (const post of BLOG_POSTS) {
    const path = `/blog/${post.slug}`;
    const image = post.coverImage ? abs(post.coverImage) : undefined;
    routes.push({
      path,
      html: renderPage(path),
      lastmod: post.date,
      head: buildHead({
        title: `${post.title} | Legendary Profiles`,
        description: post.summary,
        url: abs(path),
        type: "article",
        image,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.summary,
          datePublished: post.date,
          dateModified: post.date,
          image: image ? [image] : undefined,
          mainEntityOfPage: abs(path),
          author: { "@type": "Organization", name: "Legendary Profiles" },
          publisher: { "@type": "Organization", name: "Legendary Profiles" },
        },
      }),
    });
  }

  return routes;
}
