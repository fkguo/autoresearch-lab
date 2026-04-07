# Prompt: 2026-04-08 Pipeline A Residual Support Surfaces Sequenced Lanes

## Supersedes

This prompt supersedes the execution guidance in:

- `meta/docs/prompts/prompt-2026-04-08-legacy-residue-audit.md`

Use this file as the only implementation packet for residual Pipeline A support surfaces.

## Why this lane package exists now

Current live truth is no longer the same as the earlier audit framing:

- `doctor` / `bridge` have already been removed from the internal parser residue queue.
- `literature-gap` has now been deleted from the internal parser after its executable proof moved to lower-level runner / resolver / front-door coverage.
- `internal_support_commands` is now empty.
- `method-design`, `run-card`, and `branch` are currently tracked as retired-public internal helpers.
- `method-design` and `run-card` already have direct tests (`test_method_design_cli.py`, `test_run_card.py`) and should not be described as "no direct tests."

The next batch must be delete-first and sequential, with explicit authority protection where semantics are still live.

## Mandatory execution order

Execute in this exact order, with per-lane acceptance + formal review + self-review passing before opening the next lane:

1. `method-design` delete/contract lane
2. `run-card validate/render` wrapper-only contraction lane
3. `branch` state/approval semantics lane

Do not run lane 2 before lane 1 closeout.  
Do not run lane 3 before lane 2 closeout.

## Global hard boundaries

1. No backward-compatibility shim, alias, or hidden fallback for removed commands.
2. No re-elevation of `hepar` / `hep-autoresearch` Python shell authority.
3. Keep generic-first direction: shared/runtime authority stays in generic substrate; domain specifics stay provider/domain-local.
4. Keep front-door and drift fixtures aligned with live implementation at each lane closeout.

## Lane 1: `method-design` delete/contract first

### Objective

Delete or sharply contract `method-design` so it no longer acts as a maintained parser command surface.

### In scope

- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- `packages/hep-autoresearch/tests/test_method_design_cli.py` (delete/rehome as needed)
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `meta/front_door_authority_map_v1.json`
- `scripts/lib/front-door-authority-map.mjs`
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`

### Out of scope

- `run-card validate/render` wrapper contraction (lane 2)
- `branch` semantics restructuring (lane 3)

### Lane 1 acceptance

- `git diff --check`
- `python3 -m pytest -q packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `python3 -m pytest -q packages/hep-autoresearch/tests/test_orchestrator_computation_cli.py packages/hep-autoresearch/tests/test_run_card.py`
- if `test_method_design_cli.py` is retained, run it; if removed/rehomed, record replacement proof tests explicitly in closeout notes
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`

### Lane 1 formal review must challenge

1. `method-design` authority is truly removed/contracted, not relocated via hidden fallback.
2. run-card/computation authority remains intact after method-design removal.
3. front-door authority map/tests/docs do not still claim `method-design` as live command truth.

## Lane 2: `run-card validate/render` wrapper-only contraction

### Objective

Contract/delete only the parser wrapper surface for `run-card validate/render`, while preserving run-card as state/approval/computation substrate artifact semantics.

### In scope

- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- `packages/hep-autoresearch/tests/test_run_card.py` (rehome/retire wrapper assertions as needed)
- `packages/hep-autoresearch/tests/test_orchestrator_computation_cli.py`
- `packages/hep-autoresearch/tests/test_adapter_gate_resolution_cli.py`
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_STATE.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_STATE.zh.md`
- `meta/front_door_authority_map_v1.json`
- `scripts/lib/front-door-authority-map.mjs`
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`

### Out of scope

- deleting run-card artifact semantics (`artifacts.run_card`, `run_card_sha256`, approval binding semantics)
- branch command semantics migration (lane 3)

### Lane 2 acceptance

- `git diff --check`
- `python3 -m pytest -q packages/hep-autoresearch/tests/test_run_card.py`
- `python3 -m pytest -q packages/hep-autoresearch/tests/test_orchestrator_computation_cli.py packages/hep-autoresearch/tests/test_adapter_gate_resolution_cli.py`
- `python3 -m pytest -q packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`

### Lane 2 formal review must challenge

1. only wrapper authority was contracted; run-card state/approval substrate semantics are still source-grounded and tested.
2. no new compatibility wrapper or alias was introduced.
3. docs/fixtures/tracker do not drift from post-contraction truth.

## Lane 3: `branch` as state/approval semantics lane (last)

### Objective

Treat `branch` as a semantics lane, not a trivial wrapper lane: resolve its relationship to state machine, approval flow, ledger/protocol artifacts, and only then remove/contract parser entrypoints.

### Required first step inside lane 3

Before deleting any `branch` CLI entrypoint, produce a source-grounded semantics map covering:

- parser entrypoints in `orchestrator_cli.py`
- state and transition logic in `toolkit/orchestrator_state.py`
- regression/protocol surfaces in `toolkit/orchestrator_regression.py`
- state contract docs in `docs/ORCHESTRATOR_STATE*.md`
- branching fields/events in state/ledger payloads and tests

If this mapping reveals a true architecture fork (not routine cleanup), pause for explicit architecture decision. Otherwise continue delete-first.

### In scope

- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py`
- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_regression.py`
- `packages/hep-autoresearch/tests/test_transition_state.py`
- `packages/hep-autoresearch/tests/test_approval_watchdog.py`
- `packages/hep-autoresearch/tests/test_toctou_regression.py`
- `packages/hep-autoresearch/tests/test_orchestrator_status_revision_reconcile.py`
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_STATE.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_STATE.zh.md`
- `meta/front_door_authority_map_v1.json`
- `scripts/lib/front-door-authority-map.mjs`
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`

### Lane 3 acceptance

- `git diff --check`
- `python3 -m pytest -q packages/hep-autoresearch/tests/test_transition_state.py packages/hep-autoresearch/tests/test_approval_watchdog.py packages/hep-autoresearch/tests/test_toctou_regression.py`
- `python3 -m pytest -q packages/hep-autoresearch/tests/test_orchestrator_status_revision_reconcile.py packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`

### Lane 3 formal review must challenge

1. `branch` removal/contraction did not break approval/state/ledger protocol semantics.
2. branch-related state fields/events are either still semantically justified and tested, or cleanly removed with contract/doc alignment.
3. no hidden fallback path keeps parser-era `branch` authority alive.

## Cross-lane closeout requirements (every lane)

1. Formal three-reviewer review (`Opus` + `Gemini(auto)` + `OpenCode`) with source-grounded packet.
2. Self-review must explicitly verify:
   - no compatibility fallback
   - authority completeness after changes
   - front-door docs and drift fixtures match implementation
3. Update `meta/REDESIGN_PLAN.md` and `meta/remediation_tracker_v1.json` in the same lane closeout commit.
4. Do not declare lane done if any live doc/fixture still states pre-change command truth.
