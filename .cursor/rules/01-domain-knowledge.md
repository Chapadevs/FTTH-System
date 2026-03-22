# Domain Knowledge — How a Fiber Network Works

This file exists so that any developer or AI model working on FiberOps understands
the physical reality behind the data. The application must reflect how the network
actually works, not just how the data is structured.

---

## The Physical Hierarchy

A fiber network is a set of nested containers. From largest to smallest:

**Cable (Sheath)**
The black outer jacket running along poles or underground. A cable contains multiple
buffer tubes. A 48-count cable has 4 buffer tubes of 12 fibers each. The cable itself
carries nothing — it is just protection and structure.

**Buffer Tube**
A colored plastic tube inside the cable. Each tube holds a group of fibers and is
identified by color (Blue, Orange, Green, Brown, Slate, White, Red, Black, Yellow,
Violet, Pink, Aqua). The color is used to locate the right group when working inside
a splice dome.

**Fiber**
The actual glass strand inside a buffer tube. Also color-coded using the same 12-color
sequence. This is where light travels. One fiber is thinner than a human hair.

---

## How Light Travels — Two Directions, One Strand

A single fiber carries both downstream and upstream traffic simultaneously using two
different wavelengths of light:

- **1490 nm** — downstream (OLT to customer). Called FORWARD in the data.
- **1310 nm** — upstream (customer to OLT). Called RETURN in the data.

They do not interfere because they are different colors of light, separated by a prism
filter at each end. This is why one fiber can appear twice in the data — once as FORWARD
and once as RETURN — they are the same physical strand.

Note: the Vecima OLT used in this project uses a dual-fiber SFP, meaning it physically
separates TX and RX onto two separate fiber strands. So in this system, FORWARD and
RETURN are on adjacent fibers (e.g. Blue and Orange in the same buffer tube), one fiber
per direction. This is a vendor hardware choice, not a universal rule.

---

## The Network Path From Head-End to House

```
OLT  →  trunk cable  →  splice dome  →  splitter  →  drop cables  →  ONT at house
```

**OLT (Optical Line Terminal)**
The head-end equipment at the central office or node. This is where all fiber paths
originate. It has SFP ports, each of which serves one PON (Passive Optical Network)
channel. One PON channel can serve up to 32 or 128 homes depending on the split ratio.

**Trunk cable**
Runs from the OLT to the first splice point. High fiber count (48ct, 96ct, 144ct).
Every fiber in this cable is a potential channel to a neighborhood.

**Splice dome / enclosure**
A weatherproof box on a pole or in a vault where fibers from different cables are
joined (fused) together. This is where the trunk fiber connects to the distribution
fiber. It is also where splitters live.

**Splitter**
A passive optical device (no electricity, no moving parts) that copies a single
fiber's light signal and sends it to multiple output fibers. A 1×8 splitter takes
one input and creates 8 identical outputs. Each split loses half the signal power
(3 dB). Common ratios: 1×2, 1×4, 1×8, 1×16, 1×32.

**Drop cable**
A smaller cable (typically 2-fiber or 4-fiber) that runs from the splitter output
to an individual home.

**ONT (Optical Network Terminal)**
The device at the customer's home. It converts light to ethernet and powers the
customer's router and devices.

---

## What a Fusion Splice Is

When two fiber ends are joined together, they are fusion spliced — the glass is
literally melted together using an electric arc. The result is a permanent, nearly
lossless connection. A good fusion splice has less than 0.1 dB of loss.

In the data, a fusion splice appears as `<- FUSION ->` in the CONNECTION column.
This means both enclosures listed in that row (START ENCLOSURE and END ENCLOSURE)
must be visited to service that connection.

A fiber marked `X` in the CONNECTION column is dark — it has no active splice and
carries no signal. It represents available capacity.

---

## What the Data Export Represents

Each row in a fiber circuit export represents one fiber strand inside one cable,
showing its full path and assignment. Key columns:

- **SHEATH UUID / SHEATH NAME** — identifies the cable this fiber belongs to
- **START ENCLOSURE / END ENCLOSURE** — the two poles/locations this cable runs between
- **BUFFER** — which buffer tube inside the cable (by color code)
- **FIBER** — which specific strand inside that buffer tube (by color code)
- **CONNECTION** — what happens at the splice point (`<- FUSION ->` or `X`)
- **WAVELENGTH** — the light wavelength assigned to this fiber (e.g. 1540.56 nm)
- **DEVICE NAME / PORT NAME** — which OLT port this fiber is assigned to

Understanding this structure is essential for the fiber assignment engine to work
correctly. The goal is to take this raw tabular data and turn it into actionable
field instructions.