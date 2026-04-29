import { StrictMode } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import LoginPage from "./LoginPage.tsx";
import SignupPage from "./SignupPage.tsx";
import {
  API_BASE_URL,
  REFRESH_TOKEN_STORAGE_KEY,
  clearStoredAuth,
  isAuthenticated,
} from "./auth";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={isAuthenticated() ? "/whiteboard" : "/login"} replace />}
        />
        <Route
          path="/login"
          element={isAuthenticated() ? <Navigate to="/whiteboard" replace /> : <LoginPage />}
        />
        <Route
          path="/signup"
          element={isAuthenticated() ? <Navigate to="/whiteboard" replace /> : <SignupPage />}
        />
        <Route
          path="/whiteboard"
          element={
            <ProtectedRoute>
              <WhiteboardRoute />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);

function WhiteboardRoute() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (refreshToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Client logout should still complete even if network request fails.
      }
    }

    clearStoredAuth();
    navigate("/login", { replace: true });
  };

  return <App onLogout={handleLogout} />;
}

type ProtectedRouteProps = {
  children: ReactElement;
};

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const hasAccessToken = Boolean(localStorage.getItem("accessToken"));
  return hasAccessToken ? children : <Navigate to="/login" replace />;
}
