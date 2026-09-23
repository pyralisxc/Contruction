# Contractor Hub — Product Truth

## Purpose

Contractor Hub is an agent-native physical-world studio for creating, analyzing, sourcing, fabricating, building, operating, maintaining, and modifying real-world systems at whatever practical scale a project requires.

It begins from construction and property work because that is the founding use case, but construction is not the product boundary.

The product exists to help a person move from an idea about the physical world to a coherent, inspectable, actionable path for making that idea real.

## Product promise

Contractor Hub should feel simple enough to create with immediately and become extraordinarily deep when the user asks for detail.

A user should be able to place, draw, move, connect, route, inspect, and revise physical things without first understanding a professional software stack. The same things should progressively reveal their geometry, composition, parts, interfaces, calculations, constraints, cost, sourcing, fabrication, maintenance, and other domain-specific detail.

Current implementation depth must never be mistaken for product scope.

## Universal project world

A Contractor Hub project can represent physical work from part scale through site and facility scale.

Examples include:

- individual fasteners, fittings, brackets, replacement parts, and fabricated components;
- cabinetry, appliances, fixtures, furniture, equipment, and machines;
- rooms, structures, houses, workshops, greenhouses, commercial buildings, and skyscrapers;
- roads, grading, drainage, landscaping, gardens, farms, utilities, ponds, wells, and property systems;
- plumbing, electrical, HVAC, solar, batteries, generators, water collection, waste, irrigation, and data systems;
- conventional, owner-builder, off-grid, natural-building, experimental, and hybrid projects;
- hydroponics, workshops, production lines, compute facilities, agricultural operations, and other equipment-driven production systems.

These are not separate products. They are different compositions and depths of the same physical world.

## Core product principles

### Simple surface, extreme depth

Creation should be approachable. Complexity appears contextually and progressively rather than as a wall of modes, forms, and professional terminology.

### Progressive fidelity

Things may begin as concepts and gain resolution over time.

A refrigerator can begin as a box and later gain a manufacturer model, service clearances, electrical load, water connection, parts, maintenance, and cost.

A building can begin as a footprint and later gain assemblies, framing, systems, calculations, parts, sourcing, fabrication, and operational state.

The project does not need to change tools when it becomes more serious.

### Human and agent parity

Human UI, MCP agents, automations, and future interfaces operate the same underlying world capabilities.

A human dragging a thing and an agent moving the same thing must ultimately use the same semantic operation contracts. The UI is not a privileged owner of project truth.

Agent changes must be attributable and capable of proposal, review, application, comparison, and recovery as consequence warrants.

### Physical truth before regulatory judgment

The world model describes what a thing physically is before a rule system judges it.

Adobe, rammed earth, earthbag, composting sanitation, rainwater systems, conventional utility systems, and experimental assemblies must all be representable without pretending they are universally code-approved.

Regulatory, engineering, manufacturer, safety, and professional requirements evaluate the physical world through explicit rule or analysis capabilities.

### Explicit knowledge provenance

Important values should be able to say why they exist.

A value may be user-chosen, agent-proposed, imported, manufacturer-provided, calculated, inferred, defaulted, rule-required, or still unknown.

The product should distinguish modeled, calculated, rule-checked, assumed, unverified, and professionally reviewed information rather than collapsing them into false certainty.

### Parts are foundational

Anything the product proposes to create should increasingly be able to explain the parts, materials, interfaces, tools, and operations required to make it real.

Physical things should be decomposable when useful:

project -> system -> assembly -> component -> part -> material/stock/consumable.

Depth is progressive. A purchased appliance can remain mostly a black box while its interfaces are modeled deeply; a custom cabinet can descend to panels, hardware, stock, cut lists, and fabrication.

### From world to build

The World describes what exists or is desired.

The Build Graph describes what parts, materials, tools, dependencies, and operations are required to create or change that world.

The product should support design quantity, purchase quantity, packaging, waste, inventory, reused material, fabricated quantity, and remaining stock as distinct concepts when relevant.

### Local-first sourcing

The Supply Graph resolves Build Graph requirements into practical acquisition choices for the project location.

Potential sources include:

- owned or job-site inventory;
- reuse and salvage;
- local retail and trade suppliers;
- local specialty suppliers and material yards;
- local fabricators and machine/print shops;
- regional distributors;
- online suppliers;
- compatible substitutes;
- raw stock for self-fabrication.

Local-first does not mean local-only.

The system should eventually optimize whole work packages for cost, trips, lead time, availability, durability, locality, waste, preferred vendors, or other user priorities.

### Fabrication is a normal output

A required part may be bought, substituted, cut from stock, machined, CNC-routed, laser-cut, printed, cast, welded, salvaged, or otherwise fabricated when appropriate.

The product must distinguish safely fabricable parts from rated, safety-critical, structural, electrical, pressure, or other parts whose specification or certification cannot be casually substituted.

### The world has processes and time

Contractor Hub should eventually understand not only what exists but what happens.

Projects may contain resource flows, production processes, schedules, construction phases, operating cycles, maintenance intervals, seasonal behavior, consumption, yield, and economics.

This allows the same world to support a greenhouse, workshop, crypto/compute facility, farm, factory, building, or hybrid property.

### Design through operation is one lifecycle

A project should be able to progress without losing identity:

concept -> design -> analysis -> specification -> sourcing -> fabrication -> construction -> as-built -> operation -> maintenance -> modification -> decommission/reuse.

## World domains

The product is expected to grow deeply into domains including, but not limited to:

- site, terrain, grading, hydrology, and landscape;
- structures and building envelopes;
- interiors, cabinetry, fixtures, appliances, and furnishings;
- plumbing, water, drainage, sanitation, irrigation, and waste;
- electrical, controls, data, solar, storage, generation, and energy;
- HVAC, ventilation, thermal systems, and passive systems;
- agriculture, hydroponics, greenhouse systems, and production environments;
- equipment layouts, workshops, manufacturing, compute, and facility systems;
- materials, inventory, estimating, procurement, logistics, and sourcing;
- fabrication and machine-oriented deliverables;
- operations, sensors, maintenance, repair, and replacement.

The product can add specialized domain intelligence without changing the identity of the underlying world.

## Analysis and external expertise

Contractor Hub owns the project world, identity, operations, provenance, parts relationships, Build Graph, Supply Graph, and user/agent interaction semantics.

It does not need to reinvent every specialist solver.

Structural analysis, energy simulation, hydrology, fluid systems, manufacturing simulation, crop models, financial models, solar analysis, CNC toolpaths, and other specialist computation may be implemented internally or delegated to appropriate external engines.

External analysis never silently becomes project truth. Results retain source, assumptions, version, and confidence.

## Deliverables

Blueprints and drawings are one output family, not the final definition of the product.

Projects may eventually produce:

- construction documents and schedules;
- estimates and work packages;
- bills of materials and procurement plans;
- supplier/fabricator packages;
- IFC and other building-data exchanges;
- web, AR, scene, and digital-twin representations;
- 3D-print and fabrication geometry;
- CNC or machine-oriented outputs;
- operational and maintenance information.

## Professional and legal boundary

Contractor Hub may assist with serious real-world work, but software-generated confidence must not impersonate jurisdictional approval, professional licensure, certification, manufacturer approval, or engineered judgment.

The product should make the boundary visible:

- modeled;
- calculated;
- rule-checked;
- assumed;
- unresolved/unverified;
- professional or authority review required;
- professionally reviewed when that status has actually been established.

Local laws, adopted codes, amendments, licensed-practice requirements, copyrighted standards, manufacturer data, and provider terms must be treated as versioned external authority rather than baked into the core as timeless truth.

## Product invariants

These truths should survive implementation generations:

1. One coherent physical world is the project authority.
2. Human and agent creation share the same semantic capabilities.
3. Current implementation depth never defines product scope.
4. Physical representation is independent from regulatory approval.
5. Important derived knowledge retains provenance and assumptions.
6. Parts, composition, interfaces, and connections are first-class.
7. Design can flow into Build Graph and local-first Supply Graph.
8. Specialized intelligence can deepen the world without fragmenting it into separate applications.
9. Fast iteration is expected; weak implementations should be replaced rather than protected for historical reasons.
10. Product direction is durable. Architecture is evolutionary. Implementation is disposable.

This document changes when the accepted product direction changes. It is not a roadmap, status report, or implementation plan.
