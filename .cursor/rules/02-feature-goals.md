# Feature Goals — What We Are Building Toward

This file describes the features of FiberOps in terms of outcomes for the user,
not technical implementation. When building any feature, the question to always
ask is: does this make the job easier for the person in the field or behind the desk?

---

## Core Principle

**The app should know more about the network than the technician needs to memorize.**

A technician should never have to decode a spreadsheet, count buffer tube colors, or
look up which port a fiber maps to. The app does that work. The technician sees the
result: go here, open this enclosure, fuse these two fibers, mark it done.

---

## Feature 1 — The Map

### Goal
Give every user a geographic view of the entire network at a glance.

### What good looks like
- Poles, enclosures, and cable routes are visible on the map
- Color or icon indicates the status of each element (active, planned, needs attention)
- Clicking any element shows a summary of what's there without navigating away
- The map works in the field on a phone, not just on a desktop

### What to avoid
- Overloading the map with too much information at once
- Requiring the user to already know what they're looking for
- Showing raw data (UUIDs, wavelengths) on the map itself — those belong in detail views

---

## Feature 2 — Fiber Assignment Calculator

### Goal
Take a raw fiber export and automatically produce a human-readable assignment plan.

### What good looks like
- User pastes or uploads their export, clicks one button, and sees the results
- Every sheath is listed with its active fibers, dark fibers, and connected devices
- The system flags any fibers that have a wavelength assigned but no fusion, or a
  fusion with no wavelength — these are data inconsistencies that need attention
- Results can be exported back to CSV or JSON for use in other tools

### What to avoid
- Requiring the user to manually clean or reformat the export before uploading
- Failing silently when rows have missing columns
- Showing raw UUIDs without the human-readable name next to them

---

## Feature 3 — Field Visit Planner

### Goal
For any job that requires splicing, generate a clear, ordered list of site visits.

### What good looks like
- For each sheath with active fusions, the app shows exactly two locations to visit
  (the two ends of the cable) and what to do at each one
- The visit instructions include: which enclosure, which buffer tube, which fiber colors,
  which device/port to verify signal at, and what the expected wavelength is
- A technician can mark each step complete from their phone as they work
- When both ends are marked complete, the job is automatically closed

### What to avoid
- Generating visit plans that don't match the physical network (e.g. sending a tech
  to an enclosure that has no active fusions in that cable)
- Generic instructions that don't include the specific fiber colors and port names
- No way to know if the visit has already been done by someone else

---

## Feature 4 — Equipment Registry

### Goal
Track every piece of hardware in the network and know its current state.

### What good looks like
- Every OLT, splitter, splice enclosure, and termination panel is in the system
- Each piece of equipment is linked to a map location
- The registry shows how many ports are used vs available for each device
- Adding new equipment is simple and doesn't require a data import

### What to avoid
- Equipment records that exist in the registry but aren't linked to the map
- No way to tell if a piece of equipment is in service, spare, or decommissioned
- Treating every equipment type the same — an OLT and a splice dome have very different
  information attached to them

---

## Feature 5 — Project Management

### Goal
Organize work into projects so teams can track progress and plan resources.

### What good looks like
- A project has a name, a geographic boundary, a list of cables/enclosures in scope,
  and a status (planned, in progress, complete)
- Managers can see at a glance how many splice points are done vs remaining
- Field crews can see which projects are assigned to them
- Importing a new fiber export automatically associates its elements with the right project

### What to avoid
- Projects that are just a label with no connection to the actual network elements
- No visibility into who did what and when
- Requiring a manager to manually update status after every field visit

---

## The Import Problem (Current Priority)

Right now nothing imports correctly. This is the most urgent problem to fix because
every other feature depends on getting data into the system.

The import must handle:
- Tab-separated exports where some rows have all columns and some have only a few
- Rows that belong to the same sheath but are not grouped together
- Rows with `N/A` values in wavelength or circuit fields (these are valid, not errors)
- The `<- FUSION ->` connection value being the primary signal that a fiber is active
- The `X` connection value being the primary signal that a fiber is dark/unused

Once import works reliably, everything else can be built on top of it.