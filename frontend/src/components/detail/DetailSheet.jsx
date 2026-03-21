export function DetailSheet({ selected, onClose }) {
  if (!selected) return null;

  const isPole = selected.type === "pole";
  const data = selected.data;

  return (
    <div
      style={{
        position: "absolute",
        top: "1rem",
        right: "1rem",
        width: "380px",
        maxHeight: "80vh",
        background: "white",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 1000,
        overflow: "auto",
      }}
    >
      <div
        style={{
          padding: "1rem",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0 }}>{isPole ? "Pole" : "Equipment"}</h3>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "1.25rem",
            padding: "0 0.25rem",
          }}
        >
          ×
        </button>
      </div>
      <div style={{ padding: "1rem" }}>
        {isPole ? (
          <>
            <p style={{ margin: "0 0 0.5rem 0" }}>
              <strong>Pole #:</strong> {data?.poleNumber}
            </p>
            <p style={{ margin: "0 0 0.5rem 0" }}>
              <strong>Street:</strong> {data?.streetName || "—"}
            </p>
            <p style={{ margin: "0 0 0.5rem 0" }}>
              <strong>Status:</strong> {data?.status}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Coordinates:</strong> {data?.lat}, {data?.lng}
            </p>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 0.5rem 0" }}>
              <strong>Tag:</strong> {data?.tag}
            </p>
            <p style={{ margin: "0 0 0.5rem 0" }}>
              <strong>Name:</strong> {data?.name}
            </p>
            <p style={{ margin: "0 0 0.5rem 0" }}>
              <strong>Manufacturer:</strong> {data?.manufacturer}
            </p>
            <p style={{ margin: "0 0 0.5rem 0" }}>
              <strong>Model:</strong> {data?.model}
            </p>
            <p style={{ margin: "0 0 0.5rem 0" }}>
              <strong>Type:</strong> {data?.equipType}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Ports:</strong> {data?.portCount ?? "—"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
