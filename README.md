# Contractor Hub vNext

Contractor Hub is being rebuilt as an agent-native physical-world studio.

The durable product direction lives in [PRODUCT.md](./PRODUCT.md). The current implementation architecture lives in [ARCHITECTURE.md](./ARCHITECTURE.md).

This branch is a generation reset. The previous BIM-lite prototype is preserved at `archive/prototype-v0` and remains available as donor evidence for construction geometry, assemblies, takeoff, terrain, rules, and UX lessons.

## Current slice

The first vNext slice proves the new ownership model:

- one server-owned, file-persisted World;
- typed entities, primitive geometry, hierarchy, properties, ports, relations, and provenance;
- atomic revision-checked transactions with durable local history;
- a first derived Build Graph for required parts and materials;
- a minimal browser Studio;
- an MCP endpoint with world, history, and Build Graph tools;
- browser and MCP using the same World store and mutation contracts.

The UI is intentionally small. Current implementation depth must not be mistaken for product scope.

## Run

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Studio: http://127.0.0.1:5173

API / MCP server: http://127.0.0.1:3000

MCP endpoint: http://127.0.0.1:3000/mcp

## Verify

```bash
npm run verify
```

This runs kernel tests, TypeScript checking, and the Studio production build.

## Repository shape

```text
apps/
  server/     shared REST + MCP command surface
  studio/     deliberately small human creation surface
packages/
  world/      canonical world types, operations, persistence, and store
  build/      derived Build Graph requirements
```

The architecture is expected to change rapidly while Product Truth remains stable.
