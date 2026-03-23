# Prompt: 2026-03-23 `UX-05` Follow-up — research-team Authority Extraction + External-Root Isolation

## Intent

Deliver the minimum migration batch that:

1. extracts shared scaffold / contract authority out of `packages/hep-autoresearch`
2. keeps `hepar` only as a thin transitional consumer of that authority
3. fail-closes public real-project roots and real-project intermediate outputs so they cannot resolve back into `/Users/fkg/Coding/Agents/autoresearch-lab`

This batch is:
- `UX-05` follow-up
- `Pipeline A repoint` pre-slice

This batch is not:
- `EVO-14`
- `EVO-15`
- full `hepar` migration
- generic `autoresearch` entrypoint repoint
- alias design / cleanup

## Authority Decision

- Shared scaffold / contract authority moves to `packages/project-contracts/`
- `packages/orchestrator/` stays out of scope for this slice
- `research-team` public wrappers consume `packages/project-contracts/` directly
- `hep-autoresearch` / `hepar` keep only thin transitional consumer logic on the scaffold/init surface

## Policy Split

Two modes only:

- `real_project`
- `maintainer_fixture`

Rules:
- `real_project` project roots must resolve outside `/Users/fkg/Coding/Agents/autoresearch-lab`
- `real_project` intermediate outputs must also resolve outside `/Users/fkg/Coding/Agents/autoresearch-lab`
- repo-internal maintainer work is allowed only through explicit gitignored fixture directories such as `skills/research-team/skilldev` and `skills/research-team/.tmp/`
- no env flag, hidden fallback, or secondary wrapper may silently switch a public flow into `maintainer_fixture`

## Scope

### In scope

- `packages/project-contracts/**`
- `skills/research-team/scripts/bin/scaffold_research_workflow.sh`
- `skills/research-team/scripts/bin/refresh_research_contract.py`
- `skills/research-team/scripts/bin/run_team_cycle.sh` (bounded output-path guard only)
- `skills/research-team/scripts/dev/init_skilldev_workspace.sh`
- `skills/research-team/scripts/dev/run_skilldev_self_audit.sh`
- `skills/research-team/scripts/dev/run_real_project_regression.sh`
- `skills/research-team/scripts/dev/register_real_project_regression.sh`
- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/*` on the scaffold/contract bridge surface
- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` on `init` + `_mcp_env`
- touched docs/governance/tracker/plan files on this same surface

### Out of scope

- full Pipeline A repoint
- full `hepar` CLI migration
- generic `autoresearch` entrypoint work
- alias retention / removal design
- repo-wide rollout of the new root/output policy to every secondary mutator
- broader `hep-autoresearch` runtime/self-evolution cleanup

## Acceptance

```bash
npx gitnexus analyze --force
git diff --check
python3 -m pytest packages/project-contracts/tests/test_scaffold_contract.py packages/project-contracts/tests/test_root_policy.py packages/project-contracts/tests/test_output_policy.py -q
python3 -m pytest packages/hep-autoresearch/tests/test_scaffold_naming_contract.py packages/hep-autoresearch/tests/test_notebook_contract_split.py packages/hep-autoresearch/tests/test_project_root_isolation.py -q
bash skills/research-team/scripts/dev/smoke/smoke_test_scaffold_minimal.sh
bash skills/research-team/scripts/dev/smoke/smoke_test_notebook_contract_roundtrip.sh
bash skills/research-team/scripts/dev/smoke/smoke_test_scaffold_output_contract.sh
bash skills/research-team/scripts/dev/smoke/smoke_test_external_root_guard.sh
bash skills/research-team/scripts/dev/smoke/smoke_test_external_output_guard.sh
bash skills/research-team/scripts/dev/smoke/smoke_test_skilldev_self_audit.sh
bash skills/research-team/scripts/dev/smoke/smoke_test_real_project_regression_harness.sh
rg -n "packages/hep-autoresearch/src|hep_autoresearch\\.toolkit\\.(project_scaffold_cli|research_contract)" skills/research-team/scripts skills/research-team/README.md skills/research-team/RUNBOOK.md skills/research-team/SKILL.md
```

Expected authority grep result:
- no live public `research-team` authority imports/calls into `packages/hep-autoresearch`

## Deferred Follow-up

- `Pipeline A repoint` remains the next recommended authority batch: generic `autoresearch` entrypoint / naming closure / `hep-autoresearch` + `hepar` lifecycle handling
- default assumption for that future batch is still: no transitional alias
- alias discussion may reopen only if someone shows a concrete current in-repo operator blocker
