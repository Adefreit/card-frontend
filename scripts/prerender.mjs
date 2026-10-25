// Post-build step: writes static HTML (with content, title and meta tags) for
// each blog route so crawlers don't need to run JavaScript, and generates sitemap.xml.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const distDir = path.join(root, "dist");
const serverDir = path.join(root, "dist-server");
const siteUrl = (process.env.SITE_URL ?? "https://legendaryprofiles.com").replace(/\/$/, "");

const { getPrerenderRoutes } = await import(
  pathToFileURL(path.join(serverDir, "entry-server.js")).href
);

const template = await readFile(path.join(distDir, "index.html"), "utf8");
const routes = getPrerenderRoutes(siteUrl);

for (const route of routes) {
  const page = template
    .replace(/<title>.*?<\/title>/s, route.head)
    .replace('<div id="root"></div>', `<div id="root">${route.html}</div>`);

  const outDir = path.join(distDir, route.path);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "index.html"), page);
}

const staticUrls = [
  { path: "/" },
  { path: "/contactus" },
  { path: "/legal" },
  ...routes,
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls
  .map(
    (u) =>
      `  <url><loc>${siteUrl}${u.path}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`,
  )
  .join("\n")}
</urlset>
`;
await writeFile(path.join(distDir, "sitemap.xml"), sitemap);

await rm(serverDir, { recursive: true, force: true });
console.log(`Prerendered ${routes.length} blog route(s) and sitemap.xml`);
