import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getCards } from "../api";

export default function CardsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cards"],
    queryFn: getCards,
  });

  return (
    <div className="page-stack">
      <section className="content-hero">
        <div>
          <p className="section-kicker">Your workspace</p>
          <h1>Profile cards</h1>
          <p className="content-hero-copy">
            Organize the profile cards behind Legendary Profiles and keep every
            update sharp, consistent, and ready to share.
          </p>
        </div>
        <Link className="btn-primary btn-lg" to="/app/cards/new">
          Create new card
        </Link>
      </section>

      <section className="content-card content-card-wide">
        <div className="row-between">
          <h2>Your cards</h2>
          <span className="meta-pill">{data?.length ?? 0} total</span>
        </div>

        {isLoading ? <p>Loading cards...</p> : null}
        {isError ? <p className="alert-error">Failed to load cards.</p> : null}
        {!isLoading && !isError && data?.length === 0 ? (
          <div className="empty-state">
            <h3>No cards yet</h3>
            <p>
              Create your first card to start shaping your member experience.
            </p>
            <Link className="btn-secondary" to="/app/cards/new">
              Create your first card
            </Link>
          </div>
        ) : null}

        <div className="cards-grid">
          {data?.map((card) => (
            <article key={card.id} className="card-item">
              <div className="card-item-top">
                <span className="meta-pill">Profile card</span>
              </div>
              <h3>{card.data.title}</h3>
              <p>{card.data.subtitle || "No subtitle yet"}</p>
              <Link className="card-link" to={`/app/cards/${card.id}`}>
                Open details
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
