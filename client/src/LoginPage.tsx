import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  API_BASE_URL,
  storeAuthTokens,
} from "./auth";

type AuthUser = {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type LocationState = {
  message?: string;
};

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(locationState?.message || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const formEmail = formData.get("email");
    const formPassword = formData.get("password");

    // Use form values first to handle browser autofill cases
    // where React state is not updated before submit.
    const resolvedEmail =
      typeof formEmail === "string" && formEmail.trim()
        ? formEmail
        : email;
    const resolvedPassword =
      typeof formPassword === "string" && formPassword
        ? formPassword
        : password;

    const trimmedEmail = resolvedEmail.trim().toLowerCase();

    if (!trimmedEmail || !resolvedPassword) {
      setStatus("Please enter email and password");
      return;
    }

    setIsLoading(true);
    setStatus("");

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password: resolvedPassword,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message || "Login failed");
      }

      const authData = (await response.json()) as AuthResponse;
      storeAuthTokens(authData.accessToken, authData.refreshToken);
      localStorage.setItem("authUser", JSON.stringify(authData.user));
      navigate("/whiteboard", { replace: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Login failed";
      setStatus(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card-wrap">
        <h1 className="auth-brand">Synapse</h1>
        <div className="auth-card">
          <h2 className="auth-title">Log In</h2>
          <p className="auth-subtitle">Welcome back to Synapse</p>
          <form className="auth-form-page" onSubmit={handleSubmit}>
            <label className="auth-label" htmlFor="login-email">
              Email Address
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="auth-input"
              placeholder="Email Address"
              autoComplete="email"
            />

            <label className="auth-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="auth-input"
              placeholder="Password"
              autoComplete="current-password"
            />

            <button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Log In"}
            </button>
          </form>
          {status ? <p className="auth-status">{status}</p> : null}
          <p className="auth-link-row">
            Don&apos;t have an account? <Link to="/signup">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
