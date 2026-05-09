# Competitive And Industry Standards Audit

Date: 2026-05-08

This audit grades Contractor Hub as a high-fidelity construction planning and logistics tool. It compares the current app to professional BIM/CAD tools, residential design tools, homeowner/hobbyist planners, estimator/takeoff workflows, and U.S. residential construction standards.

## Research Baseline

Primary references used for this audit:

- Autodesk Revit documentation: schedules, quantities, and material takeoffs are model views used to quantify project components and materials. Source: https://help.autodesk.com/cloudhelp/2025/ENU/Revit-DocumentPresent/files/GUID-F50D6FF4-859E-43A2-A2F6-81C84A1BA0EB.htm
- buildingSMART IFC: IFC is the open international standard for BIM data, and IFC material resources distinguish layers, profiles, and constituent material sets. Sources: https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/ and https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/ifcmaterialresource/content.html
- ICC IRC: the IRC is widely used/adopted for residential construction, but jurisdictions can amend model codes. Source: https://www.iccsafe.org/products-and-services/i-codes/2018-i-codes/irc/
- AWC span-table guidance: wood member sizing must be span/species/grade/loading/spacing aware. Source: https://awc.org/codes-and-standards/span-tables/
- Chief Architect: residential design competitors advertise automatic roofs, framing, dimensions, construction documents, schedules, and materials lists. Sources: https://www.chiefarchitect.com/ and https://www.chiefarchitect.com/products/features/
- SketchUp LayOut: competitor workflow links 3D models to updated 2D documents, dimensions, labels, and presentation sheets. Source: https://www.sketchup.com/en/products/layout
- SketchUp construction positioning: construction workflows emphasize clash detection, owner review, and material coordination. Source: https://www.sketchup.com/en/industries/construction
- DOE REScheck: energy compliance workflows require envelope-oriented checks. Source: https://www.energycodes.gov/rescheck

## Competitor Classes

### Professional BIM: Revit / Archicad / Vectorworks Tier

Expectation:

- Parametric elements with types, instances, families, schedules, sheets, phases, levels, worksets/layers, and exportable BIM data.
- Quantities and material takeoffs are generated from model data.
- Construction documents are linked to the model.
- Structural, MEP, architectural, and coordination workflows are supported, often with specialist plugins.

Contractor Hub today:

- Strong direction: BIM-lite document, assemblies, derived framing, rules, takeoff, 3D/2D views.
- Weakness: no true parametric family/type system, no robust drawing sheets, no durable project database, no collaboration, no IFC export, no production-grade schedules.

Grade against pro BIM: **3/10**.

Opportunity:

- We should not try to clone Revit. We should exceed it for small residential contractor workflows by being easier, more construction-specific, material-aware, code-aware, and supplier-aware.

### Residential Design Pro: Chief Architect Tier

Expectation:

- Fast residential drawing.
- Smart walls, roofs, foundations, stairs, windows/doors.
- Automatic framing and materials list.
- Renderings and construction documents.
- Residential-focused defaults.

Contractor Hub today:

- Good direction: editor shell, terrain, raised floor/deck support grids, framing members, assemblies, takeoff, inspector.
- Weakness: roof/wall/floor style catalogs are thin; automatic roof/framing is still incomplete; sheets/schedules lag far behind; UI is not yet as fluid as mature residential design tools.

Grade against residential pro design: **4/10**.

Opportunity:

- Beat this category by combining direct builder controls, actual construction logistics, supplier mapping, code/rule provenance, and granular takeoff.

### SketchUp / LayOut / Hobbyist Modeling Tier

Expectation:

- Fast direct 3D modeling.
- Flexible shapes/components.
- Good visual communication.
- Layout/dimensions can support drawings, but construction intelligence depends on user discipline or extensions.

Contractor Hub today:

- Stronger construction model than a free-form sketcher for framing/takeoff intent.
- Weaker free-form editing, drawing polish, and general-purpose modeling flexibility.

Grade against hobbyist modeling usability: **5/10**.

Opportunity:

- Avoid becoming generic SketchUp. The winning path is guided direct manipulation with construction intelligence: draw a deck, not a rectangle; place a wall assembly, not a line; place a roof attachment, not a mesh.

### Deck / Remodel Planners

Expectation:

- Simple inputs, support layout, posts, beams, joists, decking, guards, stairs, materials list.
- Often limited customization, but easy for homeowners.

Contractor Hub today:

- Support grids and deck modes are now emerging.
- Still missing deck-specific footing/connector/guard/stair/ledger warnings, beam/joist sizing rules, and DCA6-style output.

Grade against deck/remodel planners: **4/10**.

Opportunity:

- This is a natural place to exceed expectations: terrain-supported decks and raised additions with post heights, support grids, material lists, and code-aware warnings.

### Estimator / Takeoff Tools

Expectation:

- Reliable quantities, grouping, assemblies, waste, phases, supplier pricing, alternates, and exportable purchasing lists.

Contractor Hub today:

- Framing and layer takeoff fragments exist.
- Cut/stock lengths exist.
- Mock supplier mapping exists.
- Missing purchase-unit conversion, exact fasteners/connectors, roll/bundle conversion, cut optimization, SKU alternates, price snapshots, and room/wall/phase depth.

Grade against estimator tools: **3/10**.

Opportunity:

- Because we control the physical model, we can eventually produce better residential material logistics than a generic takeoff workflow.

## Current App Grade By Original Vision

| Area | Grade | Notes |
|---|---:|---|
| Terrain and uneven ground | 4/10 | Slope/points/sampling/contours exist. Needs true TIN, pads, cut/fill, drainage, survey import, editable boundaries. |
| Raised floor/foundation | 6/10 | Support grids, beams, joists, blocking, posts, pier blocks exist. Needs footing sizing, bracing, connector rules, true cut/trim solids. |
| Wall framing | 5/10 | Plates, studs, openings, corner packs, backing, half-wall caps exist. Needs robust joins, wall-style catalogs, sheathing/bracing, exact intersections. |
| Roof framing | 5/10 | Gable/shed starter, rafters, ridge, purlins/battens, struts, fascia, rake, gable infill exist. Needs hip/valley/lean-to/porch/dormer/truss logic and true cut solids. |
| Assemblies/layers | 6/10 | Layer stacks and layer takeoff fragments exist. Needs richer catalogs, visual peeling, alternate materials, and assembly-stage control. |
| Direct builder UX | 5/10 | Active tools, inspector, handles, modes exist. Needs smoother placement, style-first tools, better outliner, and less form-driven friction. |
| 3D view modes | 5/10 | Framing/architectural/painted exist. Needs correct cut geometry, better layer isolation, labels, and visual debugging. |
| Code/rules | 4/10 | Starter Generic IRC/AWC-informed checks exist. Needs data-driven rule packs and jurisdiction profiles. |
| Materials/takeoff | 5/10 | Member/layer/cut/stock takeoff exists. Needs purchase units, connectors, exact grouping, supplier snapshots. |
| Supplier logistics | 2/10 | Mock Home Depot-first mapping. Needs adapter boundaries, curated catalog, price/availability snapshots. |
| Blueprints/export | 2/10 | Stubs and previews. Needs scaled sheets, schedules, sections, elevations, PDF. |
| Persistence/backend | 3/10 | API boundaries exist. Needs real storage, snapshots, migrations, auth-ready separation. |
| Testing | 5/10 | Good golden geometry test. Needs broader unit, browser, visual, export, API, rule-pack tests. |

Overall: **5/10**.

This is no longer just a visual prototype, but it is not yet a professional competitor. The building-shell model is the correct current focus.

## Professional Vs. Hobbyist Expectations

### Hobbyist User Must Be Able To

- Draw a floor/deck/wall/roof without knowing every construction term.
- Pick common presets: shed roof, gable roof, deck, porch, 2x4 interior wall, 2x6 exterior wall.
- See warnings in plain language.
- Get a rough shopping list.
- Save/load and print something understandable.

Current fit: **fair**, but placement and presets still need polish.

### Professional Contractor Must Be Able To

- Inspect every framing member and assembly layer.
- Change member sizes, spacing, materials, post layout, blocking policy, roof attachment, wall type, and finish materials.
- See exact cut length, stock length, phase, source element, and location.
- Understand what is code-checked, what is not checked, and what requires AHJ/engineer review.
- Produce credible takeoffs and planning sheets.
- Avoid hidden assumptions.

Current fit: **early**, but the architecture is now pointing at the right model.

## Industry Standard Alignment

### BIM Data

IFC establishes that BIM data should support elements, material layers, material profiles, and machine-readable exchange. Contractor Hub now aligns conceptually through:

- `ProjectDocument`.
- `AssemblyLayer`.
- `MaterialProfile`.
- `StructuralMemberSpec`.
- `EnvelopeSurface`.
- `LayerTakeoffFragment`.

Gap:

- No formal IFC export/import.
- No stable GUID/version/migration story.
- No full type/instance/family classification system.

### Model-Derived Quantities

Revit and other professional BIM tools treat schedules and material takeoffs as model views. Contractor Hub aligns through derived takeoff from members and layers.

Gap:

- Quantities are not yet deep enough for real procurement.
- Connectors, fasteners, trim, waste, packaging, alternates, and supplier availability are incomplete.

### U.S. Residential Code

The IRC is a broad model code, commonly adopted with amendments. Contractor Hub currently treats Generic IRC/AWC as a planning baseline.

Correct stance:

- Pass/fail only for encoded prescriptive checks.
- `requiresEngineer` for outside prescriptive limits.
- `requiresAHJ` for local/code-official decisions.
- Rule results must cite rule pack, edition/profile, and source.

Gap:

- State/local amendments are not implemented.
- Full span tables, egress, stairs, guards, energy, electrical, plumbing, mechanical, and deck rules are incomplete.

## Next Actionable Plan

### Step 7C: Trimmed Solids And Construction Styles

Priority: highest.

Build true joined/cut framing solids and style catalogs before blueprints/supplier polish.

Done when:

- Rafters seat correctly and do not visually pass through ridge/fascia/rake members.
- Floor beams, joists, blocking, posts, and pier blocks visibly bear correctly.
- Wall plates, studs, headers, trimmers, corner packs, and intersections display as coherent framing.
- Gable, shed/lean-to, porch/deck roof, and low-slope modes have distinct logic.
- Decks, stairs, landings, guards, half walls, posts/columns, and beams are usable primitives.

### Step 7D: Code-Aware Structural Rule Packs

Build data-driven rule packs after the geometry is trustworthy.

Done when:

- Joist/rafter/header/beam warnings come from table data.
- Deck/ledger/guard/stair warnings exist.
- Purlin/batten/sheathing rules react to roofing material.
- Rule results highlight exact element/member and cite source/profile.

### Step 8: Takeoff And Supplier Logistics

Move here only after building-shell geometry is stable.

Done when:

- BOM is organized by subsystem, phase, room/wall/roof plane/source element.
- Cut length and stock length generate buy lists.
- Connectors/fasteners are included.
- Supplier mapping is separate from design quantities.
- Home Depot-first mock/curated catalog supports alternatives and snapshots.

### Step 9: Blueprint/PDF

Move here after geometry/rules/takeoff are credible.

Done when:

- Scaled sheets render from the model.
- Dimensions/schedules reference real elements.
- Framing, foundation, roof, electrical, plumbing, and material sheets are exportable.

### Step 10: Production Hardening

Done when:

- Project persistence, snapshots, migrations, rule-pack versions, auth boundaries, audit logs, API contracts, and large-model performance are reliable.

## Hard Product Standard

Contractor Hub should exceed expectations by combining what competitors usually split apart:

- Residential-focused ease like Chief Architect.
- Model-derived schedules like pro BIM.
- Direct manipulation like SketchUp-style tools.
- Deck/remodel specificity like specialized planners.
- Takeoff and supplier logistics like estimator software.
- Code-aware transparency for real-world planning.

The path is not to maintain legacy prototype behavior. The path is to keep remaking the app around physical construction truth until every view, warning, and material row is traceable to the same model.
