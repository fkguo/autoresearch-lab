# Prompt: 2026-04-07 Next Batch — Public Run Residue Retirement

## 1) Scope and Objective

This lane is a bounded implementation slice under the residual Pipeline A retirement plan.
Primary target: **public residual non-computation `run`** on installable `hepar`/`hep-autoresearch` shell.

You must close the highest-risk remaining residue:

- current public shell still exposes `run`
- `cmd_run(...)` still owns real Python-side run orchestration state transitions
- surviving public workflow ids are still executed through Python runtime logic

Goal for this lane:

- classify every currently public `run --workflow-id` survivor as `delete` / `repoint` / `keep-compatibility`
- ensure no survivor silently remains as a second workflow orchestrator authority
- if a survivor remains public, it must have direct CLI contract coverage

## 2) Source-Grounded Authority Baseline (read first)

Before editing, read these exact files:

- `meta/docs/plans/2026-04-07-next-batch-residual-support-surface-closure.md`
- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/adapters/shell_plugin.py`
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `packages/hep-autoresearch/tests/test_paper_reviser_workflow.py`
- `packages/hep-autoresearch/tests/test_adapter_gate_resolution_cli.py`
- `packages/hep-autoresearch/README.md`
- `packages/hep-autoresearch/docs/WORKFLOWS.md`
- `packages/hep-autoresearch/docs/COMPUTATION.md`
- `packages/hep-autoresearch/docs/EXAMPLES.md`

### Current truth you must preserve/challenge correctly

- Installable public shell inventory is fail-closed and includes `run`.
- Public `run --workflow-id` choices are derived from `_public_run_workflow_ids()` in `orchestrator_cli.py`.
- `_public_run_workflow_ids()` currently includes:
  - `ingest`
  - `reproduce`
  - `paper_reviser`
  - `revision`
  - `literature_survey_polish`
  - adapter workflow ids (currently includes `shell_adapter_smoke` via `shell_plugin.py`)
- `cmd_run(...)` still mutates `.autoresearch/state.json`, `ledger`, run cards, gate flow, and workflow execution path; this is why `public run` residue is highest priority.

## 3) Required Implementation Output

Implement the retirement/repoint first cut for **public run residue only**.

You must produce a checked-in classification outcome for every current public workflow id:

- `delete`: remove from installable public `run` surface
- `repoint`: move execution authority to canonical TS path (or explicit canonical host path), leaving at most thin compatibility forwarding
- `keep-compatibility`: temporarily retained public survivor with explicit bounded rationale and expiry follow-up

For each survivor, record:

- classification (`delete` / `repoint` / `keep-compatibility`)
- current authority owner
- target authority owner after this lane
- direct enforcing tests/docs
- follow-up id if deferred

## 4) Hard Boundaries

### Must do

- keep `public run` as the highest-priority residual retirement surface
- enforce that surviving public workflows do not rely on implicit docs/eval anchors
- align package-local docs with the resulting classification truth

### Must not do

- do not reopen generic lifecycle ownership (`autoresearch` remains canonical)
- do not mix this lane with `doctor`/`bridge`/`literature-gap` contract rebaseline (separate slice)
- do not broaden into full runtime/fleet/permission redesign

## 5) Suggested File Touch Set

Touch only what is needed for this lane:

- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- workflow-specific direct tests as needed:
  - `packages/hep-autoresearch/tests/test_paper_reviser_workflow.py`
  - `packages/hep-autoresearch/tests/test_adapter_gate_resolution_cli.py`
  - add targeted workflow-specific CLI contract tests if survivors lack direct coverage
- package docs that currently present residual `run` as live authority:
  - `packages/hep-autoresearch/README.md`
  - `packages/hep-autoresearch/docs/WORKFLOWS.md`
  - `packages/hep-autoresearch/docs/COMPUTATION.md`
  - `packages/hep-autoresearch/docs/EXAMPLES.md`

## 6) Acceptance (must pass)

Run and report all of the following:

1. `git diff --check`
2. `python3 -m pytest packages/hep-autoresearch/tests/test_public_cli_surface.py -q`
3. `python3 -m pytest packages/hep-autoresearch/tests/test_paper_reviser_workflow.py -q`
4. `python3 -m pytest packages/hep-autoresearch/tests/test_adapter_gate_resolution_cli.py -q`
5. `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`
6. `node scripts/check-shell-boundary-anti-drift.mjs`

If workflow survivors are changed, add/run extra direct CLI tests in the same lane and include them in acceptance output.

## 7) Formal Review Packet Requirements

Formal review must challenge authority, not wording only.

Review packet must include:

- changed files
- `orchestrator_cli.py` authority sections:
  - `PUBLIC_SHELL_COMMANDS`
  - `_public_run_workflow_ids()`
  - `run` parser setup
  - `cmd_run(...)`
- direct workflow tests proving retained survivors
- package docs that describe residual run surface
- front-door drift locks:
  - `packages/hep-mcp/tests/docs/docToolDrift.test.ts`
  - `scripts/check-shell-boundary-anti-drift.mjs`

### Reviewer challenge checklist (mandatory)

- any retained survivor has direct CLI contract coverage
- no survivor is justified only by eval anchors or historical docs
- no hidden path leaves Python `run` as de facto long-term orchestrator authority
- docs and tests reflect the same survivor set

## 8) Self-Review Gate (mandatory)

Before marking done:

- verify each survivor has a source-grounded `keep/repoint/delete` decision and enforcement path
- verify no stale workflow id remains exposed in help/parser/docs accidentally
- verify deferred survivors are explicitly recorded with a concrete next slice, not “later cleanup”
- verify this lane did not reintroduce generic authority drift

If a survivor is retained without direct CLI contract coverage, treat as blocking and fix in-lane.

## 9) Completion Criteria

This lane is complete only when:

- public residual `run` workflows are explicitly classified and enforced
- surviving public workflows are directly tested at CLI contract level
- docs no longer imply that Python `run` is open-ended workflow orchestrator authority
- acceptance + formal review + self-review all pass with 0 blocking
