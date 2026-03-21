import { useQuery } from "@tanstack/react-query";
import { trpc } from "../../lib/trpc.js";

export function ProjectList() {
  const { data: projects } = useQuery(trpc.projects.list.queryOptions());

  return (
    <div>
      <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem" }}>Projects</h3>
      {projects?.length === 0 && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>
          No projects
        </p>
      )}
      {projects?.map((p) => (
        <div
          key={p.id}
          style={{
            padding: "0.5rem 0",
            borderBottom: "1px solid #e2e8f0",
            fontSize: "0.875rem",
          }}
        >
          {p.name}
        </div>
      ))}
    </div>
  );
}
