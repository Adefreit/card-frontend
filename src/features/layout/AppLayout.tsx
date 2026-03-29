import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";

export default function AppLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <div className="app-orb app-orb-left" aria-hidden="true"></div>
      <div className="app-orb app-orb-right" aria-hidden="true"></div>
      <header className="top-nav">
        <div className="brand-lockup">
          <Link className="brand" to="/">
            Legendary Profiles
          </Link>
          <span className="brand-tag">Workspace</span>
        </div>
        <nav>
          <Link to="/app/cards">Profiles</Link>
          <Link to="/app/cards/new">Create</Link>
          <button
            type="button"
            className="btn-quiet"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Logout
          </button>
        </nav>
      </header>
      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}
