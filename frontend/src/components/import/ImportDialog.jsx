import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "../../lib/trpc.js";

export function ImportDialog({ open, onClose }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [prismId, setPrismId] = useState("");
  const [node, setNode] = useState("");
  const [step, setStep] = useState(1);
  const queryClient = useQueryClient();

  const getSignedUrl = useMutation(trpc.uploads.getSignedUrl.mutationOptions());
  const importProject = useMutation(trpc.projects.importFromGcs.mutationOptions());

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f);
  };

  const getDefaultContentType = () => {
    if (!file) return "application/zip";
    const n = file.name.toLowerCase();
    if (n.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (n.endsWith(".xls")) return "application/vnd.ms-excel";
    return "application/zip";
  };

  const handleUpload = async () => {
    if (!file || !name || !prismId || !node) return;
    try {
      const contentType = file.type || getDefaultContentType();
      const { url, filePath } = await getSignedUrl.mutateAsync({
        fileName: file.name,
        contentType,
      });
      await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });
      const result = await importProject.mutateAsync({
        filePath,
        prismId,
        name,
        node,
      });
      queryClient.invalidateQueries({ queryKey: [["projects"]] });
      queryClient.invalidateQueries({ queryKey: [["map"]] });
      const msg = [
        `Imported: ${result.summary?.polesCreated ?? 0} poles, ${result.summary?.segmentsCreated ?? 0} segments.`,
        ...(result.warnings?.length ? result.warnings : []),
      ].join("\n");
      alert(msg);
      onClose();
      setFile(null);
      setName("");
      setPrismId("");
      setNode("");
      setStep(1);
    } catch (err) {
      console.error(err);
      alert("Import failed: " + (err?.message || "Unknown error"));
    }
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
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          padding: "1.5rem",
          borderRadius: "8px",
          width: "400px",
          maxWidth: "90vw",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 1rem 0" }}>Import Project Data</h2>
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
            if (f) setFile(f);
          }}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.zip"
            onChange={handleFileChange}
            style={{ display: "none" }}
            id="import-file"
          />
          <label
            htmlFor="import-file"
            style={{ cursor: "pointer", display: "block" }}
          >
            {file ? file.name : "Drop .xlsx, .xls, or .zip — or click to select"}
          </label>
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
            Project name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="McArthur OH — Node 2307E"
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
            }}
          />
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
            Project ID
          </label>
          <input
            type="text"
            value={prismId}
            onChange={(e) => setPrismId(e.target.value)}
            placeholder="3989801"
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
            }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
            Node
          </label>
          <input
            type="text"
            value={node}
            onChange={(e) => setNode(e.target.value)}
            placeholder="2307E"
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "0.5rem 1rem",
              background: "#f1f5f9",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || !name || !prismId || !node || getSignedUrl.isPending || importProject.isPending}
            style={{
              padding: "0.5rem 1rem",
              background: "#0f172a",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {getSignedUrl.isPending || importProject.isPending ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
