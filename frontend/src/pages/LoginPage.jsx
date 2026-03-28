import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthToken, setAuthToken } from "../lib/auth.js";

export function LoginPage() {
  const [username, setUsername] = useState(import.meta.env.DEV ? "dev" : "paudeinox");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (getAuthToken()) {
      navigate("/map", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Username and password are required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "" : "http://localhost:3000");
      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.token) {
        throw new Error(data.error || "Login failed.");
      }

      setAuthToken(data.token);
      navigate("/map", { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f1f5f9",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "2rem",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          width: "320px",
        }}
      >
        <h1 style={{ margin: "0 0 1.5rem 0", fontSize: "1.5rem" }}>
          FiberOps
        </h1>
        <p style={{ color: "#64748b", marginBottom: "1rem", fontSize: "0.875rem" }}>
          {import.meta.env.DEV
            ? "Local dev: any username and password (starts a mock admin session)."
            : "Sign in with your account."}
        </p>
        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              marginBottom: "1rem",
            }}
            autoComplete="username"
          />
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              marginBottom: "1rem",
            }}
            autoComplete="current-password"
          />
          {error ? (
            <p style={{ margin: "0 0 1rem 0", color: "#b91c1c", fontSize: "0.875rem" }}>
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "0.5rem 1rem",
              background: "#0f172a",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
