# Prompt: 2026-04-07 Hepar Public Shell Support Surface Retirement

## 1) Scope and Objective

This lane is the next bounded Pipeline A retirement slice after public `run` workflow inventory reached `[]`.

Primary target:

- retire the remaining non-`run` installable public shell support commands on `hep-autoresearch` / `hepar` / `hep-autopilot`

Goal:

- the installable public shell keeps only `run` as a compatibility pointer
- `approvals`, `report`, `logs`, `context`, `smoke-test`, `method-design`, `propose`, `skill-propose`, `run-card`, `branch`, and `migrate` all leave the installable public shell
- those commands may remain on the internal full parser only where they still earn maintainer / eval / regression value
- front-door docs, authority fixtures, and anti-drift tests all publish the same truth

## 2) Source-Grounded Baseline (read first)

Read these exact files before editing:

- `meta/docs/plans/2026-04-07-next-batch-generic-closure-plan.md`
- `meta/docs/plans/2026-04-07-next-batch-residual-support-surface-closure.md`
- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- `packages/hep-autoresearch/src/hep_autoresearch/cli.py`
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `meta/front_door_authority_map_v1.json`
- `scripts/lib/front-door-authority-map.mjs`
- `scripts/lib/front-door-boundary-authority.mjs`
- `packages/hep-autoresearch/README.md`
- `packages/hep-autoresearch/README.zh.md`
- `packages/hep-autoresearch/docs/INDEX.md`
- `packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.md`
- `packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.zh.md`
- `packages/hep-autoresearch/docs/WORKFLOWS.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.zh.md`

### Current truth to preserve/challenge correctly

- installable public shell inventory is fail-closed through `PUBLIC_SHELL_COMMANDS` plus `_assert_public_shell_inventory(...)`
- installable public `run` still exists, but only as a compatibility pointer with no public workflow ids
- TS canonical CLI in `packages/orchestrator/src/cli.ts` does not own `approvals/report/logs/context/smoke-test/method-design/propose/skill-propose/run-card/branch/migrate`
- current package docs and front-door fixtures still publish those support commands as installable public truth

## 3) Required Output

Implement the first strict support-surface contraction:

- installable public shell inventory becomes exactly `("run",)`
- public parser construction under `main(..., public_surface=True)` adds only `run`
- all remaining support commands stay reachable only on `main(..., public_surface=False)` when still needed for maintainer/eval/regression coverage
- docs stop presenting any non-`run` support command as installable public truth

## 4) Hard Boundaries

### Must do

- keep `autoresearch` as the only canonical generic lifecycle / workflow-plan / computation front door
- keep changes bounded to installable public shell support-surface retirement
- align JSON fixture, JS helper, package docs, and tests to one exact public-shell inventory

### Must not do

- do not reintroduce Python compatibility/fallback language or backward-compat burden
- do not reopen deeper `doctor` / `bridge` / `literature-gap` maintainer contract wording beyond what this public-shell retirement forces
- do not broaden into runtime architecture work inside this lane

## 5) Suggested File Touch Set

- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `meta/front_door_authority_map_v1.json`
- `scripts/lib/front-door-authority-map.mjs`
- `scripts/lib/front-door-boundary-authority.mjs`
- `packages/hep-autoresearch/README.md`
- `packages/hep-autoresearch/README.zh.md`
- `packages/hep-autoresearch/docs/INDEX.md`
- `packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.md`
- `packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.zh.md`
- `packages/hep-autoresearch/docs/WORKFLOWS.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.zh.md`

## 6) Acceptance (must pass)

1. `git diff --check`
2. `python3 -m pytest packages/hep-autoresearch/tests/test_public_cli_surface.py -q`
3. `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`
4. `node scripts/check-shell-boundary-anti-drift.mjs`

Add extra targeted tests only if the retirement changes expose a previously untested direct contract.

## 7) Formal Review Packet Requirements

Review packet must include:

- changed files
- `orchestrator_cli.py` sections for `PUBLIC_SHELL_COMMANDS`, public parser construction, and `run`
- `test_public_cli_surface.py`
- `meta/front_door_authority_map_v1.json`
- `scripts/lib/front-door-authority-map.mjs`
- `scripts/lib/front-door-boundary-authority.mjs`
- all touched package docs that publish front-door/public-shell truth

### Reviewer challenge checklist

- does installable public shell now publish exactly one command: `run`
- do any docs still imply `approvals/report/logs/context/...` are installable public commands
- did any retired support command accidentally remain reachable through `public_surface=True`
- do fixture JSON, JS helper, doc snippets, and tests all point at the same exact inventory

## 8) Self-Review Gate

Before marking done:

- verify `hepar --help` shows only `run`
- verify each retired support command fails on installable public shell
- verify package docs now frame non-`run` support commands as internal full-parser or maintainer-only paths when they are still mentioned
- verify no wording re-promotes Python as a second generic front door

## 9) Completion Criteria

This lane is complete only when:

- installable public `hepar` shell exposes only `run`
- non-`run` support commands are retired from `public_surface=True`
- front-door docs/tests/fixtures match that truth exactly
- acceptance + formal review + self-review all pass with 0 blocking
