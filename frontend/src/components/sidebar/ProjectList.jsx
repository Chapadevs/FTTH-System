import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "../../lib/trpc.js";

const rowStyle = {
  padding: "0.12rem 0",
  borderBottom: "1px solid #f1f5f9",
  fontSize: "0.62rem",
  lineHeight: 1.15,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "0.28rem",
};

const btnBase = {
  fontSize: "0.55rem",
  padding: "0.06rem 0.28rem",
  border: "none",
  borderRadius: "3px",
  cursor: "pointer",
  lineHeight: 1.1,
};

export function ProjectList({ visibleProjectIds = [], onVisibleChange, onShowProjectOnMap, onImport }) {
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
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.2rem",
          marginBottom: "0.22rem",
        }}
      >
        <span
          style={{
            margin: 0,
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "#0f172a",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          Projects
        </span>
        <div style={{ display: "flex", gap: "0.18rem", flexShrink: 0, alignItems: "center" }}>
          {onImport && (
            <button
              type="button"
              onClick={onImport}
              style={{
                ...btnBase,
                background: "#0f172a",
                color: "white",
                fontWeight: 700,
                borderRadius: "999px",
                padding: "0.1rem 0.38rem",
                fontSize: "0.55rem",
                letterSpacing: "0.02em",
              }}
            >
              Import
            </button>
          )}
          {isFiltered && (
            <button type="button" onClick={showAll} style={{ ...btnBase, background: "#f1f5f9", color: "#334155" }}>
              All
            </button>
          )}
          {hasProjects && (
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={deleteAllProjects.isPending}
              style={{
                ...btnBase,
                background: "#fee2e2",
                color: "#991b1b",
                cursor: deleteAllProjects.isPending ? "progress" : "pointer",
                opacity: deleteAllProjects.isPending ? 0.7 : 1,
              }}
            >
              {deleteAllProjects.isPending ? "…" : "Clear"}
            </button>
          )}
        </div>
      </div>
      {projects?.length === 0 && (
        <p style={{ margin: 0, fontSize: "0.58rem", color: "#94a3b8", lineHeight: 1.2 }}>None</p>
      )}
      {projects?.map((p) => {
        const visible = !isFiltered || visibleProjectIds.includes(p.id);
        return (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() => toggle(p.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggle(p.id);
              }
            }}
            style={{
              ...rowStyle,
              opacity: isChecked(p.id) ? 1 : 0.45,
            }}
          >
            <input
              type="checkbox"
              checked={isChecked(p.id)}
              onChange={() => toggle(p.id)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "11px",
                height: "11px",
                margin: "0.05rem 0 0 0",
                flexShrink: 0,
                cursor: "pointer",
              }}
            />
            <span
              title={p.name}
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "#334155",
              }}
            >
              {p.name}
            </span>
            {onShowProjectOnMap && (
              <button
                type="button"
                aria-label="Show project on map"
                title="Show on map"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowProjectOnMap(p.id);
                }}
                style={{
                  ...btnBase,
                  flexShrink: 0,
                  background: "#e0f2fe",
                  color: "#0369a1",
                  fontWeight: 700,
                  padding: "0.04rem 0.32rem",
                }}
              >
                Map
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
