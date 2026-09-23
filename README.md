# Contractor Hub vNext

Contractor Hub is being rebuilt as an agent-native physical-world studio.

The durable product direction lives in [PRODUCT.md](./PRODUCT.md). The current implementation architecture lives in [ARCHITECTURE.md](./ARCHITECTURE.md).

This branch is a generation reset. The previous BIM-lite prototype is preserved at `archive/prototype-v0` and remains available as donor evidence for construction geometry, assemblies, takeoff, terrain, rules, and UX lessons.

## Current foundation

The vNext foundation now proves:

- one server-owned, file-persisted World;
- typed entities, primitive geometry, hierarchy, properties, ports, port-aware relations, and provenance;
- atomic revision-checked transactions with runtime validation and durable local history;
- reviewable proposal -> diff -> apply/discard flows for agent changes;
- a capability registry rather than construction-specific kernel ownership;
- Construction, Water, and Energy capability packs;
- validated cross-capability connections (for example, solar distribution supplying a water-pump power port);
- a derived Build Graph with confidence, basis, assumptions, and capability provenance;
- a local-first Supply Graph with globally bounded quantity allocation;
- persistent inventory/local/fabrication/provider observations outside World truth;
- a deliberately small browser Studio;
- MCP tools for World, proposals, capabilities, Build Graph, Supply Graph, sourcing observations, and domain operations;
- browser and MCP using the same World store and semantic transaction path.

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

This runs World, persistence, proposal, Build Graph, Supply Graph, and capability-pack tests, followed by TypeScript checking and the Studio production build.

## Repository shape

```text
apps/
  server/        shared REST + MCP command surface
  studio/        deliberately small human creation surface
packages/
  world/         canonical world types, operations, persistence, proposals
  capabilities/  capability registry
  build/         derived Build Graph
  supply/        sourcing observations + local-first Supply Graph
capabilities/
  construction/  conceptual structure shell + build requirements
  water/         connected rainwater system + requirements
  energy/        solar/electrical system + cross-capability power
```

The architecture is expected to change rapidly while Product Truth remains stable.
