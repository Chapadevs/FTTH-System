# Migration and Backfill Strategy

## Fiber Domain Models (add_fiber_domain_models)

### New Tables
- `Sheath` — cable identity per project
- `SheathEndpoint` — links sheath to poles (start/end)
- `FiberRecord` — buffer/fiber colors, connection type, wavelength
- `FiberAssignment` — device/port linkage, status (ACTIVE/DARK/INCONSISTENT)

### Backfill Strategy
- **Existing projects**: Remain unchanged. No backfill of fiber data required.
- **Legacy records**: Pole, FiberSegment, Equipment continue to work as before.
- **Fiber intelligence**: Available when user pastes fiber export into the dashboard calculator. DB persistence of fiber records is optional and can be added in a future import flow.
- **Import metadata**: New field `Project.importMetadata` (JSON). New imports store `selectedSheets`, `ignoredSheets`, and `warnings`. Existing projects have `null`; no migration of historical data needed.

### Consistency Rules
- Import uses `prisma.$transaction` — no partial project writes.
- Segment deduplication is deterministic (from|to normalized so A-B and B-A count as one).
- Sheet selection is explicit — only user-selected sheets are processed.
