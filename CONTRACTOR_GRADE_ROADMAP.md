# Contractor-Grade Roadmap

This roadmap grades the current app against the original Contractor Hub vision and defines the next implementation steps required to become a reliable construction workflow tool.

## Current Grade Against Original Vision

| Subsystem | Current Grade | Current State | Main Gap |
|---|---:|---|---|
| Editor shell and navigation | 6/10 | Professional multi-panel editor with modes, inspector, layers, and 2D/3D workspace. | Needs smoother workflows, command affordances, construction-specific outliner, and fewer legacy-feeling panels. |
| BIM-lite data model | 6/10 | `ProjectDocument`, elements, assemblies, materials, derived framing, support grids, bearing points, rules, takeoff. | Needs migrations, stronger rule provenance, richer accessories, and shared client/server schema. |
| Terrain/site | 4/10 | Flat/sloped/TIN-like height points, mesh, contours, pier sampling. | Needs editable boundaries, true TIN/contours, pads, cut/fill, survey import, drainage. |
| Floor/foundation framing | 6/10 | Joists, rim/band joists, beams, blocking, support grids, posts, pier blocks, terrain-derived heights. | Needs true trimmed solids, footing rules, bracing, connector logic, beam sizing, deck/porch support depth. |
| Wall/opening framing | 5/10 | Studs, plates, corner packs, tee/ladder backing, headers, trimmers, cripples, half-wall caps. | Needs robust wall joins, sheathing/bracing/shear, exact cut solids, wall-type catalogs, and intersection solver. |
| Roof framing | 5/10 | Gable/shed starters, rafters, ridge, fascia, rake boards, ties, gable infill, purlin/batten modes, structural purlin struts. | Needs hip/valley/dormer/porch/lean-to depth, proper cut solids, collar ties, trusses, roof-material-specific assemblies. |
| Member orientation | 6/10 | `MemberOrientation`, `StructuralMemberSpec`, dimensional profiles, cut/stock metadata, validation. | Needs user-editable orientation debug, stronger structural rule packs, and true geometry orientation/cut faces. |
| Assemblies/layers | 6/10 | Assembly layers, envelope surfaces, layer takeoff fragments, completeness checks. | Needs richer assembly catalogs, material alternatives, stage toggles, and layer-specific visual peeling. |
| Rules/code | 4/10 | Starter warnings, orientation validation, assembly checks, purlin mode logic, load-path checks. | Needs data-driven rule packs, full span tables, state profiles, egress, energy, MEP rules, provenance. |
| MEP | 2/10 | Devices, circuits, fixtures, pipes, ducts, starter placement. | Needs routing, circuit schedules, outlet spacing, DWV/venting, slope validation, clash-grade geometry. |
| Materials/takeoff | 5/10 | Framing takeoff, cut/stock lengths, layer fragments, floor/wall/roof basics, mock supplier matches. | Needs connectors/fasteners, exact cut optimization, roll/bundle conversions, SKU mapping depth. |
| Blueprints/export | 2/10 | JSON/CSV/export stubs and simple sheet preview. | Needs scaled PDF sheets, schedules, dimensions, elevations, sections, symbols. |
| Persistence/backend | 3/10 | API boundaries and shared service logic. | Needs durable project storage, snapshots, migrations, auth-ready boundaries. |
| Testing | 4/10 | Build and geometry golden test. | Needs broad unit, browser, visual, rules, takeoff, and export tests. |

Overall current grade: **5/10**. The app has moved from prototype toward a real BIM-lite construction model, but contractor-grade reliability still depends on trimmed solids, construction-style depth, full rule packs, and robust takeoff/export workflows.

## Development Policy: Remake Weak Systems

Contractor Hub is not in legacy-maintenance mode. Do not preserve old components, panels, or geometry logic when they undermine construction accuracy.

Replace or retire code when:

- it treats building systems as flat shapes instead of physical assemblies.
- it generates display geometry without traceable members, materials, quantities, and rules.
- it duplicates model truth outside `ProjectDocument` or derived BIM outputs.
- it makes the UI feel like a demo instead of a contractor tool.
- it prevents tests from proving framing, takeoff, or validation correctness.

The product standard is not "keep the old thing working." The standard is "make the construction workflow correct, inspectable, and testable."

## Step 6: Assembly Stack and Orientation Engine

Status: implemented as the current assembly/orientation foundation.

Goal: make assembled envelopes and member orientation first-class model concepts.

### Implemented Foundation

- Assembly layers and material profiles.
- Member orientation and structural member specs.
- Envelope surfaces for assembly layers.
- Layer takeoff fragments.
- Orientation validation for structural members.
- Assembly completeness validation.
- Inspector visibility for assembly stack and derived quantities.

### Remaining Expansion

- Add `AssemblyStack` semantics to wall, floor, and roof assemblies.
- Add `MemberOrientation`: `onEdge`, `flat`, `vertical`, `slopedOnEdge`, `builtUp`.
- Add `StructuralMemberSpec` for derived and manually placed framing members.
- Derive `EnvelopeSurface` records for drywall, sheathing, wrap, siding, roofing, flooring, insulation, and underlayment.
- Add orientation validation:
  - rafters and joists must be on edge or sloped on edge.
  - posts and studs must be vertical unless intentionally sloped/braced.
  - beams/headers must use valid built-up or on-edge profiles.
  - flat structural orientation must fail or require engineering.
- Add assembly completeness validation:
  - exterior wall requires finish/core/sheathing/weather barrier/exterior finish.
  - roof requires structure/sheathing or purlin system/underlayment/roofing.
  - floor requires structure/subfloor and optional finish/insulation based on stage.
- Update inspector to show assembly stack thickness, layer order, layer materials, and orientation.
- Update takeoff to emit independent layer rows.

### Acceptance Criteria

- Selecting an exterior wall shows a full ordered layer stack and cumulative thickness.
- Changing wall type changes framing material, insulation, sheathing, wrap, siding, takeoff, and rendered thickness.
- A rafter marked `flat` produces a structural failure warning.
- Every assembly layer emits a takeoff fragment or is explicitly marked non-takeoff.
- Opening areas deduct from sheathing/wrap/siding/drywall surfaces where applicable.

### Tests

- Unit tests for assembly thickness and layer order.
- Unit tests for on-edge vs flat orientation rules.
- Golden model test proving exterior wall layers generate separate drywall, insulation, sheathing, wrap, and siding rows.
- Golden model test proving roof material changes affect purlin/decking requirements.
- Inspector/browser test for editing assembly and orientation fields.

### Done Means

The app can answer: "What is this wall physically made of, how thick is it, how is every structural member oriented, and what material rows does each layer create?"

Original implementation plan: `plans/STEP_6_ASSEMBLY_ORIENTATION_PLAN.md`.

## Step 7: Structural Rules, Span Tables, Blocking, Purlins, And Load Path

Goal: make generated framing construction-aware rather than just visually plausible.

### Implementation Targets

- Add table-driven span data for floor joists, rafters, headers, beams, and purlins.
- Add species, grade, spacing, live load, dead load, and deflection inputs.
- Add blocking rules for joist depth/span and wall requirements.
- Add roof-material-aware purlin/decking logic:
  - shingles require continuous sheathing.
  - metal roofing may use purlins if product/system allows.
- Add load path checks from roof to walls, walls to floor beams, beams to posts, posts to pier blocks/footings.
- Add rule results with exact highlight targets.

### Acceptance Criteria

- Joist and rafter warnings come from table data, not hardcoded generic limits.
- Roof system changes between shingles and metal change sheathing/purlin takeoff behavior.
- Unsupported beams, posts, and roof loads are flagged.
- Blocking rows are generated where required and appear in takeoff.

### Tests

- Known pass/fail span-table fixtures.
- Blocking generation fixtures.
- Purlin/sheathing fixtures for shingles vs metal roof.
- Load path warning fixtures for missing bearing supports.

### Done Means

The app can explain why a member size/spacing passes, fails, or requires engineering, with a traceable reference and highlighted member.

## Step 7B: Framing Kernel, Styles, And Support Graph

Status: partially implemented.

### Implemented

- Additive types for support grids, bearing points, member joins, cut faces, deck modes, wall styles, roof attachments, and purlin modes.
- Floor/deck support-grid derivation with edge/interior beams, ledger bearing, post points, and centered pier blocks.
- Wall framing with plates, double top plates, corner packs, tee/ladder backing, openings, and half-wall caps.
- Roof framing with eave/rake overhangs, battens/nailers vs structural purlins with struts, wall-attached shed behavior, lookouts, fascia, rake boards, and gable infill.
- Inspector controls for floor/deck/wall/roof framing styles.
- Golden tests for support grids, ledger decks, wall plates, corner packs, purlin struts, terrain seating, and unresolved intersections.

### Remaining

- True trimmed/cut render solids and collision cleanup.
- Full wall corner/intersection solver.
- Full roof family support.
- Construction accessories: decks, porches, stairs, landings, rails/guards, posts/columns, connectors, and exterior trim systems.
- Data-driven span/load/deck/footing rules.

## Step 7C: Trimmed Solids, Style Catalogs, And Building Accessories

Goal: finish enough framing/building behavior that the structure reads as a real build, not disconnected sticks.

### Implementation Targets

- Replace box-only member rendering with cut-aware solids:
  - rafter seat/plumb cuts.
  - ridge/rafter butt or miter conditions.
  - beam/post bearing trims.
  - wall plate/stud/header intersections.
  - no member visually passing through another when a join condition exists.
- Add style catalogs:
  - exterior wall: 2x4, 2x6, rainscreen, board/batten, lap siding, T1-11, plywood shop wall.
  - interior wall: partition, plumbing wall, bearing wall, half wall, pony wall.
  - floor/deck: platform, raised floor, freestanding deck, ledger deck, porch, cantilever.
  - roof: gable, shed, wall-attached lean-to, porch roof, hip placeholder with engineered flag, low-slope system.
- Add accessories:
  - stairs with landings.
  - guards/rails.
  - posts/columns.
  - beams.
  - exterior trim/fascia/soffit placeholders.
  - deck boards/subfloor/finish flooring toggles.
- Add construction debug overlays:
  - support lines.
  - bearing points.
  - cut faces.
  - unresolved joins.
  - stock length and cut length labels.

### Acceptance Criteria

- A gable roof does not show rafters, ridge, rake boards, purlins, or fascia visually running through one another at common joins.
- A raised floor visually sits on beams/posts/pier blocks, with post centers aligned to beam lines and terrain.
- Exterior walls show bottom plate, top plate, double top plate, corner pack, studs, and opening framing consistently.
- Deck/porch/stair tools create useful construction primitives, not generic rectangles.
- The inspector can change wall/floor/roof styles and immediately update framing, warnings, and takeoff.

### Tests

- Golden tests for rafter/ridge/fascia cut metadata and no unresolved common joins.
- Golden tests for deck ledger/freestanding support layouts.
- Golden tests for wall tee/corner/intersection styles.
- Golden tests for stairs/landings/guards.
- Browser visual QA for framing, architectural, and painted modes.

### Done Means

The core building shell can be modeled, inspected, visually trusted, and estimated well enough to move on to blueprints and supplier logistics.

## Step 8: Full Layered Takeoff And Supplier Mapping

Goal: make material estimates useful for real planning and purchasing.

### Implementation Targets

- Normalize all takeoff rows into `LayerTakeoffFragment` and member fragments.
- Group by global, subsystem, phase, room, wall, roof plane, floor area, and source element.
- Deduct openings from layer surfaces.
- Convert area/length quantities into real purchase units:
  - sheets.
  - rolls.
  - bundles.
  - boxes.
  - boards by length.
- Add waste logic per material and per layer.
- Add supplier adapter interface with Home Depot-first curated mapping.
- Store price and availability snapshots separately from design quantities.

### Acceptance Criteria

- A selected wall shows separate rows for studs, plates, headers, insulation, sheathing, wrap, siding, drywall, and fastener allowances.
- Global BOM and wall-by-wall BOM agree.
- Changing assembly material updates quantities and SKU candidates without corrupting design math.
- Supplier rows show timestamped price/availability mock data.

### Tests

- Wall/floor/roof takeoff fixtures with expected rows.
- Opening deduction tests.
- Purchase-unit conversion tests.
- SKU mapping tests.

### Done Means

The app can produce a contractor-readable material list that separates what goes where and what to buy.

## Step 9: Blueprint/PDF And Schedules

Goal: produce permit-supporting drawing packages from the BIM-lite model.

### Implementation Targets

- Scaled site plan with terrain points/contours.
- Floor plans with dimensions, rooms, walls, doors, windows, fixtures, and symbols.
- Framing plans for floor, wall, roof, piers/posts, beams, rafters, and purlins.
- Elevations and sections.
- Electrical, plumbing, and HVAC basic plans.
- Door/window/fixture/material schedules.
- PDF export and project package export.

### Acceptance Criteria

- Sheets render at consistent scale.
- Dimensions and schedules reference real model elements.
- Rule warnings appear in a code review sheet.
- Exported package includes project JSON, BOM CSV, and PDF.

### Tests

- PDF smoke tests.
- Golden sheet snapshots.
- Schedule count tests.
- Save/load/export round-trip tests.

### Done Means

The app can generate a coherent drawing package from the same model used for takeoff and validation.

## Step 10: Code Packs, Persistence, And Production Hardening

Goal: make the platform durable, extensible, and ready for real projects.

### Implementation Targets

- Durable project persistence with snapshots and version migrations.
- Rule pack versioning for Generic IRC first, then jurisdiction profiles.
- Server/client schema sharing.
- Auth-ready project boundaries.
- Audit logs for project changes, rule pack version, and exported package.
- Bundle splitting and performance pass for large models.
- Browser workflow tests and visual regression tests.

### Acceptance Criteria

- Project documents migrate forward without losing older saved designs.
- Rule results include rule pack version and reference.
- Snapshots can be restored.
- Large sample projects remain responsive.

### Tests

- Migration fixtures.
- API contract tests.
- Rule pack version tests.
- Browser workflow tests.
- Performance smoke tests.

### Done Means

The app has the operational foundation to handle real contractor projects, not just demo sessions.

## Guiding Standard

Every future implementation pass should preserve this chain:

```text
Design intent -> physical components -> validation -> takeoff -> rendering -> export
```

If a feature only changes the drawing but not the physical component model, it is not enough for contractor-grade work.
