# Geometry And Performance Audit

Date: 2026-05-09

## Current Strengths

- Wall framing and wall solids derive from each wall path vector, so angled/slanted walls are supported by the core geometry model.
- The plan canvas now exposes an explicit Free angle control so slanted walls and skewed footprints do not depend on discovering the old ortho toggle.
- Wall assemblies now drive thickness, inside/outside faces, layer bands, and hosted opening void metadata.
- Floor/deck framing uses polygon line intervals, so L-shaped and attached-bay footprints can derive joists, rim members, beams, posts, and pier blocks without relying only on rectangular bounds.
- Assembly layers emit independent takeoff fragments for subfloor, sheathing, wrap, siding, roofing, insulation, finish layers, and other envelope materials.
- Roof types now cover gable, shed, lean-to, hip, cross-gable, valley, dormer, porch, roof-over-deck, flat, low-slope, gambrel, and mansard. Each family derives physical rafters plus roof planes and a topology record for diagnostics.
- Takeoff rows now preserve design quantity while adding waste quantity, purchase quantity, purchase unit, source type, level/source metadata, and connector/fastener allowances.
- The geometry test suite now includes a slanted-wall regression that verifies diagonal wall plates, wall solids, local axes, and visual drift detection.

## Highest-Risk Gaps

- Roof topology has first physical framing for every declared family, but it is still a starter topology kernel. Complex real-world intersections still need exact plane solving, ridge/valley cutbacks, collar ties, trusses, and cut-solid booleans.
- Non-orthogonal building footprints are partially supported. Wall paths are first-class and skewed floor/roof polygons stay in the model, but support intervals and roof warnings still require visual review for permit/purchase confidence.
- Material takeoff is purchase-planning aware, but still needs stronger cut optimization, SKU-specific supplier snapshots, fastener schedules by code/product system, and phase/room/global reconciliation views.
- Corner/join trimming is still metadata-first. Members carry axes, cut lengths, end cuts, join conditions, and collision priority, but visual solids are not yet trimmed by a full join/boolean kernel.
- Performance now has a worker interface and synchronous fallback, but the live editor still needs full async wiring, 3D instancing, drag throttling, virtualized takeoff tables, and bundle splitting before the 5k-member target is comfortable.

## UI/Workflow Corrections Made

- The canvas tab strip now represents project tabs, not foundation/roof drawing tabs.
- The project switcher is clickable and opens a project menu.
- Save writes to app storage through `/api/projects/:id` with localStorage fallback.
- Saved projects can be loaded from the project menu.
- The `+` canvas tab creates a fresh project tab/template instead of acting like another floor/roof drawing tab.
- JSON import remains available as an import path, not the primary save path.

## Performance Direction

- Keep derived-model memoization per project object and selected element.
- Continue wiring the new derived worker boundary for `deriveProject`, `validateProject`, `generateTakeoff`, and supplier mapping into the live React shell.
- Render repetitive framing members with instanced meshes in 3D.
- Virtualize or canvas-render dense 2D framing overlays when member counts grow past a few thousand.
- Throttle pointer-drag commits so geometry does not regenerate on every pointer event for large projects.
- Split the bundle by heavy 3D/editor surfaces so startup does not load every subsystem at once.

## Next Geometry Priorities

1. Replace starter roof-family heuristics with exact plane intersection and cutback solving.
2. Replace axis-interval support assumptions with a general polygon support kernel for skewed floor/deck/roof footprints.
3. Add true trimmed solids for studs, plates, rafters, joists, beams, purlins, and blocking.
4. Reconcile selected-element BOM, level BOM, global BOM, and supplier snapshots from one quantity source.
5. Add browser/performance tests for 2D/3D/Split, project switching, takeoff virtualization, and large 5k-member models.
