import ReactMarkdown, { type Components } from "react-markdown";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const components: Components = {
  img: ({ alt, src, title }) => (
    <img
      src={src}
      alt={alt ?? ""}
      title={title}
      loading="lazy"
      decoding="async"
    />
  ),
};

export default function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
