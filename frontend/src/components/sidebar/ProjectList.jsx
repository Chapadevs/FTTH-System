import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "../../lib/trpc.js";

export function ProjectList({ visibleProjectIds = [], onVisibleChange }) {
  const queryClient = useQueryClient();
  const { data: projects } = useQuery(trpc.projects.list.queryOptions());
  const deleteAllProjects = useMutation(
    trpc.projects.deleteAll.mutationOptions({
      onSuccess: () => {
        onVisibleChange?.([]);
        queryClient.invalidateQueries({ queryKey: [["projects"]] });
        queryClient.invalidateQueries({ queryKey: [["map"]] });
      },
    })
  );

  const toggle = (id) => {
    const selected = visibleProjectIds ?? [];
    if (selected.length === 0) {
      onVisibleChange?.(projects?.filter((p) => p.id !== id).map((p) => p.id) ?? []);
    } else {
      if (selected.includes(id)) {
        const next = selected.filter((x) => x !== id);
        onVisibleChange?.(next.length ? next : []);
      } else {
        onVisibleChange?.([...selected, id]);
      }
    }
  };

  const showAll = () => onVisibleChange?.([]);
  const isFiltered = (visibleProjectIds?.length ?? 0) > 0;
  const isChecked = (id) => !isFiltered || visibleProjectIds?.includes(id);
  const hasProjects = (projects?.length ?? 0) > 0;

  const handleDeleteAll = async () => {
    if (!hasProjects || deleteAllProjects.isPending) return;
    const confirmed = window.confirm("Remove all imported projects and their map/fiber data?");
    if (!confirmed) return;
    try {
      await deleteAllProjects.mutateAsync();
    } catch (err) {
      alert("Failed to remove projects: " + (err?.message || "Unknown error"));
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Projects</h3>
        <div style={{ display: "flex", gap: "0.35rem" }}>
          {isFiltered && (
            <button
              onClick={showAll}
              style={{
                fontSize: "0.7rem",
                padding: "0.2rem 0.4rem",
                border: "none",
                background: "#f1f5f9",
                cursor: "pointer",
                borderRadius: "4px",
              }}
            >
              Show all
            </button>
          )}
          {hasProjects && (
            <button
              onClick={handleDeleteAll}
              disabled={deleteAllProjects.isPending}
              style={{
                fontSize: "0.7rem",
                padding: "0.2rem 0.4rem",
                border: "none",
                background: "#fee2e2",
                color: "#991b1b",
                cursor: deleteAllProjects.isPending ? "progress" : "pointer",
                borderRadius: "4px",
                opacity: deleteAllProjects.isPending ? 0.7 : 1,
              }}
            >
              {deleteAllProjects.isPending ? "Removing..." : "Remove all"}
            </button>
          )}
        </div>
      </div>
      {projects?.length === 0 && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>No projects</p>
      )}
      {projects?.map((p) => {
        const visible = !isFiltered || visibleProjectIds.includes(p.id);
        return (
          <div
            key={p.id}
            onClick={() => toggle(p.id)}
            style={{
              padding: "0.5rem 0",
              borderBottom: "1px solid #e2e8f0",
              fontSize: "0.875rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              opacity: isChecked(p.id) ? 1 : 0.5,
            }}
          >
            <input
              type="checkbox"
              checked={isChecked(p.id)}
              onChange={() => toggle(p.id)}
              onClick={(e) => e.stopPropagation()}
            />
            {p.name}
          </div>
        );
      })}
    </div>
  );
}
