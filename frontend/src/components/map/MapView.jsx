import { lazy, Suspense } from "react";

const MapInner = lazy(() => import("./MapInner.jsx"));

export function MapView({
  onSelect,
  projectIds,
  selected,
  poleTypeFilter,
  setPoleTypeFilter,
  onPoleTypeCountsChange,
  projectFocusRequest,
  onProjectFocusConsumed,
}) {
  return (
    <Suspense fallback={<div style={{ height: "100%", background: "#f1f5f9" }}>Loading map...</div>}>
      <MapInner
        onSelect={onSelect}
        projectIds={projectIds}
        selected={selected}
        poleTypeFilter={poleTypeFilter}
        setPoleTypeFilter={setPoleTypeFilter}
        onPoleTypeCountsChange={onPoleTypeCountsChange}
        projectFocusRequest={projectFocusRequest}
        onProjectFocusConsumed={onProjectFocusConsumed}
      />
    </Suspense>
  );
}
