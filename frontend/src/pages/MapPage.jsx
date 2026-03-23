import { useCallback, useState } from "react";
import { queryClient, trpc } from "../lib/trpc.js";
import { MapView } from "../components/map/MapView.jsx";
import { ProjectList } from "../components/sidebar/ProjectList.jsx";
import { ImportDialog } from "../components/import/ImportDialog.jsx";
import { DetailSheet } from "../components/detail/DetailSheet.jsx";
import { PoleTypeFilterBar } from "../components/map/PoleTypeFilterBar.jsx";

const initialPoleTypeCounts = { ote: 0, distribution: 0, splitter: 0, total: 0 };

export function MapPage() {
  const [selected, setSelected] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [visibleProjectIds, setVisibleProjectIds] = useState([]);
  const [poleTypeFilter, setPoleTypeFilter] = useState("all");
  const [poleTypeCounts, setPoleTypeCounts] = useState(initialPoleTypeCounts);
  const [projectFocusRequest, setProjectFocusRequest] = useState(null);

  const handleShowProjectOnMap = useCallback(async (projectId) => {
    const data = await queryClient.fetchQuery(trpc.projects.getMapBounds.queryOptions({ projectId }));
    if (!data) {
      window.alert("No poles with coordinates for this project yet.");
      return;
    }
    setProjectFocusRequest({
      id: `proj:${projectId}:${Date.now()}`,
      fitBounds: [
        [data.minLat, data.minLng],
        [data.maxLat, data.maxLng],
      ],
    });
  }, []);

  const clearProjectFocus = useCallback(() => setProjectFocusRequest(null), []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 2rem)",
        minHeight: 0,
        position: "relative",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "0.5rem",
            left: "0.5rem",
            zIndex: 700,
            width: "min(148px, calc(100% - 1rem))",
            maxHeight: "calc(100% - 1rem)",
            background: "white",
            padding: "0.28rem 0.32rem",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <ProjectList
            visibleProjectIds={visibleProjectIds}
            onVisibleChange={setVisibleProjectIds}
            onShowProjectOnMap={handleShowProjectOnMap}
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
            poleTypeFilter={poleTypeFilter}
            setPoleTypeFilter={setPoleTypeFilter}
            onPoleTypeCountsChange={setPoleTypeCounts}
            projectFocusRequest={projectFocusRequest}
            onProjectFocusConsumed={clearProjectFocus}
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
      <PoleTypeFilterBar
        counts={poleTypeCounts}
        poleTypeFilter={poleTypeFilter}
        setPoleTypeFilter={setPoleTypeFilter}
      />
    </div>
  );
}
