import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";

export function EquipmentPage() {
  const [search, setSearch] = useState("");
  const { data: equipment, isLoading } = useQuery(
    trpc.equipment.list.queryOptions()
  );

  if (isLoading) return <p>Loading...</p>;
  const filtered = equipment?.filter(
    (e) =>
      !search ||
      e.tag.toLowerCase().includes(search.toLowerCase()) ||
      e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 style={{ margin: "0 0 1rem 0" }}>Equipment</h1>
      <input
        type="text"
        placeholder="Search by tag or name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: "0.5rem 0.75rem",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          marginBottom: "1rem",
          width: "280px",
        }}
      />
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
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Model</th>
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Type</th>
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Ports</th>
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Pole</th>
            <th style={{ padding: "0.75rem", textAlign: "left" }}>Project</th>
          </tr>
        </thead>
        <tbody>
          {filtered?.map((e) => (
            <tr key={e.id} style={{ borderTop: "1px solid #e2e8f0" }}>
              <td style={{ padding: "0.75rem" }}>{e.tag}</td>
              <td style={{ padding: "0.75rem" }}>{e.name}</td>
              <td style={{ padding: "0.75rem" }}>{e.model}</td>
              <td style={{ padding: "0.75rem" }}>
                <span
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    background:
                      e.equipType === "SPLITTER" ? "#fef3c7" : "#fce7f3",
                  }}
                >
                  {e.equipType}
                </span>
              </td>
              <td style={{ padding: "0.75rem" }}>{e.portCount ?? "—"}</td>
              <td style={{ padding: "0.75rem" }}>{e.pole?.poleNumber}</td>
              <td style={{ padding: "0.75rem" }}>
                <Link
                  to={`/projects/${e.project?.id}`}
                  style={{ color: "#2563eb", textDecoration: "none" }}
                >
                  {e.project?.name}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
