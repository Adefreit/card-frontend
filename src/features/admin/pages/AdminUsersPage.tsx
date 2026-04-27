import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAdminUsers } from "../api";

const DEFAULT_PAGE_SIZE = 25;

function shortId(value?: string) {
  if (!value) return "-";
  return value.length <= 10 ? value : `${value.slice(0, 10)}...`;
}

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({
      q: query.trim() || undefined,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
    }),
    [page, query],
  );

  const usersQuery = useQuery({
    queryKey: ["admin", "users", filters],
    queryFn: () => getAdminUsers(filters),
    placeholderData: (previous) => previous,
  });

  const rows = usersQuery.data?.users ?? [];
  const hasNextPage = rows.length >= DEFAULT_PAGE_SIZE;

  return (
    <div className="page-stack admin-page">
      <section className="content-hero">
        <div>
          <h1>Admin Users</h1>
          <p className="content-hero-copy">
            Search and manage users, permissions, subscriptions, and cards.
          </p>
        </div>
      </section>

      <section className="dash-panel admin-card">
        <div className="dash-panel-header">
          <h2 className="dash-panel-title">Filters</h2>
        </div>
        <div className="admin-filter-grid admin-filter-grid--single">
          <label>
            <span>Email or User ID</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search by email or user ID"
            />
          </label>
        </div>
      </section>

      <section className="dash-panel admin-card">
        <div className="dash-panel-header">
          <h2 className="dash-panel-title">User Results</h2>
          <span className="meta-pill">Page {page}</span>
        </div>

        {usersQuery.isLoading ? (
          <p className="dash-loading">Loading users...</p>
        ) : null}

        {usersQuery.isError ? (
          <p className="alert-error">Failed to load users. Try again.</p>
        ) : null}

        {!usersQuery.isLoading && !usersQuery.isError && rows.length === 0 ? (
          <p>No users found for the current filters.</p>
        ) : null}

        {rows.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Activated</th>
                  <th>Subscription Active</th>
                  <th>Permissions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <Link
                        className="admin-copy-chip"
                        to={`/app/admin/users/${user.id}`}
                        title={user.id}
                      >
                        {shortId(user.id)}
                        <span className="admin-copy-chip__icon">↗</span>
                      </Link>
                    </td>
                    <td>{user.email ?? "-"}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(user.activated)}
                        readOnly
                        disabled
                        aria-label={`User ${user.id} activated`}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(
                          user.account_subscription_until &&
                          new Date(user.account_subscription_until).getTime() >
                            Date.now(),
                        )}
                        readOnly
                        disabled
                        aria-label={`User ${user.id} subscription active`}
                      />
                    </td>
                    <td>
                      <div className="admin-chip-list">
                        {(user.permissions ?? []).length === 0 ? (
                          <span className="admin-chip admin-chip--muted">
                            None
                          </span>
                        ) : (
                          <span
                            className={`admin-chip${(user.permissions ?? []).includes("ADMIN") ? " admin-chip--admin" : ""}`}
                            title={(user.permissions ?? []).join(", ")}
                            aria-label={`User permissions: ${(user.permissions ?? []).join(", ")}`}
                          >
                            {(user.permissions ?? []).length} permission
                            {(user.permissions ?? []).length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="admin-pagination">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1 || usersQuery.isFetching}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPage((current) => current + 1)}
            disabled={!hasNextPage || usersQuery.isFetching}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
