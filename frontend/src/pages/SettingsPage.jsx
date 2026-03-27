import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { clearAuthToken } from "../lib/auth.js";

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery(
    trpc.users.me.queryOptions()
  );

  if (isLoading) return <p>Loading...</p>;

  const handleLogout = () => {
    clearAuthToken();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  return (
    <div>
      <h1 style={{ margin: "0 0 1rem 0" }}>Settings</h1>
      <div
        style={{
          background: "white",
          padding: "1.5rem",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          maxWidth: "400px",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem" }}>User</h2>
        <p style={{ margin: "0 0 0.25rem 0" }}>
          <strong>Name:</strong> {user?.name ?? "—"}
        </p>
        <p style={{ margin: "0 0 0.25rem 0" }}>
          <strong>Username:</strong> {user?.username ?? "—"}
        </p>
        <p style={{ margin: "0 0 0.25rem 0" }}>
          <strong>Email:</strong> {user?.email ?? "—"}
        </p>
        <p style={{ margin: "0 0 1rem 0" }}>
          <strong>Role:</strong>{" "}
          <span
            style={{
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              fontSize: "0.75rem",
              background: "#f1f5f9",
            }}
          >
            {user?.role ?? "—"}
          </span>
        </p>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            padding: "0.5rem 1rem",
            background: "#0f172a",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
