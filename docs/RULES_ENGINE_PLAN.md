# Rules Engine — Design Notes

Goal
- Make rule validation modular, fast, and incrementally evaluable so the editor can surface code/engineering feedback without full-model rework.

Summary
- Rules should be delivered as small, focused rule packs (files) that export:
  - metadata (id, title, severity, tags),
  - a validator function `(project, derived) => RuleResult[]`, and
  - optional incremental hooks for element-level updates.

Design highlights
- Author rule packs in `client/src/bim/rulePacks/*.ts` and load them via a simple registry.
- Runtime: evaluate lightweight rules on changes; run expensive cross-element checks in a debounced background task.
- Keep `deriveProject` authoritative — rules consume derived output (planes, framing, takeoff) rather than raw elements where possible.

Performance & UX
- Provide two evaluation tiers:
  1. Fast: element-scoped checks run synchronously on edit (e.g., opening fits in wall).
  2. Heavy: model-scoped checks (span tables, clash detection) run off-main-thread or debounced.

Developer ergonomics
- Rule pack template and test harness alongside each rule file.
- CI: run a rule-pack smoke test against `sampleProject.ts` to detect regressions.

Next steps
1. Add `client/src/bim/rulePacks/index.ts` that exports registered packs.
2. Refactor `rules.ts` to import packs and run them in the two-tier engine.
3. Add example pack and unit tests.
