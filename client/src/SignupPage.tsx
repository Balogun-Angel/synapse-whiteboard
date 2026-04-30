import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./auth";

function SignupPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedUsername || !trimmedEmail || !password || !confirmPassword) {
      setStatus("Please fill all required fields");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setStatus("");

    try {
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmedUsername,
          email: trimmedEmail,
          password,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message || "Signup failed");
      }

      navigate("/login", {
        replace: true,
        state: { message: "Account created. Please log in." },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Signup failed";
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
          <h2 className="auth-title">Sign Up</h2>
          <p className="auth-subtitle">Join the Synapse collaboration.</p>
          <form className="auth-form-page" onSubmit={handleSubmit}>
            <label className="auth-label" htmlFor="signup-username">
              Username
            </label>
            <input
              id="signup-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="auth-input"
              placeholder="Full Name"
            />

            <label className="auth-label" htmlFor="signup-email">
              Email Address
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="auth-input"
              placeholder="Email Address"
            />

            <label className="auth-label" htmlFor="signup-password">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="auth-input"
              placeholder="Password"
            />

            <label className="auth-label" htmlFor="signup-confirm-password">
              Confirm Password
            </label>
            <input
              id="signup-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="auth-input"
              placeholder="Confirm Password"
            />

            <button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Account"}
            </button>
          </form>
          {status ? <p className="auth-status">{status}</p> : null}
          <p className="auth-link-row">
            Already have an account? <Link to="/login">Log In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
