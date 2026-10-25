import MarketingNav from "../layout/MarketingNav";
import { Link } from "react-router-dom";
import {
  BLOG_LIST_DESCRIPTION,
  BLOG_LIST_TITLE,
  BLOG_POSTS,
  formatPostDate,
} from "./posts";
import { useDocumentMeta } from "./useDocumentMeta";

export default function BlogListPage() {
  useDocumentMeta(BLOG_LIST_TITLE, BLOG_LIST_DESCRIPTION);

  return (
    <div className="blog-page">
      <MarketingNav />
      <main className="blog-main">
        <h1 className="blog-title">News &amp; Updates</h1>
        <p className="blog-subtitle">
          Product news, behind-the-scenes notes and what's coming next.
        </p>

        {BLOG_POSTS.length === 0 ? (
          <p>No posts yet. Check back soon!</p>
        ) : (
          <div className="blog-list">
            {BLOG_POSTS.map((post) => (
              <article key={post.slug} className="blog-row">
                <Link to={`/blog/${post.slug}`} className="blog-row__link">
                  {post.coverImage ? (
                    <img
                      className="blog-row__image"
                      src={post.coverImage}
                      alt={post.coverImageAlt ?? ""}
                      loading="lazy"
                    />
                  ) : null}
                  <div className="blog-row__body">
                    <time dateTime={post.date}>
                      {formatPostDate(post.date)}
                    </time>
                    <h2>{post.title}</h2>
                    <p>{post.summary}</p>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
