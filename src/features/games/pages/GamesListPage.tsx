import { useEffect, useState } from "react";
import { getGamePacks } from "../api";
import type { GamePackProduct } from "../api";
import { GameCard } from "../components/GameCard";
import { GamesCart } from "../components/GamesCart";

export default function GamesListPage() {
  const [games, setGames] = useState<GamePackProduct[]>([]);
  useEffect(() => {
    getGamePacks().then(setGames);
  }, []);

  return (
    <div className="games-page">
      <section className="content-hero games-hero">
        <div>
          <h1>Let the Games Begin</h1>
          <p className="content-hero-copy">
            Discover your next tabletop adventure and build your perfect game
            night lineup.
          </p>
        </div>
      </section>
      <section className="games-grid">
        <div className="games-list">
          {games.map((game) => {
            return <GameCard key={game.id} game={game} />;
          })}
        </div>
      </section>
      <GamesCart />
    </div>
  );
}
