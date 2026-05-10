# Contractor Hub Setup Guide

## Prerequisites

| Tool | Minimum Version | Check |
|---|---:|---|
| Node.js | 18.x | `node -v` |
| npm | 9.x | `npm -v` |
| Git | optional | `git --version` |

Use the Node.js LTS release when possible.

## Install Dependencies

The workspace has root, client, and server package files. From the project root:

```bash
npm install

cd client
npm install
cd ..

cd server
npm install
cd ..
```

## Run In Development

From the project root, the simplest command is:

```bash
npm run dev
```

That starts the client and server together.

You can also use two terminals.

Terminal 1, frontend:

```bash
cd client
npm run dev
```

The app opens at `http://localhost:5173/`.

Terminal 2, API:

```bash
cd server
npm run dev
```

The API defaults to `http://localhost:3000/`.

## Build And Test

From the project root:

```bash
npm run build
npm test
```

`npm run build` type-checks and builds the client, then type-checks the server.

`npm test` runs the current geometry golden test. That test checks terrain sampling, derived framing renderables, wall solids, pier blocks, roof planes, gable-end framing, opening cripples, dimensional lumber profiles, support grids, ledger decks, wall plates/corner packs, structural purlin struts, unresolved framing conditions, L-shaped floor containment, reviewed floor-driven wall/roof sync previews, real-polygon load-path checks, and pier block terrain seating.

For a quicker source-only handoff check that does not regenerate `client/dist`, run:

```bash
npm test
cd client
npx tsc --noEmit
cd ../server
npm run build
cd ..
```

## Using The App

Open `http://localhost:5173/`.

Primary modes:

- Site: terrain type, base elevation, slope, and height points.
- Build: raised floors, decks, half walls, stairs, walls, openings, roofs, joists, beams, blocking, posts, piers, framing, polygon footprint editing, attached additions, room generation, and reviewed footprint updates.
- Systems: electrical, plumbing, HVAC, starter device/fixture placement, routed paths, circuits, ducts, and future coordination workflows.
- Materials: takeoff totals, supplier matches, store selection, and cart/share workflows.
- Code: current rule warnings and quick fixes.
- Blueprints: current sheet/export preview.

Current editor areas:

- Studio command bar with project selector, file/export commands, persistent Store/Cart, workspace modes, and future-suite stub actions.
- Left mode rail for consolidated major workflows.
- Left tool panel for mode tools, project browser, layers, review-update actions, and code/material summaries.
- Center workspace with real `2D Plan`, `3D Framing`, `Split`, `Sheets`, `Materials`, and `Code` modes.
- 2D plan canvas with placement tools, handles, dimensions, warnings, pan/zoom, and snapping.
- 3D/diagram viewport with framing, architectural, and painted display modes.
- Single right inspector with Properties, Assembly, Derived, Materials, and Code tabs.
- Site Intelligence panel for early elevation, weather grid, climate zone, and keyed provider-readiness lookup.
- Adaptive panel controls collapse tools and inspector into drawers or bottom sheets in partial-width windows.

Responsive layout expectations:

- `>= 1360px`: mode rail, tools, canvas/3D, and inspector can all remain visible.
- `1100-1359px`: inspector is available as a right drawer.
- `760-1099px`: tools and inspector are mutually exclusive drawers, with canvas prioritized.
- `< 760px`: mode navigation moves to the top of the workspace and tools/inspector become bottom sheets.
- `2D Plan`, `3D Framing`, and `Split` must remain available at every width.
- Store and Cart must remain discoverable at every width.
- Inputs and selects should remain readable; dense tables should scroll rather than crush columns.

## Current Project Structure

```text
/
|-- client/
|   |-- src/
|   |   |-- bim/
|   |   |   |-- types.ts          # BIM-lite schema
|   |   |   |-- terrain.ts        # Terrain sampling and mesh helpers
|   |   |   |-- geometry.ts       # Framing kernel, support grids, surfaces, warnings
|   |   |   |-- rules.ts          # Starter validation rules
|   |   |   |-- takeoff.ts        # Material takeoff generation
|   |   |   |-- suppliers.ts      # Mock supplier/SKU mapping
|   |   |   `-- sampleProject.ts  # Seed project
|   |   |-- editor/
|   |   |   |-- shell/            # Top bar, mode rail, status bar
|   |   |   |-- canvas/           # 2D plan and 3D/diagram viewport
|   |   |   |-- tools/            # Mode-specific tools and layer/outliner UI
|   |   |   |-- inspector/        # Element inspector tabs
|   |   |   `-- ui/               # Shared form controls
|   |   |-- stores/
|   |   |   `-- bimProjectStore.ts
|   |   |-- App.tsx
|   |   |-- app.css
|   |   `-- main.tsx
|   `-- dist/
|-- server/
|   `-- src/
|       |-- index.ts
|       |-- routes/
|       |-- controllers/
|       |-- services/
|       `-- models/
|-- shared/
|-- tests/
|-- .gitignore
|-- README.md
|-- ARCHITECTURE_PLAN.md
|-- CONTRACTOR_GRADE_ROADMAP.md
`-- package.json
```

## Optional Environment Variables

The server can run in demo mode without environment variables. For future persistence/database work, create `server/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/construction
MONGODB_URI=mongodb://localhost:27017/construction-app
PORT=3000
CLIENT_URL=http://localhost:5173
```

Do not commit `.env`.

## Common Issues

| Problem | Fix |
|---|---|
| `npm install` fails with dependency resolution errors | Try `npm install --legacy-peer-deps` in the affected package directory. |
| Port `5173` is in use | Vite will usually choose the next port, or stop the other process. |
| Port `3000` is in use | Set `PORT=3001` in `server/.env` or stop the other process. |
| 3D viewport is blank | Confirm WebGL is enabled in the browser and check the dev console. |
| App shows stale behavior | Restart the Vite dev server and refresh `http://localhost:5173/`. |
| Git status shows generated build/cache noise | `client/dist`, Vite cache, dependency folders, logs, and `.env` files are ignored. Restore tracked build output unless you are intentionally updating release artifacts. |

## Development Notes

- `ProjectDocument` is the saved source of truth.
- Derived framing, terrain contours, roof planes, pier blocks, rules, and takeoff rows are regenerated from the project document.
- 3D floor surfaces render from actual floor polygons; load-path validation also samples actual floor polygons.
- Opening placement and resizing are constrained to the host wall segment.
- Wall solids, polygon footprint editing, attached addition previews, and reviewed floor-to-wall/roof sync are part of the active editor baseline.
- The studio UI shell is expected to protect readability in partial windows, preserve Store/Cart and 2D/3D/Split access, and must not change BIM source-of-truth contracts.
- Documentation intentionally does not claim contractor-grade approval yet.
- Step 6 assembly/orientation work, Step 7B framing-kernel foundations, wall solids, and the polygon editor workflow are implemented.
- The next major technical work is richer roof topology, true member cut faces, construction style catalogs, visual diff overlays, and building accessories.
- Competitive/product benchmarking is tracked in `COMPETITIVE_STANDARDS_AUDIT.md`.
