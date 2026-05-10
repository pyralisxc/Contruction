# Operation Stack & Push/Pull Prototype — Design Notes

Goal
- Provide a lightweight, serializable operation stack that enables SketchUp-like push/pull edits while preserving the existing authoritative derive pipeline.

Summary
- Keep `deriveProject(project)` as the single source of truth for derived geometry and rule evaluation.
- Operations are compact, idempotent instructions that modify the `ProjectDocument` (not bypass the derive pipeline).
- Record operations for undo/redo, persistence, replay, and collaboration.

Trade-offs
- Operation-first (CRDT/OT style) vs ProjectDocument-first (current):
  - Op-first makes collaborative sync and fine-grained history trivial, but requires robust replay/reconciliation and defensive schema evolution.
  - ProjectDocument-first (recommended here) keeps the proven derive pipeline unchanged and treats ops as an editable audit/log that mutate the document.

Recommendation
- Implement ops as commands that produce deterministic edits to `ProjectDocument` and then call `deriveProject`.
- Enforce idempotent ops (include op id + deterministic params). Avoid storing ephemeral geometry in ops.
- Provide three layers:
  1. Recording & persistence: append-only op log (localStorage first, server later).
  2. Replay & rebuild: clear-to-baseline replay that re-applies ops to a canonical baseline project.
  3. Incremental apply: for UX, apply ops immediately to the live `project`, but mark `isReplayingOperations` during full replay to avoid double-recording.

Immediate deliverables (prototype)
- Compact op types for create/mutate/remove common elements (floor, wall, roof, opening, pipe, duct).
- `pushOperation(op)` and `replayOperations()` implemented in the store (prototype present).
- Push/Pull canvas: rectangle drag → create/extrude floor (prototype present). Next: face selection + directional extrusion.
- Operation Stack UI: list + replay button.

Next engineering steps
1. Persist ops to `localStorage` and add export/import. Add simple undo/redo via inverse ops or snapshotting.
2. Define op schema v1 and upgrade strategy (versioned ops + migration helpers).
3. Implement push/pull face selection, with selection metadata (elementId + face index) and parametric extrusion amount.
4. Add tests: op replay determinism and idempotency checks across sample projects.

Risks & mitigations
- Replay divergence: mitigate with strict seeding (baseline sample), op validation, and snapshot checkpoints.
- Geometry precision/ordering: store clean input primitives (points, pitch values) and run deterministic normalization before applying ops.

Acceptance criteria
- Operations are serializable and replayable to reproduce the same `ProjectDocument` from a canonical baseline.
- Push/Pull supports face-extrude on a floor or wall with undo/redo.
- Rule engine still runs on derived output with no bypass.

Authored: prototype phase — keep this doc small and actionable.
