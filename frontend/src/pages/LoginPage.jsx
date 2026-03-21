import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function LoginPage() {
  const [email, setEmail] = useState("admin@fiberops.com");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email.trim()) {
      localStorage.setItem("fiberops-user-email", email.trim());
      navigate("/map");
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
          Internal profile selector (Phase 1 — no auth)
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
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              marginBottom: "1rem",
            }}
          />
          <button
            type="submit"
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
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
