import {
  Navigate,
  Outlet,
  createBrowserRouter,
  useLocation,
} from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "../features/auth/auth-context";
import LoginPage from "../features/auth/pages/LoginPage";
import RegisterPage from "../features/auth/pages/RegisterPage";
import ActivateAccountPage from "../features/auth/pages/ActivateAccountPage";
import RequestPasswordResetPage from "../features/auth/pages/RequestPasswordResetPage";
import ResetPasswordPage from "../features/auth/pages/ResetPasswordPage";
import DashboardPage from "../features/dashboard/DashboardPage";
import CardDetailPage from "../features/cards/pages/CardDetailPage";
import CardCreatePage from "../features/cards/pages/CardCreatePage";
import GetCardsPage from "../features/cards/pages/GetCardsPage";
import CardViewerPage from "../features/cards/pages/CardViewerPage";
import AppLayout from "../features/layout/AppLayout";
import HomePage from "../features/home/HomePage";
import { GamesListPage, GameDetailPage } from "../features/games/pages";
import { GamesCartProvider } from "../features/games/context";
import ContactUsPage from "../features/home/ContactUsPage";
import PaymentSuccessPage from "../features/transactions/pages/PaymentSuccessPage";
import PaymentCancelPage from "../features/transactions/pages/PaymentCancelPage";
import SettingsPage from "../features/settings/SettingsPage";
import AdminDashboardPage from "../features/admin/pages/AdminDashboardPage";
import AdminUsersPage from "../features/admin/pages/AdminUsersPage";
import AdminUserDetailPage from "../features/admin/pages/AdminUserDetailPage";
import AdminAccessDeniedPage from "../features/admin/pages/AdminAccessDeniedPage";
import AdminOrdersPage from "../features/admin/pages/AdminOrdersPage";
import AdminOrderDetailPage from "../features/admin/pages/AdminOrderDetailPage";
import SiteFooter from "../features/layout/SiteFooter";
import LegalDocumentPage from "../features/legal/pages/LegalDocumentPage";
import LegalOverviewPage from "../features/legal/pages/LegalOverviewPage";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, userPermissions } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = userPermissions.some(
    (permission) => permission.toUpperCase() === "ADMIN",
  );

  if (!isAdmin) {
    return <Navigate to="/app/access-denied" replace />;
  }

  return children;
}

function FooterLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="site-shell">
      <div className="site-shell__content">
        <Outlet />
      </div>
      <SiteFooter />
    </div>
  );
}

function GamesLayout() {
  return (
    <GamesCartProvider>
      <Outlet />
    </GamesCartProvider>
  );
}

function StandalonePageLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <StandalonePageLayout />,
    children: [
      {
        path: "/legal/:documentId",
        element: <LegalDocumentPage />,
      },
      {
        path: "/legal",
        element: <LegalOverviewPage />,
      },
      {
        path: "/cardviewer/:id",
        element: <CardViewerPage />,
      },
    ],
  },
  {
    element: <FooterLayout />,
    children: [
      {
        path: "/",
        element: <HomePage />,
      },
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/register",
        element: <RegisterPage />,
      },
      {
        path: "/contactus",
        element: <ContactUsPage />,
      },
      {
        path: "/activate",
        element: <ActivateAccountPage />,
      },
      {
        path: "/request-password-reset",
        element: <RequestPasswordResetPage />,
      },
      {
        path: "/reset-password",
        element: <ResetPasswordPage />,
      },
      {
        path: "/payment/success",
        element: (
          <ProtectedRoute>
            <PaymentSuccessPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/payment/cancel",
        element: (
          <ProtectedRoute>
            <PaymentCancelPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/app",
        element: (
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <Navigate to="dashboard" replace />,
          },
          {
            path: "dashboard",
            element: <DashboardPage />,
          },
          {
            path: "cards/new",
            element: <CardCreatePage />,
          },
          {
            path: "cards/:cardId",
            element: <CardDetailPage />,
          },
          {
            path: "cards/:cardId/get-cards",
            element: <GetCardsPage />,
          },
          {
            path: "games",
            element: <GamesLayout />,
            children: [
              {
                index: true,
                element: <GamesListPage />,
              },
              {
                path: ":gameId",
                element: <GameDetailPage />,
              },
            ],
          },
          {
            path: "settings",
            element: <SettingsPage />,
          },
          {
            path: "access-denied",
            element: <AdminAccessDeniedPage />,
          },
          {
            path: "admin",
            element: (
              <AdminRoute>
                <AdminDashboardPage />
              </AdminRoute>
            ),
          },
          {
            path: "admin/users",
            element: (
              <AdminRoute>
                <AdminUsersPage />
              </AdminRoute>
            ),
          },
          {
            path: "admin/users/:userId",
            element: (
              <AdminRoute>
                <AdminUserDetailPage />
              </AdminRoute>
            ),
          },
          {
            path: "admin/orders",
            element: (
              <AdminRoute>
                <AdminOrdersPage />
              </AdminRoute>
            ),
          },
          {
            path: "admin/orders/:orderId",
            element: (
              <AdminRoute>
                <AdminOrderDetailPage />
              </AdminRoute>
            ),
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
