import { useEffect } from "react";

const DEFAULT_TITLE = "Legendary Profiles";

function setMeta(name: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`,
  );
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

// Client-side counterpart to the head tags that the prerender step bakes in.
export function useDocumentMeta(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    setMeta("description", description);

    return () => {
      document.title = previousTitle || DEFAULT_TITLE;
    };
  }, [title, description]);
}
