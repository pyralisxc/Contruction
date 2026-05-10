# Parametric Families — Developer Guide

Location
- Parametric family definitions live at `client/src/bim/families.ts` and can be expanded into `client/src/bim/families/*.ts` files.

Definition shape
- A family exports a `FamilyDefinition<P>` with:
  - `id`: stable string id for the family
  - `displayName`: UI-friendly name
  - `defaultParams`: a small map of default parameters
  - `instantiate(params, origin, doc)`: a pure factory that returns a partial `BuildingElement`.

Usage
- The store exposes `createFamilyInstance(familyId, params, origin)` which instantiates a family and inserts the element into the current `ProjectDocument` with a generated id.

Testing
- Families are pure functions — test them by calling `instantiate()` with sample params and asserting the returned partial element contains expected geometry (polygon/path, widths, heights).

Next steps
- Add a UI to edit family parameters before placement.
- Version family schemas and add migration helpers for long-lived projects.
