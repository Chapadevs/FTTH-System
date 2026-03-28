import { useQuery } from "@tanstack/react-query";
import { trpc } from "../../lib/trpc.js";

const FIBER_COLOR_STYLES = {
  BLUE: { dot: "#2563eb", background: "#dbeafe", border: "#93c5fd", text: "#1d4ed8" },
  ORANGE: { dot: "#ea580c", background: "#ffedd5", border: "#fdba74", text: "#9a3412" },
  GREEN: { dot: "#16a34a", background: "#dcfce7", border: "#86efac", text: "#166534" },
  BROWN: { dot: "#8b5e3c", background: "#ede0d4", border: "#d6b39a", text: "#6f4e37" },
  SLATE: { dot: "#64748b", background: "#e2e8f0", border: "#cbd5e1", text: "#334155" },
  WHITE: { dot: "#ffffff", background: "#f8fafc", border: "#cbd5e1", text: "#475569" },
  RED: { dot: "#dc2626", background: "#fee2e2", border: "#fca5a5", text: "#991b1b" },
  BLACK: { dot: "#0f172a", background: "#e2e8f0", border: "#94a3b8", text: "#0f172a" },
  YELLOW: { dot: "#eab308", background: "#fef9c3", border: "#fde047", text: "#854d0e" },
  VIOLET: { dot: "#7c3aed", background: "#ede9fe", border: "#c4b5fd", text: "#5b21b6" },
  PINK: { dot: "#db2777", background: "#fce7f3", border: "#f9a8d4", text: "#9d174d" },
  ROSE: { dot: "#db2777", background: "#fce7f3", border: "#f9a8d4", text: "#9d174d" },
  AQUA: { dot: "#0891b2", background: "#cffafe", border: "#67e8f9", text: "#155e75" },
};

const STATUS_STYLES = {
  ACTIVE: { background: "#dcfce7", border: "#86efac", text: "#166534", label: "Active" },
  INCONSISTENT: { background: "#fee2e2", border: "#fca5a5", text: "#991b1b", label: "Needs fusion" },
  DARK: { background: "#e2e8f0", border: "#cbd5e1", text: "#475569", label: "Dark" },
  DEFAULT: { background: "#e2e8f0", border: "#cbd5e1", text: "#334155", label: "Unknown" },
};

const SUMMARY_TONES = {
  success: { background: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  neutral: { background: "#f8fafc", border: "#cbd5e1", text: "#334155" },
  danger: { background: "#fef2f2", border: "#fecaca", text: "#991b1b" },
};

function normalizeLabel(value) {
  return String(value || "").trim().toUpperCase();
}

function getFiberColorDisplayName(color) {
  const key = normalizeLabel(color);
  if (key === "PINK" || key === "ROSE") return "ROSE";
  return key;
}

function getFiberColorStyle(color) {
  const key = normalizeLabel(color);
  return FIBER_COLOR_STYLES[key] || SUMMARY_TONES.neutral;
}

function getStatusStyle(status) {
  return STATUS_STYLES[status] || STATUS_STYLES.DEFAULT;
}

function formatDirection(direction) {
  if (!direction) return null;
  return direction.charAt(0) + direction.slice(1).toLowerCase();
}

function buildAssignmentLabel(fiber) {
  const label = fiber.assignments?.length
    ? fiber.assignments
        .map((assignment) => [assignment.deviceName, assignment.portName].filter(Boolean).join(" - "))
        .filter(Boolean)
        .join(", ")
    : "";
  return label || "No assignment linked";
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function parseFiberAction(action) {
  const match = /^Fuse\s+([A-Z]+)\s+fiber\s+in\s+([A-Z]+)\s+tube\s+(.+)$/i.exec(action);
  if (!match) {
    return { description: action };
  }

  const fiberColor = match[1];
  const bufferColor = match[2];
  const remainder = match[3];
  const splitIndex = remainder.indexOf(" - ");

  if (splitIndex === -1) {
    return { fiberColor, bufferColor, route: remainder };
  }

  return {
    fiberColor,
    bufferColor,
    route: remainder.slice(0, splitIndex),
    assignment: remainder.slice(splitIndex + 3),
  };
}

function buildNextActionSummary(action) {
  if (!action) return null;
  const parsed = parseFiberAction(action);

  if (!parsed.fiberColor || !parsed.bufferColor) {
    return {
      headline: action,
      detail: null,
      fiberColor: null,
      bufferColor: null,
    };
  }

  return {
    headline: `Fuse ${parsed.fiberColor} fiber in ${parsed.bufferColor} tube.`,
    detail: parsed.assignment || parsed.route || null,
    fiberColor: parsed.fiberColor,
    bufferColor: parsed.bufferColor,
  };
}

function getSheathDisplayName(sheath) {
  if (!sheath?.name) return "Sheath";
  if (isUuidLike(sheath.name) && sheath.connectedPoleNumbers?.length > 0) {
    return `Sheath to ${sheath.connectedPoleNumbers.join(", ")}`;
  }
  return sheath.name;
}

function SectionTitle({ children }) {
  return <strong style={{ fontSize: "0.82rem", color: "#0f172a" }}>{children}</strong>;
}

function InfoLine({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "0.75rem",
        marginTop: "0.55rem",
        paddingBottom: "0.55rem",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      <span style={{ fontSize: "0.77rem", color: "#64748b", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: "0.82rem", color: "#0f172a", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function SummaryCard({ label, value, tone = "neutral" }) {
  const style = SUMMARY_TONES[tone] || SUMMARY_TONES.neutral;

  return (
    <div
      style={{
        border: `1px solid ${style.border}`,
        borderRadius: "10px",
        padding: "0.75rem",
        background: style.background,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
      }}
    >
      <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ fontSize: "1.05rem", fontWeight: 700, color: style.text }}>{value}</div>
    </div>
  );
}

function ColorChip({ label, color }) {
  const style = getFiberColorStyle(color);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.45rem",
        padding: "0.32rem 0.55rem",
        borderRadius: "999px",
        border: `1px solid ${style.border}`,
        background: style.background,
        color: style.text,
        fontSize: "0.75rem",
        fontWeight: 700,
      }}
    >
      <span
        style={{
          width: "0.72rem",
          height: "0.72rem",
          borderRadius: "999px",
          background: style.dot,
          border: style.dot === "#ffffff" ? "1px solid #94a3b8" : "1px solid rgba(15, 23, 42, 0.08)",
          boxShadow: "0 0 0 2px rgba(255,255,255,0.75) inset",
        }}
      />
      <span style={{ color: "#64748b", fontWeight: 600 }}>{label}</span>
      <span>{getFiberColorDisplayName(color)}</span>
    </div>
  );
}

function Badge({ children, tone = "neutral", onClick }) {
  const style = SUMMARY_TONES[tone] || SUMMARY_TONES.neutral;

  const sharedStyle = {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.18rem 0.5rem",
    borderRadius: "999px",
    border: `1px solid ${style.border}`,
    background: style.background,
    color: style.text,
    fontSize: "0.72rem",
    fontWeight: 700,
    ...(onClick
      ? {
          cursor: "pointer",
          font: "inherit",
          fontFamily: "inherit",
          margin: 0,
          lineHeight: 1.2,
        }
      : {}),
  };

  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={sharedStyle}>
        {children}
      </button>
    );
  }

  return <span style={sharedStyle}>{children}</span>;
}


function FiberRow({ fiber }) {
  const assignmentLabel = buildAssignmentLabel(fiber);
  const statusStyle = getStatusStyle(fiber.status);
  const statusTone = fiber.status === "ACTIVE" ? "success" : fiber.status === "INCONSISTENT" ? "danger" : "neutral";
  const direction = formatDirection(fiber.direction);

  return (
    <div
      style={{
        marginTop: "0.65rem",
        padding: "0.75rem",
        borderRadius: "12px",
        border: `1px solid ${statusStyle.border}`,
        background: "#ffffff",
        boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.6rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
          <ColorChip label="Tube" color={fiber.bufferColor} />
          <ColorChip label="Fiber" color={fiber.fiberColor} />
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.25rem 0.55rem",
            borderRadius: "999px",
            border: `1px solid ${statusStyle.border}`,
            background: statusStyle.background,
            color: statusStyle.text,
            fontSize: "0.74rem",
            fontWeight: 700,
          }}
        >
          {statusStyle.label}
        </span>
      </div>

      <div style={{ marginTop: "0.55rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {direction && <Badge tone="neutral">{direction}</Badge>}
        {fiber.wavelength != null && <Badge tone={statusTone}>{fiber.wavelength}</Badge>}
        {fiber.logicalModeledFusion && <Badge tone="success">Modeled (splitter out)</Badge>}
      </div>

      <div
        style={{
          marginTop: "0.65rem",
          padding: "0.6rem 0.7rem",
          borderRadius: "10px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.02em", textTransform: "uppercase" }}>
          Assignment
        </div>
        <div style={{ marginTop: "0.2rem", fontSize: "0.8rem", color: "#334155", lineHeight: 1.45 }}>{assignmentLabel}</div>
      </div>
    </div>
  );
}

function ActionCard({ action, index }) {
  const parsed = parseFiberAction(action);

  return (
    <div
      style={{
        marginTop: index === 0 ? "0.7rem" : "0.6rem",
        padding: "0.75rem",
        borderRadius: "12px",
        border: "1px solid #bbf7d0",
        background: "#ffffff",
        boxShadow: "0 8px 18px rgba(22, 101, 52, 0.06)",
      }}
    >
      <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", alignItems: "center" }}>
        {parsed.bufferColor && <ColorChip label="Tube" color={parsed.bufferColor} />}
        {parsed.fiberColor && <ColorChip label="Fiber" color={parsed.fiberColor} />}
        <Badge tone="danger">Fuse here</Badge>
      </div>

      {parsed.route && (
        <div style={{ marginTop: "0.55rem", fontSize: "0.8rem", fontWeight: 600, color: "#991b1b", lineHeight: 1.45 }}>
          {parsed.route}
        </div>
      )}

      {parsed.assignment && (
        <div
          style={{
            marginTop: "0.5rem",
            padding: "0.55rem 0.65rem",
            borderRadius: "10px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            fontSize: "0.78rem",
            color: "#991b1b",
            lineHeight: 1.45,
          }}
        >
          {parsed.assignment}
        </div>
      )}

      {!parsed.route && !parsed.assignment && (
        <div style={{ marginTop: "0.55rem", fontSize: "0.8rem", color: "#991b1b", lineHeight: 1.45 }}>
          {parsed.description}
        </div>
      )}
    </div>
  );
}

function DistributionPoleCompactContent({ data, onNavigateToPole }) {
  const directServedPoles = data?.distribution?.directServedPoles || [];

  return (
    <>
      <div
        style={{
          padding: "0.75rem",
          borderRadius: "14px",
          background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
          border: "1px solid #e2e8f0",
        }}
      >
        <InfoLine label="Distribution" value={data?.poleNumber} />
        <InfoLine label="Street" value={data?.streetName || "—"} />
        <InfoLine label="Status" value={data?.status || "—"} />
        <div style={{ marginTop: "0.55rem" }}>
          <span style={{ display: "block", fontSize: "0.77rem", color: "#64748b", fontWeight: 600 }}>Coordinates</span>
          <span style={{ display: "block", marginTop: "0.18rem", fontSize: "0.82rem", color: "#0f172a", lineHeight: 1.4 }}>
            {data?.lat}, {data?.lng}
          </span>
        </div>
      </div>

      <DistributionPoleSupplement data={data} directServedPoles={directServedPoles} onNavigateToPole={onNavigateToPole} />
    </>
  );
}

function DistributionPoleSupplement({ data, directServedPoles, onNavigateToPole, compact = false }) {
  const spacing = compact ? "0.8rem" : "1rem";

  return (
    <>
      <div
        style={{
          marginTop: spacing,
          padding: compact ? "0.75rem" : "0.85rem",
          borderRadius: "14px",
          background: "#fff7ed",
          border: "1px solid #fdba74",
        }}
      >
        <SectionTitle>Distribution output</SectionTitle>
        <div style={{ marginTop: "0.35rem", fontSize: "0.78rem", lineHeight: 1.45, color: "#9a3412" }}>
          This distribution pole is sending signal directly to {directServedPoles.length} pole{directServedPoles.length === 1 ? "" : "s"}.
        </div>
      </div>

      <div style={{ marginTop: spacing }}>
        <SectionTitle>Direct served poles</SectionTitle>
        {directServedPoles.length > 0 ? (
          <div style={{ marginTop: "0.55rem", display: "grid", gap: "0.45rem" }}>
            {directServedPoles.map((pole) => (
              <div
                key={pole.id}
                role={onNavigateToPole ? "button" : undefined}
                tabIndex={onNavigateToPole ? 0 : undefined}
                onClick={onNavigateToPole ? () => onNavigateToPole(pole) : undefined}
                onKeyDown={
                  onNavigateToPole
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onNavigateToPole(pole);
                        }
                      }
                    : undefined
                }
                style={{
                  padding: compact ? "0.6rem 0.65rem" : "0.7rem 0.75rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  background: "#ffffff",
                  cursor: onNavigateToPole ? "pointer" : undefined,
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0f172a" }}>{pole.poleNumber}</div>
                <div style={{ marginTop: "0.12rem", fontSize: "0.76rem", color: "#475569" }}>{pole.streetName || "Directly connected pole"}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#64748b" }}>
            No direct served poles were found for this distribution pole.
          </p>
        )}
      </div>
    </>
  );
}

function CompactMetricCard({ label, value, tone = "neutral" }) {
  const style = SUMMARY_TONES[tone] || SUMMARY_TONES.neutral;

  return (
    <div
      style={{
        padding: "0.55rem 0.65rem",
        borderRadius: "10px",
        border: `1px solid ${style.border}`,
        background: style.background,
      }}
    >
      <div style={{ fontSize: "0.67rem", color: "#64748b", marginBottom: "0.18rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1rem", fontWeight: 800, color: style.text }}>{value}</div>
    </div>
  );
}

function MapPopoverSupplement({ data, poleDetail, compactActionSummaries, onNavigateToPole }) {
  const directServedPoles = data?.distribution?.directServedPoles || [];
  const summary = poleDetail?.summary;

  return (
    <>
      <details
        style={{
          marginTop: "0.7rem",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          background: "#ffffff",
          overflow: "hidden",
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            listStyle: "none",
            padding: "0.65rem 0.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.6rem",
            fontSize: "0.76rem",
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          <span>More details</span>
          <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>
            {(summary?.needFusionOperationalCount ?? 0) || 0} field pending
            {(summary?.logicalFusionModeledCount ?? 0) > 0
              ? ` · ${summary.logicalFusionModeledCount} modeled`
              : ""}
            {` · ${summary?.inconsistencyCount ?? 0} data issues`}
          </span>
        </summary>
        <div style={{ padding: "0 0.75rem 0.75rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.1rem" }}>
            <Badge tone="neutral">Status {poleDetail?.status || data?.status || "—"}</Badge>
            <Badge tone="neutral">Sheaths {summary?.sheathCount ?? 0}</Badge>
            <Badge tone="neutral">Fibers in data {summary?.fiberRecordCount ?? 0}</Badge>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0.5rem",
              marginTop: "0.7rem",
            }}
          >
            <SummaryCard
              label="Field fusions pending"
              value={summary?.needFusionOperationalCount ?? 0}
              tone="danger"
            />
            <SummaryCard label="Data issues" value={summary?.inconsistencyCount ?? 0} tone="neutral" />
          </div>
          {(summary?.logicalFusionModeledCount ?? 0) > 0 && (
            <div style={{ marginTop: "0.5rem" }}>
              <SummaryCard
                label="Modeled splitter / design outs"
                value={summary.logicalFusionModeledCount}
                tone="success"
              />
            </div>
          )}

          <div
            style={{
              marginTop: "0.75rem",
              padding: "0.65rem 0.75rem",
              borderRadius: "12px",
              background: (summary?.actionCount ?? 0) > 0 ? "#fef2f2" : "#f0fdf4",
              border: (summary?.actionCount ?? 0) > 0 ? "1px solid #fecaca" : "1px solid #bbf7d0",
            }}
          >
            <SectionTitle>{(summary?.actionCount ?? 0) > 0 ? "Fusion" : "Pole ready"}</SectionTitle>
            <div
              style={{
                marginTop: "0.28rem",
                fontSize: "0.74rem",
                lineHeight: 1.35,
                color: (summary?.actionCount ?? 0) > 0 ? "#991b1b" : "#166534",
              }}
            >
              {(summary?.actionCount ?? 0) > 0
                ? `${summary?.needFusionOperationalCount ?? 0} field task(s) pending (excludes modeled splitter outs)`
                : "No field fusion tasks pending."}
            </div>
            {(summary?.actionCount ?? 0) > 0 && compactActionSummaries.length > 0 && (
              <div
                style={{
                  marginTop: "0.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem",
                }}
              >
                {compactActionSummaries.map((summaryItem) => (
                  <div
                    key={summaryItem.key}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "0.4rem",
                      padding: "0.45rem 0.5rem",
                      borderRadius: "8px",
                      background: "#ffffff",
                      border: "1px solid #fecaca",
                    }}
                  >
                    {summaryItem.fiberColor && summaryItem.bufferColor ? (
                      <>
                        <ColorChip label="Fiber" color={summaryItem.fiberColor} />
                        <ColorChip label="Tube" color={summaryItem.bufferColor} />
                      </>
                    ) : (
                      <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "#7f1d1d", lineHeight: 1.35 }}>
                        {summaryItem.headline}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {poleDetail?.connectedPoles?.length > 0 && (
            <div style={{ marginTop: "0.8rem" }}>
              <SectionTitle>Connected poles</SectionTitle>
              <div style={{ marginTop: "0.55rem", display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                {poleDetail.connectedPoles.slice(0, 4).map((segment) => (
                  <Badge
                    key={segment.id}
                    tone="neutral"
                    onClick={
                      onNavigateToPole && segment.pole
                        ? () => onNavigateToPole(segment.pole)
                        : undefined
                    }
                  >
                    {segment.pole?.poleNumber}
                  </Badge>
                ))}
                {poleDetail.connectedPoles.length > 4 && (
                  <Badge tone="neutral">+{poleDetail.connectedPoles.length - 4} more</Badge>
                )}
              </div>
            </div>
          )}
          {data?.distribution?.isDistribution && (
            <DistributionPoleSupplement
              data={data}
              directServedPoles={directServedPoles}
              onNavigateToPole={onNavigateToPole}
              compact
            />
          )}
        </div>
      </details>
    </>
  );
}

export function PoleDetailContent({ data, compact = false, onNavigateToPole, variant = "default" }) {
  const isMapPopover = variant === "mapPopover";

  if (compact && data?.distribution?.isDistribution && !isMapPopover) {
    return <DistributionPoleCompactContent data={data} onNavigateToPole={onNavigateToPole} />;
  }

  const poleDetailQuery = useQuery({
    ...trpc.poles.getDetail.queryOptions({ poleId: data?.id ?? "" }),
    enabled: !!data?.id,
  });
  const poleDetail = poleDetailQuery.data;
  const sheathsNeedingFusion = poleDetail?.sheaths
    ?.map((sheath) => ({
      ...sheath,
      fusionFibers: sheath.fibers.filter((fiber) => fiber.operationalNeedFusion),
    }))
    .filter((sheath) => sheath.fusionFibers.length > 0) ?? [];
  const compactActionSummaries = poleDetail?.sheaths
    ?.flatMap((sheath) =>
      sheath.actions
        .map((action, index) => ({
          ...buildNextActionSummary(action),
          key: `${sheath.id}-${index}`,
        }))
        .filter((summary) => summary.headline)
    ) ?? [];
  const displayData = poleDetail || data;
  const isDistribution = displayData?.distribution?.isDistribution || data?.distribution?.isDistribution;

  return (
    <>
      {isMapPopover ? (
        <div
          style={{
            padding: "0.55rem 0.6rem",
            borderRadius: "10px",
            background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: "0.62rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {isDistribution ? "Distribution pole" : "Pole"}
          </div>
          <div style={{ marginTop: "0.12rem", fontSize: "0.76rem", color: "#0f172a", fontWeight: 700, lineHeight: 1.35 }}>
            {displayData?.streetName || "Street unavailable"}
          </div>
          <div style={{ marginTop: "0.35rem" }}>
            <div style={{ fontSize: "0.66rem", color: "#64748b", fontWeight: 600 }}>Coordinates</div>
            <div style={{ marginTop: "0.12rem", fontSize: "0.74rem", color: "#334155", lineHeight: 1.35 }}>
              {displayData?.lat ?? data?.lat}, {displayData?.lng ?? data?.lng}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0.4rem",
              marginTop: "0.45rem",
            }}
          >
            <CompactMetricCard label="Active fibers" value={poleDetail?.summary?.activeCount ?? "—"} tone="success" />
            <CompactMetricCard label="Dark fibers" value={poleDetail?.summary?.darkCount ?? "—"} tone="neutral" />
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: compact ? "0.75rem" : "0.85rem",
            borderRadius: "14px",
            background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
            border: "1px solid #e2e8f0",
          }}
        >
          <InfoLine label="Pole" value={poleDetail?.poleNumber || data?.poleNumber} />
          <InfoLine label="Street" value={poleDetail?.streetName || data?.streetName || "—"} />
          <InfoLine label="Status" value={poleDetail?.status || data?.status} />
          <div style={{ marginTop: "0.55rem" }}>
            <span style={{ display: "block", fontSize: "0.77rem", color: "#64748b", fontWeight: 600 }}>Coordinates</span>
            <span style={{ display: "block", marginTop: "0.18rem", fontSize: "0.82rem", color: "#0f172a", lineHeight: 1.4 }}>
              {poleDetail?.lat ?? data?.lat}, {poleDetail?.lng ?? data?.lng}
            </span>
          </div>
        </div>
      )}

      {poleDetailQuery.isLoading && (
        <p style={{ marginTop: isMapPopover ? "0.65rem" : "1rem", fontSize: "0.82rem", color: "#64748b" }}>
          Loading pole detail...
        </p>
      )}

      {poleDetailQuery.isError && (
        <p style={{ marginTop: isMapPopover ? "0.65rem" : "1rem", fontSize: "0.82rem", color: "#b91c1c" }}>
          Could not load fiber detail for this pole.
        </p>
      )}

      {poleDetail && !isMapPopover && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0.6rem",
              marginTop: "1rem",
            }}
          >
            <SummaryCard label="Active fibers" value={poleDetail.summary.activeCount} tone="success" />
            <SummaryCard label="Dark fibers" value={poleDetail.summary.darkCount} tone="neutral" />
            <SummaryCard label="Field fusions pending" value={poleDetail.summary.needFusionOperationalCount} tone="danger" />
            <SummaryCard label="Data issues" value={poleDetail.summary.inconsistencyCount} tone="neutral" />
            {(poleDetail.summary.logicalFusionModeledCount ?? 0) > 0 && (
              <SummaryCard
                label="Modeled splitter outs"
                value={poleDetail.summary.logicalFusionModeledCount}
                tone="success"
              />
            )}
            <SummaryCard label="Sheaths" value={poleDetail.summary.sheathCount} tone="neutral" />
            <SummaryCard
              label="Fibers in data"
              value={poleDetail.summary.fiberRecordCount ?? 0}
              tone="neutral"
            />
          </div>

          {compact ? (
            <>
              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.65rem 0.75rem",
                  borderRadius: "12px",
                  background: poleDetail.summary.actionCount > 0 ? "#fef2f2" : "#f0fdf4",
                  border: poleDetail.summary.actionCount > 0 ? "1px solid #fecaca" : "1px solid #bbf7d0",
                }}
              >
                <SectionTitle>{poleDetail.summary.actionCount > 0 ? "Fusion" : "Pole ready"}</SectionTitle>
                <div
                  style={{
                    marginTop: "0.28rem",
                    fontSize: "0.74rem",
                    lineHeight: 1.35,
                    color: poleDetail.summary.actionCount > 0 ? "#991b1b" : "#166534",
                  }}
                >
                  {poleDetail.summary.actionCount > 0
                    ? `${poleDetail.summary.needFusionOperationalCount} pending`
                    : "No pending fusion work."}
                </div>
                {poleDetail.summary.actionCount > 0 && compactActionSummaries.length > 0 && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.4rem",
                    }}
                  >
                    {compactActionSummaries.map((summary) => (
                      <div
                        key={summary.key}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: "0.4rem",
                          padding: "0.45rem 0.5rem",
                          borderRadius: "8px",
                          background: "#ffffff",
                          border: "1px solid #fecaca",
                        }}
                      >
                        {summary.fiberColor && summary.bufferColor ? (
                          <>
                            <ColorChip label="Fiber" color={summary.fiberColor} />
                            <ColorChip label="Tube" color={summary.bufferColor} />
                          </>
                        ) : (
                          <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "#7f1d1d", lineHeight: 1.35 }}>
                            {summary.headline}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {poleDetail.summary.inconsistencyCount > 0 && (
                  <div style={{ marginTop: "0.35rem", fontSize: "0.74rem", color: "#64748b", lineHeight: 1.4 }}>
                    {poleDetail.summary.inconsistencyCount} data issue{poleDetail.summary.inconsistencyCount === 1 ? "" : "s"} flagged for audit.
                  </div>
                )}
              </div>

              {poleDetail.connectedPoles?.length > 0 && (
                <div style={{ marginTop: "1rem" }}>
                  <SectionTitle>Connected poles</SectionTitle>
                  <div style={{ marginTop: "0.55rem", display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                    {poleDetail.connectedPoles.slice(0, 4).map((segment) => (
                      <Badge
                        key={segment.id}
                        tone="neutral"
                        onClick={
                          onNavigateToPole && segment.pole
                            ? () => onNavigateToPole(segment.pole)
                            : undefined
                        }
                      >
                        {segment.pole?.poleNumber}
                      </Badge>
                    ))}
                    {poleDetail.connectedPoles.length > 4 && (
                      <Badge tone="neutral">+{poleDetail.connectedPoles.length - 4} more</Badge>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
          {poleDetail.connectedPoles?.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <SectionTitle>Connected poles</SectionTitle>
              <div style={{ marginTop: "0.55rem", display: "grid", gap: "0.45rem" }}>
                {poleDetail.connectedPoles.map((segment) => {
                  const canNavigate = Boolean(onNavigateToPole && segment.pole);
                  return (
                    <div
                      key={segment.id}
                      role={canNavigate ? "button" : undefined}
                      tabIndex={canNavigate ? 0 : undefined}
                      onClick={canNavigate ? () => onNavigateToPole(segment.pole) : undefined}
                      onKeyDown={
                        canNavigate
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onNavigateToPole(segment.pole);
                              }
                            }
                          : undefined
                      }
                      style={{
                        padding: "0.65rem 0.75rem",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        background: "#ffffff",
                        fontSize: "0.8rem",
                        color: "#334155",
                        cursor: canNavigate ? "pointer" : undefined,
                        textAlign: "left",
                      }}
                    >
                      <strong style={{ color: "#0f172a" }}>{segment.pole?.poleNumber}</strong>
                      {segment.pole?.streetName ? ` - ${segment.pole.streetName}` : ""}
                      {segment.lengthFt ? ` (${segment.lengthFt} ft)` : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {poleDetail.summary.actionCount > 0 ? (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.9rem",
                background: "#fef2f2",
                borderRadius: "14px",
                border: "1px solid #fecaca",
              }}
            >
              <SectionTitle>Fusion tasks at this pole</SectionTitle>
              <div style={{ marginTop: "0.3rem", fontSize: "0.76rem", color: "#991b1b" }}>
                Only tail-driven field fusion tasks are listed below.
              </div>
              {poleDetail.sheaths.flatMap((sheath) => sheath.actions).map((action, index) => (
                <ActionCard key={`${action}-${index}`} action={action} index={index} />
              ))}
            </div>
          ) : (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.85rem",
                borderRadius: "14px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
              }}
            >
              <SectionTitle>No fusion needed at this pole</SectionTitle>
              <div style={{ marginTop: "0.3rem", fontSize: "0.76rem", color: "#166534" }}>
                This pole does not have pending fusion tasks right now.
              </div>
            </div>
          )}

          {poleDetail.equipment?.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <SectionTitle>Equipment at this pole</SectionTitle>
              <div style={{ marginTop: "0.55rem", display: "grid", gap: "0.45rem" }}>
                {poleDetail.equipment.map((equipment) => (
                  <div
                    key={equipment.id}
                    style={{
                      padding: "0.7rem 0.75rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      background: "#ffffff",
                    }}
                  >
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0f172a" }}>{equipment.tag}</div>
                    <div style={{ marginTop: "0.12rem", fontSize: "0.78rem", color: "#475569" }}>{equipment.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: "1rem" }}>
            <SectionTitle>Fibers needing fusion</SectionTitle>
            {sheathsNeedingFusion.length > 0 ? (
              sheathsNeedingFusion.map((sheath) => (
                <div
                  key={sheath.id}
                  style={{
                    marginTop: "0.75rem",
                    border: "1px solid #fecaca",
                    borderRadius: "14px",
                    padding: "0.9rem",
                    background: "linear-gradient(180deg, #ffffff 0%, #fff7f7 100%)",
                    boxShadow: "0 12px 24px rgba(127, 29, 29, 0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a" }}>{getSheathDisplayName(sheath)}</div>
                      <div style={{ marginTop: "0.24rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.4 }}>
                        {sheath.role.toLowerCase()} end
                        {sheath.connectedPoleNumbers?.length > 0 ? ` -> ${sheath.connectedPoleNumbers.join(", ")}` : ""}
                      </div>
                    </div>
                    <Badge tone="danger">{sheath.fusionFibers.length} field task{sheath.fusionFibers.length === 1 ? "" : "s"}</Badge>
                  </div>

                  <div style={{ marginTop: "0.65rem", display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                    <Badge tone="danger">Field pending {sheath.summary.needFusionOperationalCount}</Badge>
                    {(sheath.summary.logicalFusionModeledCount ?? 0) > 0 && (
                      <Badge tone="success">Modeled {sheath.summary.logicalFusionModeledCount}</Badge>
                    )}
                    <Badge tone="neutral">Data issues {sheath.summary.inconsistencyCount}</Badge>
                    <Badge tone="success">Active {sheath.summary.activeCount}</Badge>
                    <Badge tone="neutral">Dark {sheath.summary.darkCount}</Badge>
                  </div>

                  {sheath.fusionFibers.map((fiber) => <FiberRow key={fiber.id} fiber={fiber} />)}
                </div>
              ))
            ) : (
              <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#64748b" }}>
                No fusion fibers are pending at this pole.
              </p>
            )}
          </div>
            </>
          )}
        </>
      )}

      {poleDetail && isMapPopover && (
        <MapPopoverSupplement
          data={data}
          poleDetail={poleDetail}
          compactActionSummaries={compactActionSummaries}
          onNavigateToPole={onNavigateToPole}
        />
      )}
    </>
  );
}

export function DetailSheet({ selected, onClose }) {
  if (!selected) return null;

  const isPole = selected.type === "pole";
  const data = selected.data;

  return (
    <div
      style={{
        position: "absolute",
        top: "4.5rem",
        right: "1rem",
        width: "360px",
        maxWidth: "calc(100% - 2rem)",
        maxHeight: "calc(100% - 5.5rem)",
        background: "white",
        borderRadius: "12px",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        zIndex: 750,
      }}
    >
      <div
        style={{
          padding: "1rem",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
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
      <div style={{ padding: "1rem", overflow: "auto", minHeight: 0 }}>
        {isPole ? (
          <PoleDetailContent data={data} />
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
