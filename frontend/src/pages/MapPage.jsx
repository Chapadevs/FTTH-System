import { useState } from "react";
import { MapView } from "../components/map/MapView.jsx";
import { ProjectList } from "../components/sidebar/ProjectList.jsx";
import { ImportDialog } from "../components/import/ImportDialog.jsx";
import { DetailSheet } from "../components/detail/DetailSheet.jsx";

export function MapPage() {
  const [selected, setSelected] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [visibleProjectIds, setVisibleProjectIds] = useState([]);
  const [fiberResult, setFiberResult] = useState(null);
  const [completedVisits] = useState(new Set());

  return (
    <div style={{ position: "relative", height: "calc(100vh - 2rem)" }}>
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          zIndex: 1000,
          background: "white",
          padding: "0.75rem",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          maxWidth: "280px",
          maxHeight: "calc(100vh - 4rem)",
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
          zIndex: 1000,
          padding: "0.5rem 1rem",
          background: "#0f172a",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        Import & Process
      </button>
      <MapView
        onSelect={setSelected}
        projectIds={visibleProjectIds?.length ? visibleProjectIds : undefined}
      />
      <DetailSheet
        selected={selected}
        onClose={() => setSelected(null)}
        fiberResult={fiberResult}
        completedVisits={completedVisits}
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={setFiberResult}
      />
    </div>
  );
}
