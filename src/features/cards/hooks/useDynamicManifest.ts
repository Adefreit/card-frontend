import { useEffect } from "react";

/**
 * Rewrites the site-wide manifest's start_url/scope/id to this card's route so Chrome/Android
 * treats each /cardviewer/:id as its own installable PWA. Restores the original link on cleanup.
 */
export function useDynamicManifest(id: string | undefined) {
  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!(manifestLink instanceof HTMLLinkElement)) {
      return undefined;
    }

    const cardId = id?.trim();
    if (!cardId) {
      return undefined;
    }

    const defaultHref = manifestLink.href;
    let objectUrl: string | null = null;
    let cancelled = false;

    async function applyDynamicManifest() {
      try {
        const response = await fetch(defaultHref);
        const original = await response.json();

        const cardUrl = `/cardviewer/${encodeURIComponent(cardId as string)}`;

        const dynamicManifest = {
          ...original,
          start_url: cardUrl,
          scope: cardUrl,
          id: cardUrl,
        };

        const blob = new Blob([JSON.stringify(dynamicManifest)], {
          type: "application/manifest+json",
        });
        objectUrl = URL.createObjectURL(blob);

        if (!cancelled && manifestLink instanceof HTMLLinkElement) {
          manifestLink.setAttribute("href", objectUrl);
        }
      } catch {
        // Leave the default manifest in place if fetching/rewriting fails
      }
    }

    applyDynamicManifest();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      manifestLink.setAttribute("href", defaultHref);
    };
  }, [id]);
}
