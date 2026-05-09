# Contractor Hub

Contractor Hub is a browser-based construction planning and logistics tool for residential building, remodeling, additions, decks, and raised-floor structures. The product direction is not a sketch app. It is a component-based BIM-lite builder where terrain, foundations, framing, assemblies, rules, takeoff, supplier mapping, and exports all come from the same physical model.

The current application is in active development. We are intentionally replacing weak prototype paths instead of preserving them. If a subsystem blocks accurate building behavior, the correct move is to remake it around the contractor-grade model, not patch around old assumptions.

## Product Goal

Contractor Hub should help a professional or serious owner-builder:

- Model uneven terrain, pads, contours, pier heights, and support points.
- Place raised floors, decks, porches, walls, openings, roofs, stairs, and MEP starter elements.
- Generate physical framing: joists, beams, blocking, posts, pier blocks, plates, studs, headers, trimmers, rafters, ridge boards, fascia, rake boards, purlins/battens, and gable infill.
- Switch between framing, architectural, and painted/finished visual modes.
- Inspect every element with dimensions, placement, assembly stack, material choices, code notes, derived quantities, and warnings.
- Produce organized material lists globally, by subsystem, by source element, and eventually by room/wall/roof plane/phase.
- Map material requirements to supplier SKUs, beginning with Home Depot-style curated supplier matching.
- Save/load projects and eventually produce blueprint-grade drawing packages.

The target is high-fidelity construction planning. It is not yet a permit-ready or engineer-approved system.

## Core Doctrine

Contractor Hub models assembled physical systems, not flat planes.

- A wall is an assembly stack: drywall or interior finish, framing, insulation, sheathing, weather barrier, siding, trim, and hosted openings.
- A floor is a framed platform: joists, rim/band joists, beams, blocking, subfloor, insulation, finish flooring, posts, pier blocks, and terrain-bearing points.
- A roof is a framed and layered system: rafters or trusses later, ridge/ridge beam, ties, purlins or battens where appropriate, lookouts, fascia, rake boards, sheathing, underlayment, and roofing.
- A board is a physical volume with actual dimensions, orientation, cut length, stock length, bearing role, and source element.

This matters because a 2x8 rafter on edge, a 2x8 used flat, a batten over rafters, and a structural purlin with struts are different construction objects with different strength, takeoff, and code implications.

## Current State

The app currently includes:

- React + Vite frontend with Three.js / React Three Fiber rendering.
- Zustand editor/project state with undo/redo, mode switching, active tools, view modes, layers, pan/zoom, and selection.
- BIM-lite `ProjectDocument` under `client/src/bim` as the saved source of truth.
- Terrain model with flat, sloped plane, height points, terrain mesh, contours, and sampled pier/post heights.
- Editable floors, decks, walls, half walls, openings, roofs, stairs, electrical devices, circuits, plumbing fixtures, pipes, and ducts.
- Step 7B framing-kernel contracts: support grids, bearing points, join conditions, unresolved intersection reporting, member cut metadata, and additive style fields.
- Floor/deck derivation for joists, rim/band joists, edge/interior beams, blocking rows, posts, centered pier blocks, ledger conditions, and terrain-derived post heights.
- Wall derivation for bottom plates, top plates, optional double top plates, corner packs, tee/ladder backing, studs, headers, trimmers, sills, cripples, and half-wall caps.
- Roof derivation for gable and shed/low-slope starters, rafters, ridge boards, ties, fascia, rake boards, lookouts/outriggers, gable infill, purlin/batten mode, and structural purlin-with-struts mode.
- Material profiles for dimensional lumber, posts, sheathing, subfloor, siding, roofing, drywall, insulation, flooring, and starter MEP materials.
- 2D plan canvas, optional 3D/diagram viewport, framing/architectural/painted display modes, and layer controls.
- Inspector tabs for placement, dimensions, assembly, derived quantities, materials, and code.
- Starter Generic IRC/AWC-informed rule checks, orientation validation, assembly completeness checks, load-path warnings, MEP starter checks, and quick fixes.
- Takeoff generation for framing and assembly layer fragments.
- Mock Home Depot-first supplier matching.
- JSON/CSV/export stubs and backend API boundaries.
- Golden tests for geometry, framing renderables, material profiles, terrain/pier behavior, wall/opening framing, roof planes, support grids, ledger decks, purlin struts, and unresolved joins.

Verification checkpoint:

- `npm run build` passes.
- `npm test -- --runInBand` passes.
- Current golden model derives 326 framing members, 16 pier blocks, and 4 roof planes.

## Not Yet Contractor-Grade

Known gaps:

- Member end cuts are metadata and visual cut markers, not full boolean-cut solids.
- Wall joins/intersections are improved but still not a full framing layout solver for every corner, tee, offset, and braced-wall condition.
- Floor/deck support logic is better, but not yet full DCA6/AWC/IRC deck engineering with connector selection, footing sizing, lateral load connections, frost depth, or guards.
- Roof logic needs hip, valley, dormer, truss, collar tie, ceiling joist, low-slope, porch roof, roof-over-deck, and wall-attached lean-to depth.
- Span tables are starter table-like data, not full species/grade/load/deflection code tables.
- Terrain is visually useful but not yet survey-grade TIN, grading, drainage, pad/cut/fill, or import/export.
- MEP is starter modeling, not circuit routing, DWV venting, panel schedules, duct sizing, or clash-grade coordination.
- Takeoff needs purchase-unit conversion, exact cut optimization, fasteners/connectors, roll/bundle logic, waste rules, and supplier price snapshots.
- Blueprints are not yet scaled permit sheets with complete dimensions, elevations, sections, schedules, and PDF output.
- Backend persistence, snapshots, migrations, collaboration, auth, and audit logs are not production-ready.

## Development Principle

This project is in development, not legacy maintenance.

When current behavior is wrong for the target product, prefer remaking the subsystem around the physical model over preserving legacy UI or geometry. The preserved contract is the product doctrine:

```text
Design intent -> physical components -> validation -> takeoff -> rendering -> export
```

If a feature only draws something on screen and does not create traceable physical components, it is incomplete.

## Project Structure

```text
/
|-- client/
|   |-- src/
|   |   |-- bim/              # BIM-lite schema, terrain, geometry kernel, rules, takeoff, suppliers
|   |   |-- editor/           # App shell, canvas, tools, inspector, UI helpers
|   |   |-- stores/           # Zustand project/editor state
|   |   |-- App.tsx
|   |   |-- app.css
|   |   `-- main.tsx
|   `-- dist/
|-- server/
|   `-- src/                  # Express API boundaries and services
|-- shared/                   # Future shared schema package
|-- tests/                    # Geometry/golden tests
|-- ARCHITECTURE_PLAN.md      # Living technical architecture
|-- CONTRACTOR_GRADE_ROADMAP.md
|-- COMPETITIVE_STANDARDS_AUDIT.md
|-- SETUP.md
`-- package.json
```

## Commands

```bash
npm install
npm run dev
npm run build
npm test -- --runInBand
```

The browser app runs at `http://localhost:5173/`. The API defaults to `http://localhost:3000/`.

## Current Priority

The next work should stay inside the building system before blueprints, supplier polish, or advanced MEP:

1. Complete framing-kernel visual accuracy: true trimmed/cut solids, roof/floor/wall collision cleanup, wall corner/intersection solver, and selectable/debuggable member joins.
2. Add roof/deck/wall/floor style depth: lean-to roofs, porch roofs, decks, guards/rails, landings, stairs, half walls, interior/exterior wall options, floor/roofing/siding choices.
3. Strengthen structural rules: full span-table packs, support/load-path checks, blocking/bracing rules, purlin/batten distinctions, footing/ledger/deck warnings.
4. Then move into blueprint sheets, supplier pricing, MEP routing, and production persistence.
