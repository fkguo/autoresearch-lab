# Prompt: 2026-04-08 Pipeline A `doctor` + `bridge` Delete-First Internal Slice

## Why this lane exists now

The public-shell retirement is already done. The remaining problem is narrower and more honest:

- `doctor` and `bridge` are still live only on the internal full parser inside `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- they are not generic front-door authority
- they are not required for `autoresearch` control-plane correctness
- keeping them as parser commands preserves extra legacy shell surface and ongoing maintenance burden

Source-grounded audit now says this pair is the safest first delete-first residual slice:

- `doctor` is an internal diagnostics wrapper around MCP config discovery + health probing
- `bridge` is an internal artifact-to-MCP bridge wrapper for legacy computation runs
- both are provider-local residues, not shared/core substrate authority
- deleting them does **not** require reopening generic lifecycle, workflow authority, or transport architecture

This repo has no backward-compatibility requirement. Do not preserve these commands as compatibility backends, aliases, or hidden fallbacks.

## Primary objective

Delete the internal parser `doctor` / `bridge` command surfaces completely, then rebaseline adjacent docs/tests/front-door classification so the repo truth matches that deletion without accidentally deleting lower-level remaining authority.

## Hard boundaries

1. Do not reintroduce `doctor` / `bridge` under another parser alias or "compatibility" name.
2. Do not widen this lane into `literature-gap`, `paper_reviser`, `method-design`, `run-card`, or `branch`.
3. Do not invent a new TS diagnostics/bridge product surface in this lane.
4. Do not restore any Python root lifecycle authority while removing these commands.
5. Do not claim that deleting the parser wrappers also deletes unrelated lower-level MCP config, bridge helper, or computation authority if those are still used elsewhere.

## Source-grounded current authority map

- Parser implementations:
  - `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
    - `cmd_doctor(...)`
    - `cmd_bridge(...)`
- Current tests tied directly to these shells:
  - `packages/hep-autoresearch/tests/test_mcp_doctor_and_bridge_cli.py`
  - `packages/hep-autoresearch/tests/test_doctor_entrypoints_cli.py`
  - `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- Current front-door / classification locks:
  - `meta/front_door_authority_map_v1.json`
  - `scripts/lib/front-door-authority-map.mjs`
- Current docs that still describe these commands as internal-only residue:
  - `packages/hep-autoresearch/docs/WORKFLOWS.md`
  - any adjacent package/root docs you find that still mention `doctor` / `bridge` as surviving parser commands

## Implementation intent

This is a delete-first slice, not a rehome-first slice.

Expected result:

1. `doctor` parser wiring is removed.
2. `bridge` parser wiring is removed.
3. dead helper functions that existed only for those commands are removed if no other live callers remain.
4. tests stop treating these parser commands as valid internal truth.
5. front-door/internal inventory no longer classifies `doctor` / `bridge` as surviving parser residue.
6. docs no longer describe them as live internal commands.

If lower-level helper logic remains live and still has value, test it directly at the lower-level seam rather than keeping a parser wrapper alive.

## Expected touch surface

Implementation:

- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`

Tests / locks:

- `packages/hep-autoresearch/tests/test_mcp_doctor_and_bridge_cli.py`
- `packages/hep-autoresearch/tests/test_doctor_entrypoints_cli.py`
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `meta/front_door_authority_map_v1.json`
- `scripts/lib/front-door-authority-map.mjs`

Docs:

- `packages/hep-autoresearch/docs/WORKFLOWS.md`
- any nearby doc/help surface that still states `doctor` / `bridge` survive on the internal parser

## Recommended implementation sequence

1. Remove parser registration and command handlers for `doctor` / `bridge`.
2. Delete or narrow command-specific tests so they no longer execute removed parser paths.
3. Preserve only the exact lower-level tests/helpers that still exercise live non-parser authority.
4. Remove `doctor` / `bridge` from front-door/internal-support classification tables and exact-match tests.
5. Remove stale doc wording that implies these commands still exist, even as internal-only residue.
6. Re-run the drift/CLI guards so the delete is locked rather than left as silent residue.

## Non-goals

- no `literature-gap` deletion in this lane
- no `paper_reviser` replacement in this lane
- no `run-card` schema/normalizer change
- no `branch` state-model rewrite
- no TS diagnostics web/bridge feature work
- no new compatibility layer

## Acceptance

- `git diff --check`
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest -q packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest -q packages/hep-autoresearch/tests/test_mcp_doctor_and_bridge_cli.py packages/hep-autoresearch/tests/test_doctor_entrypoints_cli.py`
  - if one or both files are deleted/replaced because the parser commands no longer exist, record the exact replacement test command(s) in the acceptance notes
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`

## Formal review packet requirements

Review packet must include:

- parser before/after for `doctor` / `bridge`
- surviving lower-level authority (if any) and why deleting the parser does not delete unrelated truth
- updated tests proving the commands are gone rather than merely undocumented
- updated front-door/internal-support classification surfaces
- updated docs/help wording
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`

Reviewers must explicitly challenge:

1. whether `doctor` / `bridge` were actually deleted rather than just hidden from help text;
2. whether any lower-level live authority was accidentally deleted along with the parser wrappers;
3. whether docs/tests/authority-map surfaces still leak stale command truth;
4. whether this slice stayed delete-first and did not reintroduce a new compatibility/fallback surface.

## Self-review focus

Before closeout, self-review must confirm:

1. `doctor` and `bridge` no longer exist as parser commands.
2. no doc/test/front-door surface still claims they are surviving internal commands.
3. no backward-compatibility shim or fallback was added.
4. the change did not widen into unrelated legacy residue (`literature-gap`, `paper_reviser`, `method-design`, `run-card`, `branch`).
