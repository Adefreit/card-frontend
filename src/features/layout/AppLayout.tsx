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
          <Link className="brand" to="/app/dashboard">
            <span className="brand-mark" aria-hidden="true">
              <img className="brand-mark__image" src="/favicon.png" alt="" />
            </span>
            <span className="brand-text">Legendary Profiles</span>
          </Link>
          <span className="brand-tag">Workspace</span>
        </div>
        <nav>
          <Link to="/app/dashboard">Home</Link>
          <Link to="/app/settings">Settings</Link>
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
