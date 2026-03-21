import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";

export function ProjectsPage() {
  const { data: projects, isLoading } = useQuery(
    trpc.projects.list.queryOptions()
  );

  if (isLoading) return <p>Loading...</p>;
  if (!projects) return <p>No projects</p>;

  return (
    <div>
      <h1 style={{ margin: "0 0 1rem 0" }}>Projects</h1>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          background: "white",
          borderRadius: "8px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Name</th>
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Node</th>
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Status</th>
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Passings</th>
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Created</th>
            <th style={{ padding: "0.75rem", textAlign: "left" }}></th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} style={{ borderTop: "1px solid #e2e8f0" }}>
              <td style={{ padding: "0.75rem" }}>{p.name}</td>
              <td style={{ padding: "0.75rem" }}>{p.node}</td>
              <td style={{ padding: "0.75rem" }}>
                <span
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    background:
                      p.status === "ACTIVE"
                        ? "#dcfce7"
                        : p.status === "PENDING"
                          ? "#fef3c7"
                          : "#f1f5f9",
                  }}
                >
                  {p.status}
                </span>
              </td>
              <td style={{ padding: "0.75rem" }}>{p.totalPassings}</td>
              <td style={{ padding: "0.75rem" }}>
                {new Date(p.createdAt).toLocaleDateString()}
              </td>
              <td style={{ padding: "0.75rem" }}>
                <Link
                  to={`/projects/${p.id}`}
                  style={{ color: "#2563eb", textDecoration: "none" }}
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
