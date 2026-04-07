# Prompt: 2026-04-08 Pipeline A `literature-gap` Rebaseline-To-Delete Slice

## Why this lane exists now

`doctor` and `bridge` are gone from the internal parser. The next residual command is different in kind:

- `literature-gap` is still only an internal full-parser command
- but unlike `doctor` / `bridge`, it is still the heaviest checked-in workflow consumer for launcher-resolved literature authority
- deleting it immediately would risk deleting the only realistic maintainer/eval path that proves the current `literature_gap_analysis` recipe, seed-search resolution, and analyze-step atomic-tool wiring actually hang together

So this lane is not "keep compatibility." It is "move the real consumer truth off the parser shell, then delete the parser shell honestly."

## Primary objective

Rebaseline `literature-gap` so that launcher-resolved literature workflow authority is proven through lower-level checked-in consumer coverage rather than through the legacy parser command, then prepare or complete deletion of the parser shell without reopening Python as a front door.

## Hard boundaries

1. Do not preserve `literature-gap` as a compatibility backend, alias, or hidden fallback.
2. Do not widen this lane into `paper_reviser`, `method-design`, `run-card`, or `branch`.
3. Do not move workflow authority back into Python package-local docs or parser glue; keep generic/shared workflow authority on `packages/literature-workflows`.
4. Do not invent a new public `hepar`/`hep-autoresearch` front door for literature workflows.
5. Do not treat `literature-gap` parser deletion as permission to weaken recipe/consumer coverage; first rehome the real coverage.

## Source-grounded current authority map

- parser shell + current heavy consumer:
  - `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
    - `cmd_literature_gap(...)`
    - `_c1_extract_seed_search_candidates(...)`
- current parser-driven tests:
  - `packages/hep-autoresearch/tests/test_literature_gap_cli.py`
- current launcher/shared workflow authority:
  - `packages/literature-workflows/src/resolver.ts`
  - `packages/literature-workflows/src/providerProfiles.ts`
  - `packages/literature-workflows/tests/resolve.test.ts`
- current Python-side wrapper over shared workflow resolution:
  - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/literature_workflows.py`
- current docs / workflow spec:
  - `packages/hep-autoresearch/workflows/C1_literature_gap.md`
  - `docs/TESTING_GUIDE.md`

## Implementation intent

This lane should prove one of these two end states, in order of preference:

1. preferred:
   - add lower-level checked-in consumer coverage that exercises launcher-resolved `literature_gap_analysis` behavior and artifact contract without going through the parser shell
   - then delete `cmd_literature_gap` and rebaseline docs/tests to the lower-level truth
2. fallback only if deletion is not yet safe:
   - narrow the parser shell to a clearly non-authoritative temporary residue while landing the lower-level consumer coverage needed for the next delete-first cut
   - if this fallback is used, the lane must leave behind an immediate follow-up packet that names the exact remaining delete blockers

Because this repo has no backward-compatibility burden, the shell should not survive just to keep old UX alive.

## Expected touch surface

Implementation:

- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/literature_workflows.py`
- `packages/literature-workflows/src/resolver.ts`
- `packages/literature-workflows/src/providerProfiles.ts`

Tests:

- `packages/hep-autoresearch/tests/test_literature_gap_cli.py`
- `packages/literature-workflows/tests/resolve.test.ts`
- new focused lower-level consumer test(s) are expected
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`

Docs:

- `packages/hep-autoresearch/workflows/C1_literature_gap.md`
- `docs/TESTING_GUIDE.md`
- any touched package/root front-door wording if the parser shell is deleted in the same slice

## Recommended implementation sequence

1. Identify the minimum lower-level consumer seam that can truthfully replace parser-shell coverage.
2. Add focused tests that prove:
   - launcher-resolved `literature_gap_analysis` recipe selection
   - discover-step seed-search behavior
   - analyze-step atomic-tool requirements
   - required artifact outputs / fail-closed behavior
3. Once that coverage exists, delete or sharply narrow `cmd_literature_gap`.
4. Rebaseline docs/tests/front-door wording so no live surface still implies the parser shell is the real authority.
5. If deletion is not yet safe, leave the parser path explicitly temporary and record the exact next delete blockers in plan/tracker.

## Non-goals

- no `paper_reviser` replacement
- no `method-design` / `run-card` contraction
- no `branch` semantics cleanup
- no TS public literature workflow redesign beyond already-authoritative `autoresearch workflow-plan`
- no compatibility shell preservation

## Acceptance

- `git diff --check`
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest -q packages/hep-autoresearch/tests/test_literature_gap_cli.py packages/hep-autoresearch/tests/test_public_cli_surface.py`
  - if `cmd_literature_gap` is deleted in this slice, replace this with the exact lower-level test command(s) that now prove the same authority and record them in closeout notes
- `pnpm --filter @autoresearch/literature-workflows test -- tests/resolve.test.ts`
  - if new lower-level consumer tests are added elsewhere, include them explicitly in acceptance notes
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`

## Formal review packet requirements

Review packet must include:

- parser before/after for `literature-gap`
- lower-level consumer coverage before/after
- current launcher authority files in `packages/literature-workflows`
- docs/testing surfaces that currently still mention `literature-gap`
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`

Reviewers must explicitly challenge:

1. whether launcher/workflow authority really moved off the parser shell;
2. whether the new lower-level coverage is strong enough to justify deleting `cmd_literature_gap`;
3. whether any public/installable surface accidentally reintroduced `hepar literature-gap`;
4. whether this lane remained delete-first rather than preserving a fallback shell.

## Self-review focus

Before closeout, self-review must confirm:

1. `literature-gap` no longer acts as the only realistic checked-in consumer of launcher-resolved literature workflow authority.
2. if the parser shell remains, it remains only as a clearly temporary residue with an explicit immediate delete path.
3. docs/tests/front-door wording no longer imply deleted or deprecated shells are still canonical.
4. no compatibility backend or fallback was introduced.
