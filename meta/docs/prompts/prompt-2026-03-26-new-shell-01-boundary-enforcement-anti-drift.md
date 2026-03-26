# NEW-SHELL-01 — Boundary Enforcement Anti-Drift

## Goal

Register and then implement one bounded anti-drift enforcement slice that turns already-decided boundary truth into checked-in tests/scripts/docs locks. This item protects the boundary between root ecosystem/workbench vs a future leaf shell, `packages/shared` vs provider-owned authority, and `packages/orchestrator` vs provider UX/app-shell layers.

This lane is governance-first and enforcement-only. It does not create a shell package, gateway, frontend, or any new runtime/product surface.

## Required Reads

1. `AGENTS.md`
2. `meta/REDESIGN_PLAN.md`
3. `meta/remediation_tracker_v1.json`
4. `.serena/memories/architecture-decisions.md`
5. `meta/docs/2026-03-09-root-ecosystem-boundary-adr.md`
6. `/Users/fkg/.autoresearch-lab-dev/SOTA-preflight/2026-03-25/deerflow/deerflow-source-teardown.md`
7. `/Users/fkg/.autoresearch-lab-dev/SOTA-preflight/2026-03-25/deerflow/deerflow-vs-autoresearch-lab.md`
8. `/Users/fkg/.autoresearch-lab-dev/SOTA-preflight/2026-03-25/deerflow/product-advice.md`
9. `/Users/fkg/.autoresearch-lab-dev/SOTA-preflight/2026-03-25/deerflow/implementation-draft.md`
10. `packages/orchestrator/src/orch-tools/index.ts`
11. `packages/hep-mcp/src/tools/dispatcher.ts`
12. `packages/hep-mcp/src/tools/registry/projectExtensions.ts`
13. `packages/shared/src/tool-names.ts`
14. `packages/hep-mcp/tests/contracts/runArtifactUriAuthority.test.ts`
15. `packages/hep-mcp/tests/contracts/sharedOrchestratorPackageExports.test.ts`
16. `packages/idea-engine/tests/authority-seam.test.ts`
17. `scripts/check-orchestrator-package-freshness.mjs`

## GitNexus Gates

1. Before edits, read `gitnexus://repo/autoresearch-lab/context`.
2. If the worktree is dirty, run `npx gitnexus analyze --force`; otherwise run at least `npx gitnexus analyze`.
3. Before formal review, rerun `npx gitnexus analyze --force` if the enforcement slice adds or renames tests/scripts/docs locks or changes adjacent authority wording, then collect `detect_changes` evidence for the touched front-door and host-path surfaces.

## Source-Grounded Registration Truth

- The root ADR already states that root remains the ecosystem/workbench/governance surface and that any packaged end-user agent must arrive later as a leaf package after `P5A` closure.
- `.serena/memories/architecture-decisions.md` already locks the shared/provider boundary, the orchestrator package boundary, and the rule that host adapters consume shared/orchestrator exports instead of re-defining generic authority.
- `NEW-RT-04` already established the live `shared -> orchestrator -> hep-mcp` host-consumption path and the repo-local anti-drift precedent of `sharedOrchestratorPackageExports.test.ts` plus `scripts/check-orchestrator-package-freshness.mjs`.
- `EVO-13` is already closed as team-local runtime unification. `NEW-SHELL-01` only builds on that closed boundary fact and must not reopen `EVO-13`.
- DeerFlow's highest-value lesson here is not a replacement architecture. It is the shell-boundary anti-drift pattern: the harness/app split is real because code organization and tests keep it real.

## Disposition

- DeerFlow harness/app boundary anti-drift pattern: `borrow`
- DeerFlow gateway/frontend/workspace shell: `adapt later`
- DeerFlow deferred tool discovery and thin pre-tool authorization seam: later adaptation candidates, not part of this item
- DeerFlow memory system, prompt-first orchestration, generic subagent prose contract, and `.skill` installer model: not authority for this item

## Implementation Slice

This item is exactly one bounded enforcement slice:

- add continuously enforced anti-drift checks for root ecosystem/workbench vs future leaf shell truth
- add continuously enforced anti-drift checks for `packages/shared` import authority vs provider-owned authority
- add continuously enforced anti-drift checks for `packages/orchestrator` import authority vs provider UX/app-shell layers
- extend or add a host-consumption contract proving hosts still consume shared/orchestrator exports instead of re-defining generic authority
- update front-door docs only if the new gates expose wording that contradicts the already-decided boundary truth

This item must remain test/script/doc-only unless a pre-existing contradiction is exposed and the smallest direct fix is clearly lower risk than deferring it.

## Owned Files / Surfaces

- root/scripts test-only anti-drift checker for front-door boundary truth
- `packages/shared` test-only import-boundary gate for provider-owned authority
- `packages/orchestrator` test-only import-boundary gate for provider UX / app-shell authority
- `packages/hep-mcp/tests/contracts/sharedOrchestratorPackageExports.test.ts` extension or an adjacent host-consumption contract proof
- front-door docs only if current wording fails the new gate

## Explicit No-Go

- no new `packages/*shell*`, `gateway`, or `frontend` package
- no shell package placeholder
- no deferred tool discovery implementation
- no workspace virtualization implementation
- no operator gateway implementation
- no frontend sprint
- no orchestrator or provider runtime-semantics redesign
- no scheduler, fleet, or project-state redesign
- no re-baseline of root/shared/orchestrator authority itself
- no reopen of `NEW-LOOP-01`
- no reopen of `EVO-13` or `EVO-14`
- no substitution for `NEW-VER-01`
- no second authority path for shell/app-layer truth

## Future Acceptance

- `git diff --check`
- boundary anti-drift checker command passes
- targeted `@autoresearch/shared` boundary test passes
- targeted `@autoresearch/orchestrator` boundary test passes
- `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/sharedOrchestratorPackageExports.test.ts`
- `node scripts/check-orchestrator-package-freshness.mjs`
- `pnpm --filter @autoresearch/orchestrator build`
- `pnpm --filter @autoresearch/hep-mcp build`

## Review Focus

- confirm the slice stays test/script/doc-only
- confirm any `packages/**/src/**` runtime mutation is absent, or if present, only fixes a contradiction directly exposed by the new gate
- confirm root still reads as ecosystem/workbench rather than product shell
- confirm `packages/shared` still stops at provider-neutral contract authority
- confirm `packages/orchestrator` still stops at runtime/control-plane authority rather than shell/app/UX authority
- confirm host adapters still consume shared/orchestrator exports instead of redefining generic authority
- confirm the packet assumption is still true: current boundary truth already exists, and the missing gap is anti-drift enforcement rather than another boundary rewrite

## Governance Sync Requirements

If this item changes tracked scope or status truth, sync all relevant SSOT surfaces rather than only one:

- the Phase 5 `P5A` membership list in `meta/REDESIGN_PLAN.md`
- the standalone `NEW-SHELL-01` section plus Phase 5 acceptance/totals note in `meta/REDESIGN_PLAN.md`
- the tracker top-level note plus the `NEW-SHELL-01` item entry in `meta/remediation_tracker_v1.json`
- `AGENTS.md` current-progress summary only if Phase 5 counts or the global blocker summary actually change

## Default Escalation Rule

If the new gates expose a real contradiction in runtime source or front-door docs:

- fix it only when the contradiction is directly related, low-risk, and independently verifiable
- otherwise stop and register a separate cleanup slice with a checked-in prompt/tracker note

Do not silently widen `NEW-SHELL-01` into a shell/productization lane.

## Closeout Requirements

1. Formal three-reviewer review: `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(zhipuai-coding-plan/glm-5)`
2. Formal self-review after reviewer convergence
3. Sync `meta/remediation_tracker_v1.json`, `meta/REDESIGN_PLAN.md`, and `.serena/memories/architecture-decisions.md` to the final boundary-enforcement facts
4. Update `AGENTS.md` current-progress summary only if phase counts or blocker summary change
