import { StrictMode, useEffect, useState } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import LoginPage from "./LoginPage.tsx";
import SignupPage from "./SignupPage.tsx";
import {
  API_BASE_URL,
  AUTH_CHANGED_EVENT,
  clearStoredAuth,
  ensureValidAccessToken,
  getStoredRefreshToken,
  isAuthenticated,
} from "./auth";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>,
);

function AppRoutes() {
  const [isAuthed, setIsAuthed] = useState(() => isAuthenticated());

  useEffect(() => {
    const syncAuthState = () => {
      setIsAuthed(isAuthenticated());
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.includes("access_token") || event.key.includes("refresh_token") || event.key === "accessToken" || event.key === "refreshToken" || event.key === "authUser") {
        syncAuthState();
      }
    };

    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthState);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthState);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthed ? "/whiteboard" : "/login"} replace />} />
      <Route path="/login" element={isAuthed ? <Navigate to="/whiteboard" replace /> : <LoginPage />} />
      <Route path="/signup" element={isAuthed ? <Navigate to="/whiteboard" replace /> : <SignupPage />} />
      <Route
        path="/whiteboard"
        element={
          <ProtectedRoute isAuthed={isAuthed}>
            <WhiteboardRoute />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={isAuthed ? "/whiteboard" : "/login"} replace />} />
    </Routes>
  );
}

function WhiteboardRoute() {
  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(() => isAuthenticated());

  const handleSessionInvalid = () => {
    clearStoredAuth();
    setIsReady(false);
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    let isMounted = true;

    const validateSession = async () => {
      const hasValidAccessToken = await ensureValidAccessToken();
      if (!hasValidAccessToken) {
        handleSessionInvalid();
        return;
      }

      if (isMounted) {
        setIsReady(true);
      }
    };

    void validateSession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleLogout = async () => {
    const refreshToken = getStoredRefreshToken();
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
    setIsReady(false);
    navigate("/login", { replace: true });
  };

  if (!isReady) {
    return <div>Redirecting to login...</div>;
  }

  return <App onLogout={handleLogout} />;
}

type ProtectedRouteProps = {
  children: ReactElement;
  isAuthed: boolean;
};

function ProtectedRoute({ children, isAuthed }: ProtectedRouteProps) {
  return isAuthed ? children : <Navigate to="/login" replace />;
}
