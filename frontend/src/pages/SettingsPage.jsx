import { useQuery } from "@tanstack/react-query";
import { trpc } from "../lib/trpc.js";

export function SettingsPage() {
  const { data: user, isLoading } = useQuery(
    trpc.users.me.queryOptions()
  );

  if (isLoading) return <p>Loading...</p>;
  const email = localStorage.getItem("fiberops-user-email");

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
          <strong>Email:</strong> {user?.email ?? email ?? "—"}
        </p>
        <p style={{ margin: 0 }}>
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
      </div>
    </div>
  );
}
