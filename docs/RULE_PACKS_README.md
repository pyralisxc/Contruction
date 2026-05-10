# Rule Packs — Developer Guide

Location
- Rule packs live under `client/src/bim/rulePacks/`. Each pack exports a simple object with `id`, `title`, and a `validate(project, derived)` function that returns `RuleResult[]`.

Adding a pack
1. Create a new file in `client/src/bim/rulePacks/`, e.g. `myPack.ts`.
2. Import any helpers from `../geometry` or `../types` as needed.
3. Export a default object that implements `validate(project, derived)`.
4. The pack registry at `client/src/bim/rulePacks/index.ts` will automatically include packs exported there.

Runtime
- The main `validateProject(project, derived)` function (in `client/src/bim/rules.ts`) will invoke registered packs after core checks. Packs are executed non-blocking and their errors are swallowed to avoid breaking the validation pipeline in prototype.

Best practices
- Keep packs focused and fast: prefer element-scoped checks for synchronous feedback and push heavy, model-scoped checks to a debounced background evaluation.
- Return deterministic `RuleResult` objects to make results stable between replay and CI tests.

Testing
- Add a small unit test that imports `deriveProject()` and the pack, then asserts the expected `RuleResult` IDs show up for a designed sample project.
