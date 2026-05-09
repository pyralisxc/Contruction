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
npm test -- --runInBand
```

`npm run build` type-checks and builds the client, then type-checks the server.

`npm test -- --runInBand` runs the current geometry golden test. That test checks terrain sampling, derived framing renderables, pier blocks, roof planes, gable-end framing, opening cripples, dimensional lumber profiles, support grids, ledger decks, wall plates/corner packs, structural purlin struts, unresolved framing conditions, and pier block terrain seating.

## Using The App

Open `http://localhost:5173/`.

Primary modes:

- Site: terrain type, base elevation, slope, and height points.
- Structure: raised floors, decks, half walls, stairs, walls, joists, beams, blocking, posts, piers, and framing.
- Openings: doors/windows hosted by walls.
- Roof: roof footprint, pitch, eave/rake overhang, attachment mode, purlin mode, rafters, gable framing, shed/lean-to starter behavior, and roof planes.
- Electrical: panels, circuits, outlets, switches, lights, and starter device placement.
- Plumbing: fixtures, supply/drain/vent starter paths.
- HVAC: starter duct paths and future mini-split/ventilation workflows.
- Materials: takeoff totals and supplier matches.
- Code: current rule warnings and quick fixes.
- Blueprints: current sheet/export preview.

Current editor areas:

- Left mode rail for major workflows.
- Left tool panel for mode tools, project browser, layers, and code/material summaries.
- Center 2D plan canvas with placement tools, handles, dimensions, warnings, pan/zoom, and snapping.
- Optional lower 3D/diagram panel with framing, architectural, and painted display modes.
- Right inspector with placement, dimensions, assembly, derived, materials, and code tabs.

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

## Development Notes

- `ProjectDocument` is the saved source of truth.
- Derived framing, terrain contours, roof planes, pier blocks, rules, and takeoff rows are regenerated from the project document.
- Documentation intentionally does not claim contractor-grade approval yet.
- Step 6 assembly/orientation work and the first Step 7B framing-kernel pass are implemented.
- The next major technical step is Step 7C: trimmed solids, construction style catalogs, and building accessories.
- Competitive/product benchmarking is tracked in `COMPETITIVE_STANDARDS_AUDIT.md`.
