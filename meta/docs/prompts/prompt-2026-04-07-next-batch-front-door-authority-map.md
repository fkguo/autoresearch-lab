# Prompt: 2026-04-07 Next Batch — Front-Door Authority Map

## Why this lane exists

Current `main` already landed three exact authority seams:

- TS top-level `autoresearch` public command inventory (`packages/orchestrator/src/cli-command-inventory.ts`) and parser/help consumption (`cli-args.ts`, `cli-help.ts`)
- installable legacy `hepar` public-shell exact inventory + fail-closed assertion (`PUBLIC_SHELL_COMMANDS` + `_assert_public_shell_inventory(...)` in `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`)
- exact live `orch_*` MCP inventory doc, locked by drift tests (`meta/docs/orchestrator-mcp-tools-spec.md`, `packages/hep-mcp/tests/docs/docToolDrift.test.ts`)

What is still missing is a typed, checked-in front-door authority map/fixture that these seams can converge onto for docs/tests consumption.

This lane is **not** a request for a cross-language pseudo-unified mega table.

## Primary objective

Implement a checked-in `front_door_authority_map` fixture (name can differ, semantics cannot) that:

1. keeps each exact authority surface single-sourced
2. classifies surfaces with explicit taxonomy (`canonical_public`, `compatibility_public`, `internal_only`)
3. lets front-door docs/tests consume this typed map instead of relying on scattered wording snippets

## Hard authority boundaries

1. Do not collapse TS `autoresearch`, installable `hepar` public shell, and exact `orch_*` inventory into one fake shared runtime authority.
2. The map is a classification/consumption layer, not a new command parser authority that replaces existing single-source seams.
3. Architecture-overview docs stay family-level summary and link out to exact inventories; they must not regain hand-maintained exact subsets.
4. Residual internal full-parser commands remain explicitly classifiable as `internal_only`; this lane does not silently promote or retire them.

## Non-goals

- no reopen of `M-22A` / `M-22B` lifecycle/workflow authority decisions
- no repoint/delete of broad Python runtime logic in this lane
- no fleet/runtime/session redesign
- no cross TS/Python “single master command table” authority claim

## Source-grounded files to touch

Implementation lane should inspect and update as needed:

- `packages/orchestrator/src/cli-command-inventory.ts`
- `packages/orchestrator/src/cli-args.ts`
- `packages/orchestrator/src/cli-help.ts`
- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- `meta/docs/orchestrator-mcp-tools-spec.md`
- `docs/ARCHITECTURE.md`
- `packages/hep-mcp/tests/docs/docToolDrift.test.ts`
- `scripts/lib/front-door-boundary-authority.mjs`

Recommended additional lock surfaces for this lane:

- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `packages/hep-mcp/tests/toolContracts.test.ts`

## Recommended implementation sequence

1. Add typed authority-map fixture in a shared front-door guard location (or nearby), representing:
   - TS `autoresearch` top-level public commands
   - installable `hepar` public shell commands
   - internal-only residual command set classification (at least explicit group-level classification)
   - exact `orch_*` inventory reference boundary
2. Rewire existing front-door wording/drift checks to consume the fixture where feasible, without breaking current single-source seams.
3. Update doc/test assertions so stale hand-maintained subsets fail closed.
4. Keep `docs/ARCHITECTURE.md` at family-level summary + link-out (no exact inventory duplication).

## Acceptance (minimum)

Run at least:

- `git diff --check`
- `pnpm --filter @autoresearch/orchestrator test -- tests/autoresearch-cli.test.ts tests/package-boundary.test.ts`
- `python3 -m pytest packages/hep-autoresearch/tests/test_public_cli_surface.py -q`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts tests/toolContracts.test.ts tests/contracts/crossComponentToolSubset.test.ts`
- `node scripts/check-shell-boundary-anti-drift.mjs`

If fixture location introduces new testable contracts, add a narrow fixture contract test and include it in acceptance.

## Formal review packet widening requirements

Formal review packet for this lane must include:

1. code authority seams:
   - `packages/orchestrator/src/cli-command-inventory.ts`
   - `packages/orchestrator/src/cli-args.ts`
   - `packages/orchestrator/src/cli-help.ts`
   - `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
2. exact inventory spec + consumers:
   - `meta/docs/orchestrator-mcp-tools-spec.md`
   - `packages/hep-mcp/tests/docs/docToolDrift.test.ts`
   - `scripts/lib/front-door-boundary-authority.mjs`
3. front-door summary surface:
   - `docs/ARCHITECTURE.md`
4. adjacent command-boundary lock:
   - `packages/hep-autoresearch/tests/test_public_cli_surface.py`

Reviewers must challenge packet assumptions explicitly:

- “Did we accidentally create a second authority table?”
- “Did any overview doc regain exact subset ownership?”
- “Does the fixture classify internal-only residue explicitly without promoting it?”

## Self-review focus

Before closeout, self-review must confirm:

1. zero blocking issues on authority ownership
2. no new cross-language pseudo-authority introduced
3. exact seams are still single-source and are now consumable through the new typed map
4. `docs/ARCHITECTURE.md` remains summary-only + link-out to exact `orch_*` spec
5. public shell boundary assertions still fail closed when inventory drifts

If any residual command cannot be clearly classified (`canonical_public` / `compatibility_public` / `internal_only`), do not mark lane done.
