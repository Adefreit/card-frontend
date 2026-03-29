import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";

export default function AppLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand">Card Frontend</div>
        <nav>
          <Link to="/app/cards">Cards</Link>
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
