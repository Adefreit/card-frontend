import { Link } from "react-router-dom";
import type { GamePackProduct } from "../api";

export function GameCard({ game }: { game: GamePackProduct }) {
  return (
    <Link className="games-card" to={`/app/games/${game.id}`}>
      <img
        src={`/games/${game.id}_01.jpg`}
        alt={game.name}
        className="games-card-image"
        onError={(e) => (e.currentTarget.src = "/games/missing.jpg")}
      />
      <div className="games-card-info">
        <h3>{game.name}</h3>
        <div className="games-card-price">
          {new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: game.currency.toUpperCase(),
          }).format(game.unitAmountCents / 100)}
        </div>
      </div>
    </Link>
  );
}
