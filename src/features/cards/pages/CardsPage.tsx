import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getCards } from "../api";

export default function CardsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cards"],
    queryFn: getCards,
  });

  return (
    <section className="content-card">
      <div className="row-between">
        <h2>Your Cards</h2>
        <Link className="btn-secondary" to="/app/cards/new">
          New Card
        </Link>
      </div>

      {isLoading ? <p>Loading cards...</p> : null}
      {isError ? <p>Failed to load cards.</p> : null}
      {!isLoading && !isError && data?.length === 0 ? (
        <p>No cards yet. Create your first one.</p>
      ) : null}

      <div className="cards-grid">
        {data?.map((card) => (
          <article key={card.id} className="card-item">
            <h3>{card.data.title}</h3>
            <p>{card.data.subtitle || "No subtitle"}</p>
            <Link to={`/app/cards/${card.id}`}>Open</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
