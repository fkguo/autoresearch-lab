# NEW-R05a Pydantic v2 Rebaseline

## Intent

This is the canonical governance rebaseline / closeout prompt for `NEW-R05a`.

The goal is not to implement a new Python codegen target. The goal is to correct stale governance text so it matches the live checked-in truth:

- the Python codegen target is already `datamodel-code-generator --output-model-type pydantic_v2.BaseModel`;
- the checked-in outputs under `meta/generated/python/**` are already Pydantic v2 contract artifacts;
- these bindings are not yet a live `packages/**` runtime authority surface.

## Lane Boundary

- lane: `NEW-R05a Pydantic v2 target evaluation rebaseline`
- branch: `codex/new-r05a-pydantic-v2-eval-rebaseline`
- worktree: `/Users/fkg/Coding/Agents/autoresearch-lab-new-r05a-pydantic-v2-eval-rebaseline`
- mode: governance-only

Hard boundary:

- do not touch `packages/**`
- do not rewrite runtime code
- do not claim Python runtime adoption

## Read First

Read in this order before making governance claims:

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. full `NEW-R05a` section in `meta/REDESIGN_PLAN.md`
4. `meta/docs/design-new01-codegen.md`
5. `meta/scripts/codegen.sh`
6. `meta/scripts/codegen-resolve-refs.ts`
7. `meta/scripts/codegen-py-init.ts`
8. representative files under `meta/generated/python/**`
9. current codegen checks / acceptance surfaces that ground the live truth:
   - `Makefile`
   - `meta/ECOSYSTEM_DEV_CONTRACT.md` (`SYNC-06`)
   - read-only proof commands over `meta/generated/python/**`

## Required Live Truth

The closeout claim must stay narrow and source-grounded:

1. `meta/scripts/codegen.sh` already hardcodes `--output-model-type pydantic_v2.BaseModel`.
2. Checked-in `meta/generated/python/**` models already subclass `pydantic.BaseModel`.
3. `Makefile` `codegen-check` guards committed sync for `packages/shared/src/generated/` and `meta/generated/python/`.
4. Current audit must explicitly confirm zero non-test `packages/**` imports of `meta/generated/python/**`.
5. Therefore `NEW-R05a` is a baseline-landed governance item, not a still-pending evaluation lane.
6. This does not imply Python runtime adoption; `meta/generated/python/**` remains an adjacent checked-in contract-artifact surface.

## Required Governance Changes

Update only:

- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`
- `meta/ECOSYSTEM_DEV_CONTRACT.md`
- this canonical prompt file

Minimum required changes:

- normalize stale `NEW-01` / shared-codegen wording that still says Python output is dataclass- or package-local-path-based;
- rewrite `NEW-R05a` from “evaluate switching from dataclasses” to a done-style rebaseline note;
- mark `NEW-R05a` `done` in tracker with a source-grounded closeout note;
- update Phase 2 / aggregate counts if they become stale;
- keep all claims bounded to governance truth only.

## Out Of Scope

- any edit under `packages/**`
- changing schemas
- changing the codegen target
- making `meta/generated/python/**` a runtime-consumed surface
- reopening Python retirement / TS migration / evidence-schema design debates
- rewriting historical design memos unless a live-truth contradiction makes closeout impossible

## Proof Commands

Run these exact read-only proof commands and use them in the closeout:

```bash
rg -n -- '--output-model-type pydantic_v2.BaseModel|PY_OUT="meta/generated/python"' meta/scripts/codegen.sh Makefile

python3 - <<'PY'
import importlib.util
import pathlib
path = pathlib.Path("meta/generated/python/artifact_ref_v1.py")
spec = importlib.util.spec_from_file_location("artifact_ref_v1", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
print(mod.ArtifactrefV1.__mro__[:3])
print(mod.ArtifactrefV1.model_config)
PY

python3 -m py_compile meta/generated/python/*.py

rg -n 'meta/generated/python|from meta\.generated\.python' packages meta skills -g '!meta/generated/python/**' -g '!packages/**/dist/**'
```

Also run:

```bash
git diff --check
python3 -m json.tool meta/remediation_tracker_v1.json >/dev/null
git status --short
```

## Review Requirements

Formal trio review is mandatory if governance files change:

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Rules:

- no fallback reviewer substitution without explicit coordinator approval
- reviewers must inspect touched governance files plus live proof surfaces:
  - `meta/scripts/codegen.sh`
  - `Makefile`
  - representative `meta/generated/python/**` files
  - the no-consumer import proof
- if a reviewer backend is unavailable or does not yield a usable source-grounded verdict after allowed same-model rerun handling, stop and report `blocked`
- after trio convergence, run formal self-review on the same narrow claim:
  - baseline landed
  - governance wording stale
  - no runtime/package rewrite

## Reopen Conditions

Do not reopen `NEW-R05a` unless at least one of these becomes true:

1. the Python codegen target changes away from the current Pydantic v2 target;
2. `meta/generated/python/**` becomes a live runtime authority consumed by `packages/**`;
3. the current proof commands no longer hold and governance truth drifts again.

## Required Closeout Template

Use this exact final report template:

```text
[lane]:
`NEW-R05a Pydantic v2 target evaluation rebaseline`

[branch]:
`codex/new-r05a-pydantic-v2-eval-rebaseline`

[worktree]:
`/Users/fkg/Coding/Agents/autoresearch-lab-new-r05a-pydantic-v2-eval-rebaseline`

[status]:
`done_pending_version_control_authorization | blocked`

[head]:
`<git-head>`

[scope]:
`what was inspected, what governance files changed, and whether packages/** stayed untouched`

[authority_check]:
- `current live authority` -> `<summary>`
- `current gap / stale wording` -> `<summary>`
- `smallest truthful next deliverable` -> `<summary>`
- `did item remain pending or change` -> `<reason>`

[acceptance]:
- `git status --short` -> `<output>`
- `git diff --check` -> `pass/fail`
- `python3 -m json.tool meta/remediation_tracker_v1.json >/dev/null` -> `pass/fail`
- `targeted source-proof command(s)` -> `<summary>`
- `packages/** untouched` -> `yes/no`

[review]:
- `Opus` -> `<verdict>`
- `Gemini-3.1-Pro-Preview` -> `<verdict>`
- `OpenCode(zhipuai-coding-plan/glm-5.1)` -> `<verdict>`
- `self-review` -> `<verdict>`
- `adopted/deferred/declined amendments` -> `<summary>`

[governance_touch]:
`yes/no`

[plan_mode]:
`required`

[blocker]:
`none | <reason>`

[next_action]:
`await coordinator decision`
```
