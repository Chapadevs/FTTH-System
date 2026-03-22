# Design Principles — How the App Should Feel

FiberOps is a tool for people doing physical, skilled work. It should feel like
it was built by someone who has been on a pole and knows what it's like to need
information quickly with dirty gloves and a phone with 2 bars of signal.

---

## Principle 1 — Field First

Every screen should be usable on a phone, in daylight, with one hand.

This does not mean the desktop experience is unimportant — project managers and
designers work at desks. But if a screen only works well on a large monitor, something
is wrong with the design. Test every feature on a small screen before calling it done.

---

## Principle 2 — Show Answers, Not Data

The raw fiber data is complex. The app's job is to do the hard work and show the
user only the answer they need.

Bad: "SHEATH UUID: 23ac6a4c | BUFFER: BL | FIBER: OR | CONNECTION: <- FUSION ->"
Good: "Orange fiber in the Blue tube — active, fused to port 2303E_SFP_01"

Wherever raw identifiers (UUIDs, wavelengths, color codes) must appear, they should
be accompanied by a human-readable explanation of what they mean.

---

## Principle 3 — Status Should Be Obvious

A user should never have to read a label to understand if something is working,
broken, available, or in progress. Color, iconography, and layout should convey
status at a glance:

- Active / fused → clearly green or confirmed
- Unused / dark → clearly neutral or gray
- Problem / inconsistency → clearly flagged, not buried in a table
- In progress → visibly different from complete

---

## Principle 4 — No Dead Ends

When the app can't do something, it should tell the user what to do next.

If an import fails, explain why in plain language and show what the data should
look like. If a fiber has no assignment, say so and suggest what might be missing.
If a feature isn't built yet, say so honestly. Never show a blank screen or a
generic error without a path forward.

---

## Principle 5 — The Map Is the Home

The map is not a feature — it is the foundation. Every entity in the system
(cable, enclosure, equipment, project) has a physical location, and the map is
the best way to understand how those entities relate to each other.

Navigation should feel like: start on the map, zoom to the area you care about,
click the thing you want to work with, act on it. Not: search through a list,
find an ID, copy it somewhere else.

---

## Principle 6 — Trust the Field

When a technician marks a splice as complete, that information is correct. The app
should record it, timestamp it, and make it visible to the rest of the team immediately.

The app should never require a supervisor to "approve" a field entry in order for it
to be visible. Trust the data from the field and let managers review it, not gate it.

---

## Tone and Language

The app deals with technical concepts but its users span from highly technical network
designers to newer field technicians. Language in the UI should:

- Use real industry terms (fusion, ONT, buffer tube, OLT, splitter) — these people
  know the vocabulary and dumbing it down is condescending
- Avoid internal system jargon (UUIDs, database IDs, API error codes) in user-facing text
- Be direct and short — labels, buttons, and status messages should be as few words as possible
- Never use passive voice in instructions — "Fuse Blue to Orange" not "The fibers should be fused"