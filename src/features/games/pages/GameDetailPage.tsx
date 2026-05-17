import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getGamePacks, loadGameDescription } from "../api";
import type { GamePackProduct } from "../api";
import { GameCarousel } from "../components/GameCarousel";
import { GamesCart } from "../components/GamesCart";
import { useGamesCart } from "../context";
import MarkdownRenderer from "../../../components/MarkdownRenderer";

interface GameHighlights {
  genre: string;
  players: string;
  playTime: string;
}

function extractField(section: string, heading: string): string {
  const match = section.match(
    new RegExp(`### ${heading}\\s*\\n+([\\s\\S]*?)(?=\\n###|$)`, "i"),
  );
  return match ? match[1].trim() : "";
}

function extractHighlights(markdown: string): GameHighlights {
  const highlightsSection =
    markdown.split(/## Game Highlights/i)[1]?.split(/^##(?!#)/m)[0] || "";
  return {
    genre: extractField(highlightsSection, "Genre") || "Tabletop",
    players: extractField(highlightsSection, "Number of Players") || "Varies",
    playTime: extractField(highlightsSection, "Average Game Time") || "Varies",
  };
}

function extractImages(markdown: string): string[] {
  const imagesSection = markdown.split(/## Images/i)[1]?.split(/^##/m)[0] || "";
  return imagesSection
    .split("\n")
    .map((line) => line.replace(/^[-*+]\s*/, "").trim())
    .filter(Boolean)
    .map((path) => `/${path}`);
}

function GameDetailContent({ game }: { game: GamePackProduct }) {
  const [desc, setDesc] = useState("");
  const { addItem } = useGamesCart();
  const highlights = extractHighlights(desc);
  const images = extractImages(desc);

  // Extract About section
  const aboutSection =
    desc
      .split(/## About this Game/i)[1]
      ?.split(/##/)[0]
      ?.trim() || "";

  useEffect(() => {
    loadGameDescription(game.id).then(setDesc);
  }, [game.id]);

  return (
    <div className="game-detail-page">
      <section className="game-detail-subsection game-detail-purchase-card">
        <div className="game-detail-purchase-copy">
          <h2>{game.name}</h2>
          <div className="game-detail-price">
            {new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: game.currency.toUpperCase(),
            }).format(game.unitAmountCents / 100)}
          </div>
        </div>

        <div className="game-detail-actions">
          <button
            className="btn-primary"
            onClick={() =>
              addItem({
                gameId: game.id,
                gameName: game.name,
                priceId: game.priceId,
                unitAmountCents: game.unitAmountCents,
                currency: game.currency,
                quantity: 1,
              })
            }
          >
            Add to Cart
          </button>
        </div>
      </section>

      <GameCarousel images={images} className="game-carousel-sm" />

      <section className="game-detail-subsection game-detail-highlights">
        <h3>Game Highlights</h3>
        <div className="game-highlight-grid">
          <div className="game-highlight-item">
            <span className="game-highlight-icon" aria-hidden>
              🎲
            </span>
            <div>
              <strong>Genre</strong>
              <p>{highlights.genre}</p>
            </div>
          </div>
          <div className="game-highlight-item">
            <span className="game-highlight-icon" aria-hidden>
              👥
            </span>
            <div>
              <strong>Players</strong>
              <p>{highlights.players}</p>
            </div>
          </div>
          <div className="game-highlight-item">
            <span className="game-highlight-icon" aria-hidden>
              ⏱️
            </span>
            <div>
              <strong>Average Play Time</strong>
              <p>{highlights.playTime}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="game-detail-subsection">
        <h3>About This Game</h3>
        <MarkdownRenderer content={aboutSection} />
      </section>

      <div className="game-detail-bottom-spacer" aria-hidden />
    </div>
  );
}

export default function GameDetailPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<GamePackProduct | null>(null);

  useEffect(() => {
    getGamePacks().then((packs) => {
      const selected = packs.find((pack) => pack.id === gameId) ?? null;
      setGame(selected);
    });
  }, [gameId]);

  if (!game) {
    return <div>Loading...</div>;
  }

  return (
    <div className="games-page">
      <GameDetailContent game={game} />
      <GamesCart />
    </div>
  );
}
