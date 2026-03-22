import { lazy, Suspense } from "react";

const MapInner = lazy(() => import("./MapInner.jsx"));

export function MapView({ onSelect, projectIds, selected }) {
  return (
    <Suspense fallback={<div style={{ height: "100%", background: "#f1f5f9" }}>Loading map...</div>}>
      <MapInner onSelect={onSelect} projectIds={projectIds} selected={selected} />
    </Suspense>
  );
}
