// Games API helpers and types
import { apiClient } from "../../lib/http";

export interface GamePackProduct {
  id: string;
  name: string;
  priceId: string;
  unitAmountCents: number;
  currency: string;
}

interface PricingResponse {
  gamePacks?: GamePackProduct[];
}

export async function getGamePacks(): Promise<GamePackProduct[]> {
  // Fetch pricing and normalize gamePacks to an array.
  const { data } = await apiClient.get<PricingResponse>("/v1/pricing");
  return Array.isArray(data.gamePacks) ? data.gamePacks : [];
}

export async function loadGameDescription(gameId: string): Promise<string> {
  // Dynamic import for markdown (Vite/webpack will bundle)
  const res = await fetch(`/src/documents/games/${gameId}.md`);
  if (!res.ok) return "Description not available.";
  return await res.text();
}

async function imageExists(src: string): Promise<boolean> {
  try {
    const response = await fetch(src, {
      method: "HEAD",
      cache: "no-store",
    });
    if (response.ok) {
      return true;
    }
  } catch {
    // Ignore and fall through to false.
  }

  return false;
}

export async function getGameImages(
  gameId: string,
  maxImages = 24,
): Promise<string[]> {
  // Probe public assets at runtime so each game can have a variable number of photos.
  const images: string[] = [];
  const extensions = ["jpg", "jpeg", "png", "webp"];

  const baseCandidates = extensions.map((ext) => `/games/${gameId}.${ext}`);
  for (const candidate of baseCandidates) {
    if (await imageExists(candidate)) {
      images.push(candidate);
      break;
    }
  }

  let consecutiveMisses = 0;
  for (let i = 1; i <= maxImages; i++) {
    const num = i.toString().padStart(2, "0");
    let foundForIndex = false;

    for (const ext of extensions) {
      const src = `/games/${gameId}_${num}.${ext}`;
      if (await imageExists(src)) {
        images.push(src);
        foundForIndex = true;
        break;
      }
    }

    if (!foundForIndex) {
      consecutiveMisses += 1;
      if (consecutiveMisses >= 2 && images.length > 0) {
        break;
      }
      continue;
    }

    consecutiveMisses = 0;
  }

  return images;
}
