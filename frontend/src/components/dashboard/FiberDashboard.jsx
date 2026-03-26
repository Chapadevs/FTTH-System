import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "../../lib/trpc.js";

const FIBER_COLORS = [
  "Blue",
  "Orange",
  "Green",
  "Brown",
  "Slate",
  "White",
  "Red",
  "Black",
  "Yellow",
  "Violet",
  "Pink",
  "Aqua",
];

export function FiberDashboard({ fiberResult, onFiberResult, completedVisits = new Set(), onVisitComplete }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const computeFromExcel = useMutation(trpc.fibers.computeFromExcel.mutationOptions());
  const localImportQuery = useQuery(trpc.uploads.localImportEnabled.queryOptions());
  const getSignedUrl = useMutation(trpc.uploads.getSignedUrl.mutationOptions());

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const valid = /\.(xlsx|xls)$/i.test(file.name);
    if (!valid) {
      alert("Use .xlsx or .xls");
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      let filePath;
      if (localImportQuery.data === true) {
        const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "" : "http://localhost:3000");
        const email = localStorage.getItem("fiberops-user-email");
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${apiBase}/api/uploads/local-import`, {
          method: "POST",
          headers: email ? { "x-user-email": email } : {},
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.statusText);
        filePath = data.filePath;
      } else {
        const contentType =
          file.name.toLowerCase().endsWith(".xlsx")
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/vnd.ms-excel";
        const { url, filePath: path } = await getSignedUrl.mutateAsync({
          fileName: file.name,
          contentType,
        });
        await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": contentType } });
        filePath = path;
      }
      computeFromExcel.mutate(
        { filePath },
        {
          onSuccess: (data) => {
            if (data?.error) {
              alert(data.error);
              return;
            }
            onFiberResult?.(data);
          },
          onError: (err) => {
            console.error(err);
            const raw = err?.message || "Unknown error";
            const msg = raw.toLowerCase();
            const looksNetwork =
              msg.includes("failed to fetch") || msg.includes("connection refused") || msg.includes("network");
            alert(
              looksNetwork
                ? `Browser network/CORS or API URL issue. Check GCS CORS, VITE_API_URL, or localStorage fiberops-user-email. Local dev: npm run dev.\n\n${raw}`
                : "Upload failed: " + raw
            );
          },
        }
      );
    } catch (err) {
      console.error(err);
      const raw = err?.message || "Unknown error";
      const msg = raw.toLowerCase();
      const looksNetwork =
        msg.includes("failed to fetch") || msg.includes("connection refused") || msg.includes("network");
      alert(
        looksNetwork
          ? `Browser network/CORS or API URL issue. Check GCS CORS, VITE_API_URL, or localStorage fiberops-user-email. Local dev: npm run dev.\n\n${raw}`
          : "Upload failed: " + raw
      );
    } finally {
      setUploading(false);
    }
    e.target.value = "";
  };

  const toggleVisitComplete = (location) => {
    const next = new Set(completedVisits);
    if (next.has(location)) next.delete(location);
    else next.add(location);
    onVisitComplete?.(next);
  };

  const result = fiberResult ?? computeFromExcel.data;
  const summary = result?.summary;
  const visitPlan = result?.visitPlan;
  const inconsistencies = summary?.inconsistencies ?? [];

  return (
    <div style={{ marginTop: "1rem" }}>
      <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem" }}>Fiber Calculator</h3>
      <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.7rem", color: "#64748b" }}>BUFFER/FIBER columns</p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={!localImportQuery.isSuccess || uploading || computeFromExcel.isPending || getSignedUrl.isPending}
        style={{
          width: "100%",
          padding: "0.5rem",
          background: "#0f172a",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "0.8rem",
        }}
      >
        {uploading || computeFromExcel.isPending ? "..." : "Open Fiber Export"}
      </button>

      {summary && (
        <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#f8fafc", borderRadius: "6px" }}>
          <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem" }}>Summary</h4>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.75rem" }}>
            <span style={{ color: "#15803d" }}>Active: {summary.activeCount}</span>
            <span style={{ color: "#64748b" }}>Dark: {summary.darkCount}</span>
            {inconsistencies.length > 0 && (
              <span style={{ color: "#b91c1c" }}>Issues: {inconsistencies.length}</span>
            )}
          </div>
          {inconsistencies.length > 0 && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "#b91c1c" }}>
              {inconsistencies.slice(0, 3).map((inc, i) => (
                <div key={i}>{inc.message}</div>
              ))}
              {inconsistencies.length > 3 && <div>+{inconsistencies.length - 3} more</div>}
            </div>
          )}
        </div>
      )}

      {visitPlan?.visits?.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem" }}>Visit Plan</h4>
          <div
            style={{
              maxHeight: "200px",
              overflowY: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "0.75rem",
            }}
          >
            {visitPlan.visits.map((v) => (
              <div
                key={v.location}
                style={{
                  padding: "0.5rem",
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={completedVisits.has(v.location)}
                  onChange={() => toggleVisitComplete(v.location)}
                  style={{ marginTop: "0.2rem" }}
                />
                <div>
                  <strong>{v.location}</strong>
                  {v.actions.map((a, i) => (
                    <div key={i} style={{ marginTop: "0.25rem", color: "#475569" }}>
                      {a.instruction}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.7rem", color: "#64748b" }}>
            {FIBER_COLORS.length} fiber colors: {FIBER_COLORS.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
