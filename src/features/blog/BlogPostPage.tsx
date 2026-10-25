import MarketingNav from "../layout/MarketingNav";
import { Link, useParams } from "react-router-dom";
import MarkdownRenderer from "../../components/MarkdownRenderer";
import { formatPostDate, getBlogPost } from "./posts";
import { useDocumentMeta } from "./useDocumentMeta";

export default function BlogPostPage() {
  const { slug = "" } = useParams();
  const post = getBlogPost(slug);

  useDocumentMeta(
    post ? `${post.title} | Legendary Profiles` : "Post not found | Legendary Profiles",
    post?.summary ?? "",
  );

  return (
    <div className="blog-page">
      <MarketingNav />
      <main className="blog-main blog-main--post">
        <p>
          <Link to="/blog">← All posts</Link>
        </p>
        {post ? (
          <article className="blog-article">
            <time dateTime={post.date}>{formatPostDate(post.date)}</time>
            <h1 className="blog-article__title">{post.title}</h1>
            {post.coverImage ? (
              <img
                className="blog-article__cover"
                src={post.coverImage}
                alt={post.coverImageAlt ?? ""}
              />
            ) : null}
            <MarkdownRenderer content={post.body} className="blog-markdown" />
          </article>
        ) : (
          <section className="legal-doc-card">
            <h1>Post not found</h1>
            <p>The post you're looking for doesn't exist.</p>
            <p>
              <Link to="/blog">Back to the blog</Link>
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
