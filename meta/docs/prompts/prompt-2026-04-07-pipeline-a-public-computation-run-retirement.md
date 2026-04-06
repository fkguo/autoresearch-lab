# Pipeline A Follow-up — Retire Public Legacy Computation From The Installable Shell

## Goal

Continue the generic-first / Pipeline A retirement path by removing public `hepar run --workflow-id computation` from the installable `hep-autoresearch` / `hepar` / `hep-autopilot` shell, while keeping the internal full parser computation path available for maintainer, eval, and targeted regression coverage.

This is a bounded public-surface narrowing slice. It is not a computation runtime redesign, not a residual non-computation `run` retirement batch, and not a broader deletion of `packages/hep-autoresearch/`.

## Why This Slice

Current repo truth already says native TS `autoresearch run --workflow-id computation` is the canonical public computation front door. Package docs, redesign notes, and root/front-door wording all treat the remaining installable Pipeline A shell as residual non-computation `run` workflows plus support commands. But the public `hepar` parser still accepted `--workflow-id computation` and still exposed computation-specific help, which left a real dual-front-door drift between docs and code.

Compared with the remaining public Pipeline A surface, this is the highest-leverage next cut because:

- computation already has a live native TS public front door in `@autoresearch/orchestrator`
- internal computation regression coverage already targets `hep_autoresearch.orchestrator_cli`, so the public alias can be narrowed without deleting maintainer/eval paths
- the blast radius is bounded to public parser registration/help, public-shell regression tests, root/package docs, anti-drift fixture truth, and tracker/plan sync
- it removes a genuine duplicated public authority before attempting the much broader residual non-computation `run` retirement problem

## Required Reads

1. `AGENTS.md`
2. `meta/REDESIGN_PLAN.md`
3. `meta/remediation_tracker_v1.json`
4. `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
5. `packages/hep-autoresearch/src/hep_autoresearch/cli.py`
6. `packages/hep-autoresearch/tests/test_public_cli_surface.py`
7. `packages/hep-autoresearch/tests/test_orchestrator_computation_cli.py`
8. `packages/hep-autoresearch/README.md`
9. `packages/hep-autoresearch/README.zh.md`
10. `README.md`
11. `docs/README_zh.md`
12. `docs/PROJECT_STATUS.md`
13. `docs/ARCHITECTURE.md`
14. `scripts/lib/front-door-boundary-authority.mjs`
15. `scripts/check-shell-boundary-anti-drift.mjs`
16. `packages/hep-mcp/tests/docs/docToolDrift.test.ts`

## Bounded Implementation

- narrow the installable public `run` parser so `hepar run --workflow-id computation` is no longer a valid public command path
- keep internal full-parser computation coverage green in `packages/hep-autoresearch/tests/test_orchestrator_computation_cli.py`
- update public-shell regression coverage so public `run --help` no longer presents computation as an installable legacy workflow and the public alias rejects `--workflow-id computation`
- update root/package docs and the shared front-door wording fixture so they explicitly state that installable `hepar` no longer exposes public computation
- sync `meta/REDESIGN_PLAN.md` and `meta/remediation_tracker_v1.json` so chronology and remaining-scope notes match the actual code truth

## Explicit No-Go

- no change to native TS `autoresearch run --workflow-id computation` semantics
- no change to internal computation execution semantics, run-card validation, or approval behavior
- no widening into residual non-computation `run` retirement, support-command repointing, or first-touch docs rewrite
- no deletion of the internal computation path or its maintainer/eval regression coverage
- no reopening of HEP provider/operator design, computation manifest design, or orchestrator runtime architecture

## Acceptance

- `git diff --check`
- `PYTHONPATH=/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-autoresearch/src python3 -m hep_autoresearch --help`
- `PYTHONPATH=/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-autoresearch/src python3 -m hep_autoresearch run --help`
- `python3 -m pytest -q packages/hep-autoresearch/tests/test_public_cli_surface.py packages/hep-autoresearch/tests/test_orchestrator_computation_cli.py`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`

## Review Focus

- confirm public `hepar run --workflow-id computation` is gone while internal full-parser computation coverage still passes
- confirm root/package docs and anti-drift fixtures now describe exactly one installable public computation front door: `autoresearch run --workflow-id computation`
- confirm this batch stays bounded away from residual non-computation `run` retirement and support-command architecture questions
- confirm tracker / redesign plan chronology now matches the actual order in which public-shell narrowing landed
