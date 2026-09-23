# Contractor Hub vNext Architecture

This document describes the current architecture chosen to move toward [PRODUCT.md](./PRODUCT.md).

Product Truth is the durable authority. This architecture is intentionally evolutionary and should change whenever a stronger implementation better serves the product without changing its accepted meaning.

## 1. Current generation objective

The vNext generation proves a small universal physical World instead of rebuilding the previous feature surface.

The current foundation makes these things ordinary:

- stable physical entity identity;
- hierarchy/composition;
- primitive geometry behind a neutral geometry boundary;
- explicit ports/interfaces and port-aware relationships;
- properties and provenance;
- atomic semantic operations with revision checks and runtime validation;
- one mutation path for human UI, MCP, and capability packs;
- durable proposal -> diff -> apply/discard workflows;
- capability registration for domain intelligence;
- derived Build and Supply graphs without making them competing authorities;
- local-first sourcing observations kept separate from design truth.

The UI remains deliberately small while these contracts earn depth.

## 2. Authority

There is one canonical World state for a project revision.

UI state, rendered meshes, analysis results, code checks, takeoffs, Build Graphs, Supply Graphs, source observations, pending proposals, indexes, caches, and external-provider data are projections, observations, or pending change—not alternate project authorities.

The World stores accepted project state. Semantic transactions change it.

## 3. Kernel concepts

### World

A revisioned project container.

### Entity

A stable identified thing in the world. Domain capabilities may attach richer meaning to entities without requiring the kernel to maintain a closed union of every possible physical object.

### Geometry

Spatial representation associated with an entity. The current kernel supports boxes, polylines, and planar XY polygons. The rendering representation is not assumed to be the future authoritative CAD kernel.

### Composition

Entities can contain or be composed from other entities. Parts are first-class entities rather than text-only BOM rows.

### Port / interface

A typed connection opportunity: fluid, electrical, mechanical, structural, data, spatial, or future domain-defined interface.

Ports have stable IDs within an entity. Relations may target exact source/destination ports. Invalid port references fail closed, and removing a port removes relations that would otherwise dangle.

### Relation

A typed relationship between entities and optionally their ports. Current live examples include fluid and electrical network connections across capability packs.

### Property

A primitive value attached to an entity or relation. Important domain properties may later grow richer schema/provenance owners rather than forcing every future value into this starter representation.

### Provenance

Who or what introduced accepted state: user, agent, import, derived process, system default, provider, or future professional/provider sources.

## 4. Operations and mutation integrity

All accepted mutations pass through semantic transactions.

A transaction has:

- stable ID;
- base revision;
- actor;
- timestamp;
- one or more mutations.

The transaction is atomic. If any mutation is invalid, none of it is accepted.

Revision mismatch fails closed rather than silently overwriting newer work.

The kernel runtime validates transaction shape, entity identity, primitive geometry, finite values, properties, ports, parent references, and relation endpoints. TypeScript types and MCP schemas are not treated as sufficient protection by themselves.

Current mutation vocabulary includes:

- create entity;
- rename entity;
- move/resize box geometry;
- translate any supported geometry;
- validate path/polygon point sets and reject degenerate areas;
- set/remove property;
- add/update/remove port;
- add/remove relation;
- remove entity.

Domain capabilities should expose semantic operations rather than teaching UI components to bypass this layer.

## 5. Human / MCP parity and proposals

The browser and MCP server act against the same server-owned World store and operation contracts.

The UI is a representation and command surface.

MCP is a representation and command surface.

Neither owns project state.

Low-consequence explicit actions may apply directly. Larger agent workflows can use a durable proposal flow:

proposal -> validate against base revision -> structural diff -> human/agent inspection -> apply or discard.

Previewing a proposal never mutates accepted World state. A stale proposal becomes non-applicable rather than silently rebasing itself.

## 6. Capability packs

The kernel stays small. Domain intelligence belongs behind capability boundaries.

A capability can contribute:

- semantic entity kinds;
- semantic operations;
- validators;
- derived representations;
- analysis;
- exporters/importers;
- Build Graph requirement providers;
- Supply Graph logic.

The runtime now has a capability registry. Capability packs can begin inside this repository and earn separate repositories/runtimes only when independent reuse, complexity, licensing, runtime, or ownership justifies it.

### Current capability proofs

#### Construction

Creates a conceptual shed as one atomic semantic transaction:

- parent structure;
- floor;
- four walls;
- conceptual roof.

It contributes conceptual material/part requirements with explicit basis and assumptions rather than presenting them as engineered quantities.

#### Water

Creates a connected rainwater system:

- storage tank;
- pipe run;
- pump;
- water inlet/outlet/overflow ports;
- pump electrical input;
- validated fluid relations.

It contributes conceptual equipment/material requirements with unresolved engineering/code assumptions kept explicit.

#### Energy / Electrical

Creates a connected solar microgrid:

- PV array;
- battery;
- inverter;
- distribution panel;
- DC/AC ports and relations.

It can connect its distribution output to an existing power-input port created by another capability, proving cross-capability system composition.

Construction, Water, and Energy are examples—not privileged kernel domains.

## 7. Build Graph

The Build Graph is derived from accepted World state.

It can combine:

- explicit part/material entities in the World;
- requirement providers registered by capability packs.

Requirements can carry:

- source/parent identity;
- requirement kind;
- name/specification;
- design quantity/unit;
- acquisition posture;
- confidence;
- derivation basis;
- assumptions;
- capability provenance.

Current capability-derived requirements are intentionally marked `conceptual`.

Build Graph derivation must not mutate World truth.

## 8. Supply Graph

The Supply Graph resolves Build requirements against timestamped supply observations.

Supply observations are stored separately from World truth because inventory, price, distance, lead time, and provider availability are volatile.

Current source kinds include:

- owned inventory;
- reuse/salvage;
- self-fabrication;
- local fabricator;
- local trade supplier;
- local retail;
- regional;
- online.

Resolution is local-first by default. Matching currently requires an explicit requirement link, exact normalized specification, or exact normalized name; similarity alone does not create a substitution.

The allocator:

- combines multiple sources to cover one requirement;
- tracks partial coverage and shortfall explicitly;
- maintains global remaining quantity so one observed stock pool cannot be allocated twice;
- exposes estimated allocation cost when unit price is known.

Substitution intelligence, work-package route optimization, packaging, taxes, delivery, and provider freshness policy remain later slices.

## 9. Geometry boundary

vNext geometry v0 supports boxes, polylines, and planar XY polygons. Shared geometry helpers provide bounds, anchors, polyline length, and polygon plan area. Construction floors/roofs and walls now consume polygon/path geometry, and Water routes pipe runs as polylines.

The architecture leaves room for:

- arcs/splines and richer curve topology;
- editable profiles;
- surfaces;
- solids and booleans;
- meshes;
- coordinate systems;
- spatial indexes;
- large-world partitioning;
- fabrication tolerances.

Rendering geometry and authoritative geometric computation remain separable.

If a mature external/native geometry kernel becomes appropriate, it should be adoptable without replacing entity identity, semantic operations, or Product Truth.

## 10. Persistence and history

The current proving posture is:

current canonical snapshot + revision identity + durable accepted transaction history.

The World uses a versioned local file store and atomic temporary-file replacement.

Supply observations and pending proposals have separate versioned stores.

Ordinary World reads use the current snapshot; they do not replay full history.

These JSON-backed stores are proving persistence, not the final production storage commitment.

## 11. External solvers and providers

Specialist engines may calculate against exported projections of the World.

Results return with source, version, assumptions, inputs, and confidence where material.

Retailer inventory, prices, standards, code text, manufacturer catalogs, and similar external data are provider observations, not timeless kernel data.

## 12. Current Studio

The Studio deliberately exposes only enough UI to exercise the architecture:

- create a semantic construction shed using polygon floors/roofs and path walls;
- create a connected rainwater system using routed path geometry;
- create a solar microgrid and optionally connect it to a selected electrical load port;
- create generic equipment;
- select/render/translate box, path, and polygon entities;
- inspect properties, ports, relations, provenance;
- add first-class required parts;
- inspect Build and Supply resolution;
- record owned inventory/local source observations;
- review/apply/discard pending proposals.

Current implementation depth must never be mistaken for product scope.

## 13. Preserved prototype evidence

The previous BIM-lite prototype remains at `archive/prototype-v0`.

Its construction geometry, framing, terrain, assemblies, takeoff, rules, and UX lessons are donor evidence. They should be reintroduced only through vNext contracts rather than resurrecting legacy ownership.

## 14. Development law

Contractor Hub uses rapid vertical iteration.

Do not wait for the final ontology or final geometry engine before delivering useful slices.

Each slice should teach the architecture through real use:

Product Truth -> current Architecture -> vertical implementation -> evidence -> architecture adjustment.

Preserve learned physical/domain behavior. Replace weak representations freely.
