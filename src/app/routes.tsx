import { Navigate, createBrowserRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../features/auth/auth-context";
import LoginPage from "../features/auth/pages/LoginPage";
import RegisterPage from "../features/auth/pages/RegisterPage";
import ActivateAccountPage from "../features/auth/pages/ActivateAccountPage";
import RequestPasswordResetPage from "../features/auth/pages/RequestPasswordResetPage";
import ResetPasswordPage from "../features/auth/pages/ResetPasswordPage";
import CardsPage from "../features/cards/pages/CardsPage";
import CardDetailPage from "../features/cards/pages/CardDetailPage";
import CardCreatePage from "../features/cards/pages/CardCreatePage";
import AppLayout from "../features/layout/AppLayout";
import HomePage from "../features/home/HomePage";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export const router = createBrowserRouter([
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
    path: "/app",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="cards" replace />,
      },
      {
        path: "cards",
        element: <CardsPage />,
      },
      {
        path: "cards/new",
        element: <CardCreatePage />,
      },
      {
        path: "cards/:cardId",
        element: <CardDetailPage />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
