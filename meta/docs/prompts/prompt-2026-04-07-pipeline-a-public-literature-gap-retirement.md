# Pipeline A Follow-up — Retire `literature-gap` From The Installable Public Shell

## Goal

Continue the generic-first / Pipeline A retirement path by removing `literature-gap` from the installable public `hep-autoresearch` / `hepar` / `hep-autopilot` shell, while keeping the internal full parser available for maintainer, eval, and targeted regression paths.

This is a bounded public-surface narrowing slice. It is not a literature-workflow redesign, not a runtime refactor, and not a broader deletion of `packages/hep-autoresearch/`.

## Why This Slice

Current repo truth already says the high-level literature front door is native TS `autoresearch workflow-plan`, with the checked-in Python `workflow-plan` script as the lower-level consumer of the same workflow authority. By contrast, `hepar literature-gap` was still described as a legacy compatibility wrapper, which meant the installable public shell still exposed a redundant high-level entrypoint after its generic replacement already existed.

Compared with the remaining public Pipeline A surface, this is the highest-leverage next cut because:

- it still competed directly with the generic front door in root/front-door docs
- it was already implemented as a launcher consumer rather than an independent authority
- internal regression coverage already targeted `hep_autoresearch.orchestrator_cli`, so the public alias could be narrowed without deleting maintainer/eval paths
- its blast radius is mostly public-shell registration, root/package docs, anti-drift fixtures, and tracker truth

## Required Reads

1. `AGENTS.md`
2. `meta/REDESIGN_PLAN.md`
3. `meta/remediation_tracker_v1.json`
4. `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
5. `packages/hep-autoresearch/src/hep_autoresearch/cli.py`
6. `packages/hep-autoresearch/tests/test_public_cli_surface.py`
7. `packages/hep-autoresearch/tests/test_literature_gap_cli.py`
8. `packages/hep-autoresearch/README.md`
9. `packages/hep-autoresearch/README.zh.md`
10. `README.md`
11. `docs/README_zh.md`
12. `docs/PROJECT_STATUS.md`
13. `docs/ARCHITECTURE.md`
14. `docs/TOOL_CATEGORIES.md`
15. `docs/TESTING_GUIDE.md`
16. `meta/protocols/session_protocol_v1.md`
17. `scripts/lib/front-door-boundary-authority.mjs`
18. `scripts/check-shell-boundary-anti-drift.mjs`
19. `packages/hep-mcp/tests/docs/docToolDrift.test.ts`

## Bounded Implementation

- remove `literature-gap` from the installable public shell by registering it only on the internal full parser, following the same public-surface narrowing pattern already used for `doctor` / `bridge`
- keep `packages/hep-autoresearch/tests/test_literature_gap_cli.py` green by preserving the internal full parser path
- update public-shell regression coverage so `hepar --help` no longer exposes `literature-gap` and the public alias rejects it as an invalid choice
- update root/front-door docs, testing guidance, protocol wording, and anti-drift fixtures so they no longer present `hepar literature-gap` as a live public compatibility shell; `autoresearch workflow-plan` stays the public high-level entrypoint and the checked-in Python `workflow-plan` script stays the lower-level consumer
- update package-local legacy docs to state that `literature-gap` now lives only on the internal full parser for maintainer/eval/test paths
- sync `meta/REDESIGN_PLAN.md` and `meta/remediation_tracker_v1.json` to the new truth

## Explicit No-Go

- no change to `autoresearch workflow-plan` semantics or state persistence
- no change to the checked-in Python `workflow-plan` consumer semantics
- no widening into residual non-computation `run --workflow-id ...` retirement
- no widening into `method-design`, `propose`, `skill-propose`, `logs`, `context`, `branch`, `run-card`, or `migrate`
- no deletion of the internal `literature-gap` implementation or its maintainer/eval regression coverage
- no reopening of HEP provider/operator design or literature-workflow recipe design

## Acceptance

- `git diff --check`
- `PYTHONPATH=/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-autoresearch/src python3 -m hep_autoresearch --help`
- `python3 -m pytest -q packages/hep-autoresearch/tests/test_public_cli_surface.py packages/hep-autoresearch/tests/test_literature_gap_cli.py`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`

## Review Focus

- confirm `literature-gap` is gone from the installable public alias but still reachable through the internal full parser for maintainer/eval/test coverage
- confirm root/front-door docs now describe exactly one public high-level literature entrypoint: `autoresearch workflow-plan`
- confirm the batch does not reopen runtime/product architecture or widen into the residual `run` retirement problem
- confirm tracker / redesign plan truth matches the new public-shell boundary
