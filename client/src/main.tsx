import { StrictMode, useEffect, useState } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import DashboardPage from "./DashboardPage.tsx";
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
      <Route path="/" element={<Navigate to={isAuthed ? "/dashboard" : "/login"} replace />} />
      <Route path="/login" element={isAuthed ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/signup" element={isAuthed ? <Navigate to="/dashboard" replace /> : <SignupPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute isAuthed={isAuthed}>
            <DashboardRoute />
          </ProtectedRoute>
        }
      />
      <Route
        path="/room/:roomId"
        element={
          <ProtectedRoute isAuthed={isAuthed}>
            <RoomRoute />
          </ProtectedRoute>
        }
      />
      <Route
        path="/whiteboard"
        element={
          <ProtectedRoute isAuthed={isAuthed}>
            <WhiteboardRoute />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={isAuthed ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

function useValidatedSession() {
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
        await fetch(`${API_BASE_URL}/logout`, {
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

  return { isReady, handleLogout };
}

function DashboardRoute() {
  const { isReady, handleLogout } = useValidatedSession();

  if (!isReady) {
    return <div>Redirecting to login...</div>;
  }

  return <DashboardPage onLogout={() => void handleLogout()} />;
}

function RoomRoute() {
  const { roomId } = useParams<{ roomId: string }>();
  const { isReady, handleLogout } = useValidatedSession();
  const decodedRoomId = roomId ? decodeURIComponent(roomId) : "";

  if (!isReady) {
    return <div>Redirecting to login...</div>;
  }

  if (!decodedRoomId) {
    return <Navigate to="/dashboard" replace />;
  }

  return <App onLogout={() => void handleLogout()} initialRoomId={decodedRoomId} />;
}

function WhiteboardRoute() {
  const { isReady, handleLogout } = useValidatedSession();

  if (!isReady) {
    return <div>Redirecting to login...</div>;
  }

  return <App onLogout={() => void handleLogout()} />;
}

type ProtectedRouteProps = {
  children: ReactElement;
  isAuthed: boolean;
};

function ProtectedRoute({ children, isAuthed }: ProtectedRouteProps) {
  return isAuthed ? children : <Navigate to="/login" replace />;
}
