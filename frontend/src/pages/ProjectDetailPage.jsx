import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";

export function ProjectDetailPage() {
  const { id } = useParams();
  const { data: project, isLoading } = useQuery(
    trpc.projects.getById.queryOptions({ id: id || "" })
  );

  if (isLoading) return <p>Loading...</p>;
  if (!project) return <p>Project not found</p>;

  return (
    <div>
      <Link
        to="/projects"
        style={{ color: "#2563eb", textDecoration: "none", marginBottom: "1rem", display: "inline-block" }}
      >
        ← Back to Projects
      </Link>
      <h1 style={{ margin: "0 0 1rem 0" }}>{project.name}</h1>
      <div
        style={{
          background: "white",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <p style={{ margin: "0 0 0.5rem 0" }}>
          <strong>Node:</strong> {project.node} | <strong>Instance:</strong>{" "}
          {project.instance} | <strong>Status:</strong> {project.status}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Total passings:</strong> {project.totalPassings}
        </p>
      </div>
      <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem" }}>Poles</h2>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          background: "white",
          borderRadius: "8px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          marginBottom: "1rem",
        }}
      >
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Pole #</th>
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Street</th>
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {project.poles?.map((pole) => (
            <tr key={pole.id} style={{ borderTop: "1px solid #e2e8f0" }}>
              <td style={{ padding: "0.75rem" }}>{pole.poleNumber}</td>
              <td style={{ padding: "0.75rem" }}>{pole.streetName || "—"}</td>
              <td style={{ padding: "0.75rem" }}>{pole.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem" }}>Equipment</h2>
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
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Tag</th>
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Name</th>
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Type</th>
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Pole</th>
          </tr>
        </thead>
        <tbody>
          {project.equipment?.map((eq) => (
            <tr key={eq.id} style={{ borderTop: "1px solid #e2e8f0" }}>
              <td style={{ padding: "0.75rem" }}>{eq.tag}</td>
              <td style={{ padding: "0.75rem" }}>{eq.name}</td>
              <td style={{ padding: "0.75rem" }}>{eq.equipType}</td>
              <td style={{ padding: "0.75rem" }}>{eq.pole?.poleNumber}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
