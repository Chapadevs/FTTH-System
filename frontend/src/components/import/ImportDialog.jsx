import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "../../lib/trpc.js";

function buildDefaultsFromFile(fileName) {
  const baseName = (fileName || "Imported Project").replace(/\.[^.]+$/, "").trim();
  const compact = baseName.replace(/[^a-zA-Z0-9]+/g, "").toUpperCase();
  const nodeMatch = baseName.match(/\b\d+[A-Z]?\b/i);

  return {
    name: baseName || "Imported Project",
    prismId: compact || "AUTO",
    node: (nodeMatch?.[0] || compact.slice(0, 8) || "AUTO").toUpperCase(),
  };
}

function summarizeImport(result) {
  const summary = result?.summary || {};
  const parts = [
    `Imported ${summary.polesCreated ?? 0} poles`,
    `${summary.segmentsCreated ?? 0} segments`,
  ];

  if ((summary.sheathsCreated ?? 0) > 0) {
    parts.push(`${summary.sheathsCreated} sheaths`);
    parts.push(`${summary.fiberRecordsCreated ?? 0} fibers`);
  }
  if ((summary.virtualPolesCreated ?? 0) > 0) {
    parts.push(`${summary.virtualPolesCreated} generated poles`);
  }
  if (result?.warnings?.length) {
    parts.push(`${result.warnings.length} warning(s)`);
  }

  return parts.join(", ") + ".";
}

function InfoCard({ label, value, tone = "#0f172a" }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "0.75rem",
        background: "white",
      }}
    >
      <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: tone }}>{value}</div>
    </div>
  );
}

export function ImportDialog({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [prismId, setPrismId] = useState("");
  const [node, setNode] = useState("");
  const [step, setStep] = useState(1);
  const [filePath, setFilePath] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [verification, setVerification] = useState(null);
  const queryClient = useQueryClient();

  const getSignedUrl = useMutation(trpc.uploads.getSignedUrl.mutationOptions());
  const importProject = useMutation(trpc.projects.importFromGcs.mutationOptions());
  const verifyImport = useMutation(trpc.projects.verifyImport.mutationOptions());
  const localImportQuery = useQuery(trpc.uploads.localImportEnabled.queryOptions());

  const isExcel = file?.name && /\.(xlsx|xls)$/i.test(file.name);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const defaults = buildDefaultsFromFile(f.name);
    setFile(f);
    setName(defaults.name);
    setPrismId(defaults.prismId);
    setNode(defaults.node);
    setFilePath(null);
    setStep(1);
    setVerification(null);
  };

  const getDefaultContentType = () => {
    if (!file) return "application/zip";
    const n = file.name.toLowerCase();
    if (n.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (n.endsWith(".xls")) return "application/vnd.ms-excel";
    return "application/zip";
  };

  const handleProcessFile = async () => {
    if (!file) return;
    if (!localImportQuery.isSuccess) return;
    setUploadBusy(true);
    try {
      let nextFilePath;
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
        nextFilePath = data.filePath;
      } else {
        const contentType = file.type || getDefaultContentType();
        const { url, filePath: path } = await getSignedUrl.mutateAsync({
          fileName: file.name,
          contentType,
        });
        await fetch(url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": contentType },
        });
        nextFilePath = path;
      }

      const result = await verifyImport.mutateAsync({ filePath: nextFilePath });
      setFilePath(nextFilePath);
      setVerification(result);
      setStep(2);
    } catch (err) {
      console.error(err);
      const raw = err?.message || "Unknown error";
      const msg = raw.toLowerCase();
      const looksNetwork =
        msg.includes("failed to fetch") || msg.includes("connection refused") || msg.includes("network");
      if (looksNetwork) {
        alert(
          "Upload failed in the browser (often CORS on the GCS bucket after a signed URL, or wrong API URL).\n\n" +
            "Fixes: (1) Ensure gs://fiberops-imports has CORS allowing PUT from your frontend origin. " +
            "(2) Set localStorage key fiberops-user-email to admin@fiberops.com if the API returns 401. " +
            "(3) Local dev: run npm run dev from the project root.\n\n" +
            `Details: ${raw}`
        );
      } else {
        alert("Process failed: " + raw);
      }
    } finally {
      setUploadBusy(false);
    }
  };

  const handleImport = async () => {
    if (!filePath) return;
    try {
      const defaults = buildDefaultsFromFile(file?.name);
      const result = await importProject.mutateAsync({
        filePath,
        prismId: prismId || defaults.prismId,
        name: name || defaults.name,
        node: node || defaults.node,
      });
      queryClient.invalidateQueries({ queryKey: [["projects"]] });
      queryClient.invalidateQueries({ queryKey: [["map"]] });
      onImported?.(
        result?.verification?.fiber
          ? {
              summary: result.verification.fiber.summary,
              visitPlan: result.verification.fiber.visitPlan,
            }
          : null
      );
      alert(summarizeImport(result));
      resetAndClose();
    } catch (err) {
      console.error(err);
      const raw = err?.message || "Unknown error";
      const msg = raw.toLowerCase();
      const looksNetwork =
        msg.includes("failed to fetch") || msg.includes("connection refused") || msg.includes("network");
      if (looksNetwork) {
        alert(
          "Request failed in the browser (network/CORS or wrong API URL). " +
            "For imports, check GCS bucket CORS and localStorage fiberops-user-email. Local dev: npm run dev.\n\n" +
            `Details: ${raw}`
        );
      } else {
        alert("Import failed: " + raw);
      }
    }
  };

  const resetAndClose = () => {
    onClose();
    setFile(null);
    setName("");
    setPrismId("");
    setNode("");
    setFilePath(null);
    setVerification(null);
    setStep(1);
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
      }}
      onClick={resetAndClose}
    >
      <div
        style={{
          background: "white",
          padding: "1.5rem",
          borderRadius: "8px",
          width: "420px",
          maxWidth: "90vw",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 0.5rem 0" }}>Import & Process</h2>
        <p style={{ margin: "0 0 1rem 0", fontSize: "0.8rem", color: "#64748b" }}>
          One workflow for map data and automatic fiber calculation
        </p>

        {step === 1 && (
          <>
            <div
              style={{
                border: "2px dashed #e2e8f0",
                borderRadius: "8px",
                padding: "2rem",
                textAlign: "center",
                marginBottom: "1rem",
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFileChange({ target: { files: [f] } });
              }}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.zip"
                onChange={(e) => handleFileChange(e)}
                style={{ display: "none" }}
                id="import-file"
              />
              <label htmlFor="import-file" style={{ cursor: "pointer", display: "block" }}>
                {file ? file.name : "Drop .xlsx, .xls, or .zip — or click to select"}
              </label>
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Project name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={file ? buildDefaultsFromFile(file.name).name : "McArthur OH - Node 2307E"}
                style={{ width: "100%", padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: "6px" }}
              />
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Project ID</label>
              <input
                type="text"
                value={prismId}
                onChange={(e) => setPrismId(e.target.value)}
                placeholder={file ? buildDefaultsFromFile(file.name).prismId : "3989801"}
                style={{ width: "100%", padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: "6px" }}
              />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Node</label>
              <input
                type="text"
                value={node}
                onChange={(e) => setNode(e.target.value)}
                placeholder={file ? buildDefaultsFromFile(file.name).node : "2307E"}
                style={{ width: "100%", padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: "6px" }}
              />
            </div>
            <p style={{ margin: "0 0 1rem 0", fontSize: "0.78rem", color: "#64748b" }}>
              The file will be processed first. You will review poles, segments, fibers, and issues before anything is saved.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                onClick={resetAndClose}
                style={{ padding: "0.5rem 1rem", background: "#f1f5f9", border: "none", borderRadius: "6px", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleProcessFile}
                disabled={
                  !file ||
                  !localImportQuery.isSuccess ||
                  uploadBusy ||
                  getSignedUrl.isPending ||
                  verifyImport.isPending
                }
                style={{ padding: "0.5rem 1rem", background: "#0f172a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
              >
                {!localImportQuery.isSuccess || uploadBusy || getSignedUrl.isPending || verifyImport.isPending ? "Processing..." : "Process File"}
              </button>
            </div>
          </>
        )}

        {step === 2 && verification && (
          <>
            <p style={{ margin: "0 0 1rem 0", fontSize: "0.875rem", color: "#64748b" }}>
              Review the data before import. Fiber calculation has already been processed when fiber sheets were found.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              <InfoCard label="Poles" value={verification.map?.polesCount ?? 0} />
              <InfoCard label="Segments" value={verification.map?.segmentsCount ?? 0} />
              <InfoCard label="Active Fibers" value={verification.fiber?.summary?.activeCount ?? 0} tone="#15803d" />
              <InfoCard label="Issues" value={verification.fiber?.summary?.inconsistencies?.length ?? 0} tone="#b91c1c" />
            </div>

            {verification.map?.present && (
              <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#f8fafc", borderRadius: "8px" }}>
                <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>Map verification</div>
                <div style={{ fontSize: "0.82rem", color: "#475569" }}>
                  {verification.map.samplePoleNumbers?.length > 0
                    ? `Sample poles: ${verification.map.samplePoleNumbers.join(", ")}`
                    : "No sample poles available."}
                </div>
                {verification.map.selectedSheets?.length > 0 && isExcel && (
                  <div style={{ marginTop: "0.35rem", fontSize: "0.78rem", color: "#64748b" }}>
                    Sheets used: {verification.map.selectedSheets.join(", ")}
                  </div>
                )}
              </div>
            )}

            {verification.fiber?.present && (
              <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#f8fafc", borderRadius: "8px" }}>
                <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>Fiber verification</div>
                <div style={{ fontSize: "0.82rem", color: "#475569" }}>
                  {verification.fiber.recordCount} record(s), {verification.fiber.visitPlan?.visits?.length ?? 0} visit location(s)
                </div>
                {verification.fiber.sheetsUsed?.length > 0 && (
                  <div style={{ marginTop: "0.35rem", fontSize: "0.78rem", color: "#64748b" }}>
                    Fiber sheets: {verification.fiber.sheetsUsed.join(", ")}
                  </div>
                )}
                {verification.fiber.crossReference?.missingPoleNames?.length > 0 && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "#b91c1c" }}>
                    Missing map endpoints: {verification.fiber.crossReference.missingPoleNames.slice(0, 8).join(", ")}
                    {verification.fiber.crossReference.missingPoleNames.length > 8 ? "..." : ""}
                  </div>
                )}
              </div>
            )}

            {verification.warnings?.length > 0 && (
              <div
                style={{
                  marginBottom: "1rem",
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#991b1b",
                  borderRadius: "8px",
                  padding: "0.75rem",
                  fontSize: "0.8rem",
                }}
              >
                {verification.warnings.slice(0, 8).map((warning, idx) => (
                  <div key={`${warning}-${idx}`} style={{ marginBottom: idx === verification.warnings.slice(0, 8).length - 1 ? 0 : "0.35rem" }}>
                    {warning}
                  </div>
                ))}
              </div>
            )}

            {verification.fiber?.summary?.inconsistencies?.length > 0 && (
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  maxHeight: "180px",
                  overflowY: "auto",
                  padding: "0.75rem",
                  marginBottom: "1rem",
                  backgroundColor: "#fff",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.85rem" }}>Issues to review</div>
                {verification.fiber.summary.inconsistencies.map((issue, idx) => (
                  <div key={`${issue.type}-${issue.fiber}-${idx}`} style={{ fontSize: "0.8rem", color: "#475569", marginBottom: "0.4rem" }}>
                    {issue.message}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setStep(1);
                  setFilePath(null);
                  setVerification(null);
                }}
                style={{ padding: "0.5rem 1rem", background: "#f1f5f9", border: "none", borderRadius: "6px", cursor: "pointer" }}
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={
                  importProject.isPending ||
                  !verification.readyToImport
                }
                style={{ padding: "0.5rem 1rem", background: "#0f172a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
              >
                {importProject.isPending ? "Importing..." : "Import Project"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
