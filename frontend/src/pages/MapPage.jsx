import { useState } from "react";
import { MapView } from "../components/map/MapView.jsx";
import { ProjectList } from "../components/sidebar/ProjectList.jsx";
import { ImportDialog } from "../components/import/ImportDialog.jsx";
import { DetailSheet } from "../components/detail/DetailSheet.jsx";

export function MapPage() {
  const [selected, setSelected] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [visibleProjectIds, setVisibleProjectIds] = useState([]);

  return (
    <div
      style={{
        height: "calc(100vh - 2rem)",
        minHeight: 0,
        position: "relative",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          zIndex: 700,
          width: "220px",
          maxHeight: "calc(100% - 2rem)",
          background: "white",
          padding: "0.55rem",
          borderRadius: "10px",
          boxShadow: "0 6px 14px rgba(15, 23, 42, 0.08)",
          overflowY: "auto",
        }}
      >
        <ProjectList
          visibleProjectIds={visibleProjectIds}
          onVisibleChange={setVisibleProjectIds}
        />
      </div>
      <button
        onClick={() => setImportOpen(true)}
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          zIndex: 800,
          padding: "0.38rem 0.72rem",
          background: "#0f172a",
          color: "white",
          border: "none",
          borderRadius: "999px",
          cursor: "pointer",
          fontWeight: 700,
          fontSize: "0.76rem",
          letterSpacing: "0.02em",
          boxShadow: "0 6px 14px rgba(15, 23, 42, 0.14)",
        }}
      >
        Import
      </button>
      <div
        style={{
          position: "relative",
          minWidth: 0,
          minHeight: 0,
          height: "100%",
        }}
      >
        <MapView
          onSelect={setSelected}
          projectIds={visibleProjectIds?.length ? visibleProjectIds : undefined}
          selected={selected}
        />
      </div>
      {selected?.type !== "pole" && (
        <DetailSheet
          selected={selected}
          onClose={() => setSelected(null)}
        />
      )}
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </div>
  );
}
