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
- Edit non-rectangular floors and roofs with polygon handles, attached additions, split/delete/clean tools, and reviewed wall/roof sync previews.
- Pull early site intelligence for terrain elevation, weather grid metadata, climate zone context, and keyed hazard/code provider readiness.
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
- Roof derivation for gable, shed, lean-to, hip, cross-gable, valley, dormer, porch, roof-over-deck, flat, low-slope, gambrel, and mansard starters. Every declared roof family now emits physical rafters, roof planes, topology diagnostics, trim members, and material surfaces instead of decorative-only placeholders.
- Material profiles for dimensional lumber, posts, sheathing, subfloor, siding, roofing, drywall, insulation, flooring, and starter MEP materials.
- Professional Contractor Hub studio shell with persistent Store/Cart, stable Save/Load/Export/Undo/Redo commands, consolidated `Site / Build / Systems / Materials / Code / Blueprints` navigation, and future-suite stubs that show a non-blocking "to be developed" notice.
- Real workspace modes for `2D Plan`, `3D Framing`, `Split`, `Sheets`, `Materials`, and `Code`; 2D and 3D remain reachable at every supported viewport instead of being CSS-hidden on compact screens.
- 2D plan canvas, 3D/diagram viewport, framing/architectural/painted display modes, document-tab stubs, and layer controls.
- Polygon-accurate 3D floor rendering for non-rectangular floor/addition footprints.
- Derived wall solids with assembly-driven thickness, inside/outside faces, layer bands, and hosted opening voids.
- Polygon footprint editing for floors and roofs: vertex handles, edge handles, attached addition targeting, hover preview, split edge, delete vertex, and cleanup.
- Review modal for floor-driven updates, allowing exterior wall sync, roof footprint sync, and opening remap preview before applying.
- Site Intelligence panel backed by open-data/service-ready contracts for USGS elevation, weather.gov grid metadata, climate zones, and ASCE/ICC provider readiness.
- Single right-side inspector with `Properties`, `Assembly`, `Derived`, `Materials`, and `Code` tabs. The Properties tab combines placement and element-specific dimensions so the right side does not duplicate itself.
- Project tabs represent separate projects. Use the project switcher to open saved work, `Save` for app storage with local fallback, `Load` for JSON import, and `+` for a fresh project template.
- Starter Generic IRC/AWC-informed rule checks, orientation validation, assembly completeness checks, real-polygon load-path warnings, MEP starter checks, and quick fixes.
- Editor constraints that keep hosted door/window openings inside their wall segment during placement and resizing.
- Takeoff generation for framing and assembly layer fragments.
- Mock Home Depot-first supplier matching.
- Store selection, cart grouping, share/revoke cart flow, and supplier offer plumbing for the material-list workstream.
- JSON/CSV/export stubs and backend API boundaries.
- Golden tests for geometry, framing renderables, material profiles, terrain/pier behavior, wall/opening framing, roof planes, support grids, ledger decks, purlin struts, and unresolved joins.

Verification checkpoint:

- `npm run build` passes.
- `npm test` passes.
- Current golden model derives 316 framing members, 16 pier blocks, and 4 roof planes.

## Not Yet Contractor-Grade

Known gaps:

- Member end cuts are metadata and visual cut markers, not full boolean-cut solids.
- Wall joins/intersections are improved but still not a full framing layout solver for every corner, tee, offset, and braced-wall condition.
- Floor/deck support logic is better, but not yet full DCA6/AWC/IRC deck engineering with connector selection, footing sizing, lateral load connections, frost depth, or guards.
- Roof logic has first-pass physical framing for the supported family list, but still needs exact plane intersections, engineered cutback rules, trusses, collar ties, and true trimmed solids.
- Takeoff rows now carry design quantity, purchase quantity, purchase unit, waste quantity, source type, and connector/fastener allowances. Supplier matching is still a mock/catalog layer until live supplier snapshots are wired.
- Span tables are starter table-like data, not full species/grade/load/deflection code tables.
- Terrain is visually useful but not yet survey-grade TIN, grading, drainage, pad/cut/fill, or import/export.
- MEP is starter modeling, not circuit routing, DWV venting, panel schedules, duct sizing, or clash-grade coordination.
- Takeoff needs purchase-unit conversion, exact cut optimization, fasteners/connectors, roll/bundle logic, waste rules, and supplier price snapshots.
- Blueprints are not yet scaled permit sheets with complete dimensions, elevations, sections, schedules, and PDF output.
- Backend persistence, snapshots, migrations, collaboration, auth, and audit logs are not production-ready.
- Browser visual regression coverage still needs to catch every full-window and partial-window editor layout.

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
|   `-- src/                  # Express API boundaries, services, and store adapters
|-- shared/                   # Shared app/store types
|-- tests/                    # Geometry/golden tests
|-- .gitignore                # Keeps generated build/cache/log/env files out of status
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
npm test
```

The browser app runs at `http://localhost:5173/`. The API defaults to `http://localhost:3000/`.

## UX Layout Standard

The editor must stay readable from full-window desktop down to partial-window layouts.

- Wide desktop, `>= 1360px`: mode rail, tool panel, canvas/3D workspace, and inspector can all be visible.
- Standard desktop, `1100-1359px`: tool panel stays visible; inspector becomes an adaptive drawer.
- Partial/tablet, `760-1099px`: tools and inspector become mutually exclusive drawers; canvas stays primary.
- Narrow, `< 760px`: canvas-first layout with top mode navigation and bottom-sheet tools/inspector.
- The top command bar must preserve the workspace mode switch, Store, and Cart at every width. File commands may become icon-first before those primary controls disappear.
- `2D Plan`, `3D Framing`, and `Split` are real UI state, not decorative tabs. Do not reintroduce CSS rules that hide `.three-wrap` without an alternate 3D access path.
- Numeric fields, selects, and editable controls should not compress below `96px`.
- Canvas headers, mode buttons, and tool buttons must ellipsize or scroll within their own strip before overlapping adjacent controls.
- Topbar commands must use overflow behavior instead of crushing Store, Cart, Load, Save, BOM, and Blueprint actions into unreadable controls.
- Dense tables must scroll horizontally before columns become unreadable.
- Project tabs represent separate projects. Do not use canvas tabs for foundation/roof views of the same project; use workspace modes, sheets, layers, and inspector context for that.

Before handing off shell/UI changes, verify roughly `1440x900`, `1100x760`, `820x700`, and `390x800`, and confirm the footprint review modal still previews, cancels, and applies correctly.

See `docs/GEOMETRY_AND_PERFORMANCE_AUDIT.md` for the current geometry/material/performance audit and the next fidelity priorities.

## Environment

Copy the example env file to create your local `.env` (do NOT commit `.env`):

```bash
cp .env.example .env
# edit .env and set REDIS_URL if you want Redis persistence for shareable carts
```

`.env.example` contains the recommended variables and safe defaults (HOMEDPOT_MODE defaults to `mock`). Keep secrets out of the repo and use repository secrets in CI.

## Store adapters & Home Depot scraping

This project includes a store-adapter layer that maps material lists to supplier SKUs. The Home Depot adapter supports three modes:

- `mock` — safe default, uses local sample data.
- `unofficial` — experimental scraping heuristics; DO NOT enable on shared, CI, staging, or production environments.
- `live` — partner API mode (requires credentials and legal approval).

Important safety & opt-in
------------------------

- By default `HOMEDPOT_MODE=mock`. To enable `unofficial` locally you must explicitly opt-in and keep it local-only:
	- Set `ALLOW_UNOFFICIAL=true` and ensure `NODE_ENV=development`.
	- Configure a local admin key via `ADMIN_API_KEY` to use admin debug routes.

Example (PowerShell) — enable experimental scrapers locally:

```powershell
cp .env.example .env
$env:ALLOW_UNOFFICIAL='true'
$env:NODE_ENV='development'
$env:ADMIN_API_KEY='local-secret'
npm run dev
```

- The server enforces `robots.txt` for homedepot domains using `server/src/utils/robotsChecker.ts`. Disallowed paths will be skipped and logged.
- Admin debug endpoints (protected by `ADMIN_API_KEY`) are available:
	- `GET /api/admin/robots` — returns parsed robots rules.
	- `GET /api/admin/robots/check?url=...` — returns `{ url, allowed }`.
	- Pass the key via header `x-admin-api-key: your-secret` or `?api_key=your-secret` for quick testing.

Quarantine policy
-----------------

- Keep `unofficial` logic quarantined in development and, when possible, in an `experimental/` branch or folder not included in production builds.
- Prefer partner `live` APIs; replace scraper logic with an official adapter once partner access is available.
- Only remove scraping code permanently if legal counsel or the partner requires it; otherwise preserve it behind feature gates for auditing and partner onboarding.

Further reading
---------------

- See `docs/HOMEDEPOT_ADAPTER_COMPLIANCE.md` for a detailed checklist and remediation steps.

### GitHub Actions (CI) snippet

Add your `REDIS_URL` to the repository secrets (Settings → Secrets) and reference it in workflows. Example `.github/workflows/ci.yml` snippet:

```yaml
name: CI
on: [push, pull_request]
jobs:
	test:
		runs-on: ubuntu-latest
		env:
			REDIS_URL: ${{ secrets.REDIS_URL }}
		steps:
			- uses: actions/checkout@v4
			- uses: actions/setup-node@v4
				with:
					node-version: '20'
			- run: npm ci
			- run: npm test
```

### Local git hooks

To avoid accidental commits that enable unofficial scrapers, this repo includes git hook scripts under `.githooks/`. To enable them locally run:

```bash
npm run setup-githooks
```

This sets `core.hooksPath` to use `.githooks` and makes the hooks executable. The hooks reject commits/pushes that introduce `HOMEDPOT_MODE=unofficial` or `ALLOW_UNOFFICIAL=true` in changed files.


This exposes `REDIS_URL` in the job environment without committing credentials. For deployments, set the same `REDIS_URL` in your hosting provider's environment settings.


## Current Priority

The next work should stay inside the building system before blueprints, supplier polish, or advanced MEP:

1. Complete framing-kernel visual accuracy: true trimmed/cut solids, roof/floor/wall collision cleanup, wall corner/intersection solver, and selectable/debuggable member joins.
2. Add roof/deck/wall/floor style depth: lean-to roofs, porch roofs, decks, guards/rails, landings, stairs, half walls, interior/exterior wall options, floor/roofing/siding choices.
3. Strengthen structural rules: full span-table packs, support/load-path checks, blocking/bracing rules, purlin/batten distinctions, footing/ledger/deck warnings.
4. Then move into blueprint sheets, supplier pricing, MEP routing, and production persistence.

## Repository Hygiene

Generated artifacts should not be part of normal feature diffs. `client/dist`, Vite cache, `node_modules`, logs, and local environment files are ignored. If a build changes hashed files under `client/dist`, restore or leave them out of the feature change unless the release process explicitly asks for committed build output.

Before handing off work, run:

```bash
npm test
cd client && npx tsc --noEmit
cd ../server && npm run build
```
