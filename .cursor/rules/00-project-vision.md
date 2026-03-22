# FiberOps — Project Vision

## What is FiberOps?

FiberOps is a field operations platform built for FTTH (Fiber to the Home) network teams.
Its core purpose is to give technicians and project managers a single place to understand,
plan, and track the physical fiber network — from the OLT at the head-end all the way to
the ONT at a customer's house.

The application replaces scattered spreadsheets, paper maps, and disconnected exports with
a live, intelligent system that understands how a fiber network actually works.

---

## The Problem We Are Solving

Fiber networks are physically complex. A single cable on a pole contains dozens of glass
strands, each one carrying light signals to and from multiple homes through passive splitters.
When something needs to be built, repaired, or extended, the people doing the work need to
know:

- Which fibers inside which cable are already in use
- Which fibers are dark (unused and available)
- Where exactly the splice points are
- Which poles or enclosures a technician needs to visit
- What equipment is at each location
- What the correct fusion assignments are before anyone climbs a pole

Right now this information lives in exported spreadsheets from design tools. Those exports
are hard to read, easy to misinterpret, and not connected to a map. Technicians either
waste time decoding the data or make mistakes in the field.

FiberOps solves this by parsing that raw data automatically and presenting it in a way
that anyone on the team can understand and act on.

---

## Who Uses This

**Field technicians** — they need to know exactly which fibers to splice, at which pole,
in which order. They should be able to open the app, find their job, and see a clear list
of what to do at each location without interpreting raw data.

**Project managers** — they need to see the overall state of the network: what's been
built, what's planned, where the capacity is, and which areas still need work.

**Network designers** — they import their design exports and verify that assignments are
correct before sending crews to the field.

---

## What the Application Does

### Map View
The map is the home base of the application. Every pole, enclosure, splice dome, and
cable route is visible on the map. Clicking any element shows what's there — equipment,
fiber assignments, and connection status.

### Fiber Assignment Engine
The core intelligence of the app. Given a raw fiber export (tab-separated data from
design tools), the system automatically:

- Groups fibers by sheath (cable)
- Identifies which fibers are fused (active) vs dark (unused/available)
- Assigns fibers to the correct OLT ports and wavelengths
- Flags any inconsistencies or missing assignments

### Field Visit Planner
For every sheath that has active fusions, the app generates a structured visit plan
telling technicians exactly which enclosures to visit, in which order, and what to
do at each one. No interpretation needed.

### Equipment Registry
Every piece of hardware in the network is tracked — OLTs, splitters, splice enclosures,
termination panels, SFP ports. The registry knows what equipment lives at which location
and what its current status is.

### Project Tracker
Work is organized into projects. Each project has a geographic area, a set of cables
and enclosures, and a status. Managers can see progress at a glance.

---

## The Bigger Goal

The long-term vision is for FiberOps to become the source of truth for the network.
Not just a viewer for exported data, but the system that *generates* the assignments,
tracks changes over time, and gives the team confidence that what's in the app matches
what's physically in the ground and on the poles.

A technician should be able to finish a splice job, mark it complete in the app, and
have that information immediately available to the rest of the team — no emails, no
spreadsheet updates, no phone calls to confirm.