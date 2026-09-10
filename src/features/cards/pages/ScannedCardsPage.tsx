import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getScannedCardsForUser } from "../api";
import { useAuth } from "../../auth/auth-context";

function formatScanTime(value?: string) {
  if (!value) {
    return "Unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }

  return parsed.toLocaleString();
}

export default function ScannedCardsPage() {
  const { userId } = useAuth();
  const [query, setQuery] = useState("");

  const scannedCardsQuery = useQuery({
    queryKey: ["scanned-cards", userId],
    queryFn: () => getScannedCardsForUser(userId as string),
    enabled: Boolean(userId),
  });

  const rows = scannedCardsQuery.data ?? [];

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return rows;
    }

    return rows.filter((row) =>
      [row.title, row.subtitle]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [rows, query]);

  return (
    <div className="page-stack admin-page">
      <section className="content-hero">
        <div>
          <h1>Scanned Cards</h1>
          <p className="content-hero-copy">
            Every card you've scanned, most recent first.
          </p>
        </div>
      </section>

      <section className="dash-panel admin-card">
        <div className="dash-panel-header">
          <h2 className="dash-panel-title">Filters</h2>
        </div>
        <div className="admin-filter-grid admin-filter-grid--single">
          <label>
            <span>Title or Subtitle</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search scanned cards"
            />
          </label>
        </div>
      </section>

      <section className="dash-panel admin-card">
        <div className="dash-panel-header">
          <h2 className="dash-panel-title">Results</h2>
          <span className="meta-pill">{filteredRows.length}</span>
        </div>

        {scannedCardsQuery.isLoading ? (
          <p className="dash-loading">Loading scanned cards...</p>
        ) : null}

        {scannedCardsQuery.isError ? (
          <p className="alert-error">Failed to load scanned cards.</p>
        ) : null}

        {!scannedCardsQuery.isLoading &&
        !scannedCardsQuery.isError &&
        rows.length === 0 ? (
          <p>You haven't scanned any cards yet.</p>
        ) : null}

        {!scannedCardsQuery.isLoading &&
        !scannedCardsQuery.isError &&
        rows.length > 0 &&
        filteredRows.length === 0 ? (
          <p>No scanned cards match your search.</p>
        ) : null}

        {filteredRows.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Subtitle</th>
                  <th>First Scan Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.card_id}
                    className="admin-table-row--clickable"
                    onClick={() => {
                      if (row.url) {
                        window.location.href = row.url;
                      }
                    }}
                  >
                    <td>{row.title}</td>
                    <td>{row.subtitle}</td>
                    <td>{formatScanTime(row.create_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
