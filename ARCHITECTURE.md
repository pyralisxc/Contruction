# Contractor Hub vNext Architecture

This document describes the current architecture chosen to move toward [PRODUCT.md](./PRODUCT.md).

Product Truth is the durable authority. This architecture is intentionally evolutionary and should change whenever a stronger implementation better serves the product without changing its accepted meaning.

## 1. Current generation objective

The vNext generation begins by proving a small universal world instead of rebuilding the previous feature surface.

The first architecture must make these things ordinary:

- stable physical entity identity;
- hierarchy/composition;
- geometry references;
- ports and relationships;
- explicit properties and provenance;
- atomic semantic operations with revision checks;
- one mutation path for human UI and MCP;
- capability seams for future domain intelligence;
- derived Build and Supply graphs without making them the canonical world.

The first UI should remain deliberately small while these contracts become trustworthy.

## 2. Authority

There is one canonical World state for a project revision.

UI state, rendered meshes, analysis results, code checks, takeoffs, Build Graphs, Supply Graphs, indexes, caches, and external-provider observations are derived representations or observations. They do not become competing project authorities.

The World stores accepted project state. Operations change it.

## 3. Kernel concepts

### World

A revisioned project container.

### Entity

A stable identified thing in the world. Domain capabilities may attach richer typed meaning to entities, but the core does not require a closed union of every possible physical object.

### Geometry

Spatial representation associated with an entity. The kernel currently starts with simple primitives and a neutral geometry boundary. It must not assume the rendering engine is the future authoritative CAD kernel.

### Composition

Entities may contain or be composed from other entities. Parts are ordinary first-class entities rather than text-only BOM rows.

### Port / interface

A typed connection opportunity: electrical, fluid, mechanical, structural, data, spatial, or future domain-defined interface.

### Relation

A typed relationship between entities. Examples include contains, supports, mounts, connects, supplies, depends-on, hosts, or domain-defined relations.

### Property

A value attached to an entity or relation with the expectation that important values can later retain provenance, confidence, units, and richer schemas.

### Provenance

Who or what introduced accepted state: user, agent, import, derived process, system default, or future professional/provider sources.

## 4. Operations

All accepted mutations pass through semantic transactions.

A transaction has:

- stable ID;
- base revision;
- actor;
- timestamp;
- one or more mutations.

The transaction is atomic. If any mutation is invalid, none of it is applied.

Revision mismatch fails closed rather than silently overwriting newer work.

The initial mutation vocabulary is intentionally small:

- create entity;
- update identity/name/kind;
- move or resize primitive geometry;
- set/remove property;
- add/remove relation;
- remove entity.

Domain capabilities should add semantic operations rather than teaching UI components to bypass this layer.

## 5. Human / MCP parity

The browser and MCP server act against the same server-owned World store and operation contracts.

The UI is a representation and command surface.

MCP is a representation and command surface.

Neither owns project state.

High-consequence agent workflows should grow toward proposal -> diff/preview -> apply -> revert semantics, but small explicit transactions may apply directly when authorized.

## 6. Capability packs

The kernel stays small. Domain intelligence belongs behind capability boundaries.

Examples:

- construction;
- structural;
- electrical;
- water/plumbing;
- energy/solar;
- landscape/hydrology;
- agriculture;
- production/equipment;
- fabrication;
- code/rules;
- estimating/sourcing.

A capability can contribute:

- entity schemas or traits;
- semantic operations;
- validators;
- derived representations;
- analysis;
- exporters/importers;
- Build Graph derivation;
- Supply Graph logic.

Capabilities may begin inside this repository. They earn separate repositories or runtimes only when independent reuse, complexity, licensing, runtime, or ownership justifies it.

## 7. Derived graphs

### Build Graph

Derived requirements needed to create or change accepted World state: assemblies, parts, materials, tools, operations, sequencing, and quantities.

### Supply Graph

Resolution of Build Graph requirements against inventory, salvage, local suppliers, fabricators, regional/online providers, substitutes, and self-fabrication.

These graphs may become persistent snapshots for audit or planning, but they are not alternate copies of the World.

## 8. Geometry boundary

vNext starts with a minimal geometry vocabulary sufficient to exercise world operations and spatial UI.

The architecture must leave room for:

- curves and paths;
- profiles;
- surfaces;
- solids and booleans;
- meshes;
- coordinate systems;
- spatial indexes;
- large-world partitioning;
- fabrication tolerances.

Rendering geometry and authoritative geometric computation are separable.

If a mature external or native geometry kernel becomes appropriate, it should be adoptable without replacing entity identity, operations, or Product Truth.

## 9. Persistence and history

The target posture is:

current canonical snapshot + revision identity + durable operation/checkpoint history.

The world must not require replaying an eternal event stream for ordinary reads.

The initial vNext slice uses a server-owned in-memory world deliberately. Durable project format and persistence are the next infrastructure layer once the operation contract has been exercised.

## 10. External solvers and providers

Specialist engines may calculate against exported projections of the world.

Results return with source, version, assumptions, inputs, and confidence where material.

Retailer inventory, prices, standards, code text, manufacturer catalogs, and similar external data are provider observations, not timeless kernel data.

## 11. Current executable slice

The first vNext slice intentionally contains:

- typed World model;
- atomic revisioned transactions;
- in-memory server store;
- REST transaction surface for the browser;
- MCP tools backed by the same store and transaction logic;
- minimal React studio;
- simple 2D primitive visualization;
- selection and inspection;
- creation/movement through transactions;
- hierarchy sufficient to represent parts.

It intentionally does not yet restore:

- legacy BIM types;
- Three.js;
- old framing engine;
- supplier integrations;
- code packs;
- blueprint UI;
- legacy server persistence;
- the previous mode-heavy editor shell.

Those are donor knowledge in the preserved prototype and can be reintroduced only through vNext contracts.

## 12. Development law

Contractor Hub uses rapid vertical iteration.

Do not wait for the final ontology or final geometry engine before delivering useful slices.

Each slice should teach the architecture through real use:

Product Truth -> current Architecture -> vertical implementation -> evidence -> architecture adjustment.

Preserve learned physical/domain behavior. Replace weak representations freely.
