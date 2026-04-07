# 2026-04-07 M-22 Remainder Split Plan

## Why this note exists

`M-22` 已经不再是一个适合继续用单条 tracker 文案笼统描述的剩余项。

到 2026-04-07 为止，已知真值已经显示：

- TS approval consumers 已 landed
- `research-team` convergence gate consumer adoption 已 landed
- 当前 live generic-first 主轴已经切到 `CP-OBJ-01`

因此，`M-22` 继续剩下的内容更适合作为两个后续 residue slices，而不是继续混在一个模糊的“workflow / approval cleanup”篮子里。

## Source-grounded current truth

### 已确认仍然活着的 root approval authority split

- TS side 已经是 live canonical root approval authority:
  - shared `GateSpec` / gate registry owns A1-A5 approval ids + policy-key mapping
  - root `state.json` / ledger read-model path is owned by `packages/orchestrator`
  - current generic front door is `autoresearch`, not `hepar`
- 但 Python side 仍保留 executable legacy root authority residue:
  - install/public shell still enters Python orchestrator surfaces
  - internal full parser still owns `run` / `request-approval` / `approve` / state mutation logic
  - Python computation gate handling still consumes root `gate_satisfied`
  - Python web UI still mutates root approval/run state directly

Relevant files:

- `packages/shared/src/gate-registry.ts`
- `packages/orchestrator/src/state-manager.ts`
- `packages/orchestrator/src/orch-tools/approval.ts`
- `packages/orchestrator/src/orch-tools/control.ts`
- `packages/orchestrator/src/orch-tools/run-read-model.ts`
- `packages/hep-autoresearch/bin/hep-autoresearch.js`
- `packages/hep-autoresearch/scripts/orchestrator.py`
- `packages/hep-autoresearch/src/hep_autoresearch/cli.py`
- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py`
- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/computation.py`
- `packages/hep-autoresearch/src/hep_autoresearch/web/app.py`

### `research_workflow_v1` / `WorkflowGateSpec` census 已完成

在 fresh repo-wide census 中，当前 workflow canonical authority 已明确转到 recipe-based path：

- `autoresearch workflow-plan`
- `@autoresearch/literature-workflows`
- `meta/recipes/*.json`
- `skills/research-team` lower-level launcher consumer

在当前 live workflow-plan / runtime / read-model chain 中，未发现 `research_workflow_v1` / `WorkflowGateSpec` 的 live canonical consumer。当前更诚实的判断是：

- `research_workflow_v1` / `WorkflowGateSpec` 已从“待 census 的疑似 authority”收敛为“已完成 census 的 workflow/template residue family”
- 下一步不再是 fresh census，而是 bounded cleanup / rebaseline

Relevant live authority files:

- `packages/orchestrator/src/cli-workflow-plan.ts`
- `packages/orchestrator/tests/autoresearch-cli.test.ts`
- `packages/literature-workflows/src/recipeLoader.ts`
- `packages/literature-workflows/src/resolver.ts`
- `packages/literature-workflows/src/types.ts`
- `meta/schemas/workflow_recipe_v1.schema.json`
- `meta/recipes/*.json`
- `packages/hep-mcp/tests/core/workflowRecipes.test.ts`
- `skills/research-team/scripts/bin/literature_fetch.py`
- `skills/research-team/scripts/lib/literature_workflow_plan.py`

Known residue surfaces:

- `meta/schemas/research_workflow_v1.schema.json`
- `packages/shared/src/generated/research-workflow-v1.ts`
- `packages/shared/src/generated/index.ts`
- `meta/generated/python/research_workflow_v1.py`
- `meta/generated/python/__init__.py`
- `meta/schemas/workflow-templates/*.json`
- `packages/hep-mcp/tests/core/researchWorkflowSchema.test.ts`

## Proposed split

### `M-22A` — Python legacy root approval/run authority residue

Scope:

- cut or repoint Python surfaces that still own root approval/run state transitions
- remove duplicate Python ownership of `pending_approval` / `gate_satisfied` / `approval_history` / run-status mutation
- collapse executable entry chains so retained Python/provider-local surfaces no longer act as root authority
- keep generic-first authority on `packages/shared` + `packages/orchestrator`

Implementation focus:

- public shell / install path:
  - `packages/hep-autoresearch/bin/hep-autoresearch.js`
  - `packages/hep-autoresearch/src/hep_autoresearch/cli.py`
- internal full parser / maintainer entry path:
  - `packages/hep-autoresearch/scripts/orchestrator.py`
  - `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- Python root state / computation gate ownership:
  - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py`
  - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/computation.py`
- Python root mutation UI:
  - `packages/hep-autoresearch/src/hep_autoresearch/web/app.py`

Not scope:

- team-local delegated approvals
- operator read-model vocabulary convergence
- `research_workflow_v1` / template cleanup
- widening `hepar` / `hep-autoresearch` back into generic front-door authority
- provider-local `doctor` / `bridge` functionality itself, unless needed to remove root authority ownership

### `M-22B` — Workflow/template residue cleanup and truth rebaseline

Scope:

- operate from the completed fresh census captured above; do not reopen a discovery-only lane first
- remove, rehome, or explicitly classify `research_workflow_v1` / `WorkflowGateSpec` residue across:
  - schema/templates
  - generated TS/Python bindings
  - shared generated export surfacing
  - tests/docs/prompts that still imply canonical authority
- keep recipe-based workflow authority as the only live canonical path
- rebaseline plan/tracker/docs truth so remaining hits, if any, are explicitly marked non-canonical residue

Not scope:

- root approval authority migration
- reintroducing declarative workflow-graph authority as a second canonical substrate
- `CP-OBJ-01D` operator read-model work
- `CP-OBJ-01E` research-task bridge

## Recommended sequencing

1. `CP-OBJ-01D`
2. `CP-OBJ-01E`
3. `M-22A` — remove live Python duplicate root approval/run authority
4. `M-22B` — clean up and rebaseline already-censused workflow/template residue

Reason:

- `01D` removes operator-surface interpretation drift that is a real current blocker on the live path
- `01E` reconnects task authority before workflow/template retirement is judged
- `M-22A` is higher risk because it is still executable duplicate authority on the live root path
- `M-22B` no longer needs a fresh census pass; the next step is bounded cleanup after `M-22A`

## Acceptance shape for `M-22A`

- no Python public or internal surface remains authoritative for root approval/run lifecycle mutations
- root approval packet creation, approval resolution, root run-status transitions, and root read-model semantics are TS-orchestrator-owned
- any retained Python/provider-local surfaces are explicit adapters or maintainer tools, not a second root authority
- `hepar` / `hep-autoresearch` do not regain generic front-door authority
- provider-local `doctor` / `bridge` surfaces, if retained, remain provider-local and do not require restoring Python root approval ownership

Primary acceptance surfaces:

- `packages/orchestrator/tests/autoresearch-cli.test.ts`
- `packages/orchestrator/tests/orchestrator.test.ts`
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `packages/hep-autoresearch/tests/test_orchestrator_computation_cli.py`
- `packages/hep-autoresearch/tests/test_doctor_entrypoints_cli.py`
- `packages/hep-autoresearch/tests/test_mcp_doctor_and_bridge_cli.py`

## Acceptance shape for `M-22B`

- this note remains sufficient as the source-grounded census basis; no additional discovery-only lane is required first
- recipe-based workflow authority remains canonical on `autoresearch workflow-plan` + `@autoresearch/literature-workflows` + `meta/recipes`
- runtime/read-model/team-execution/computation default chains do not retain hidden canonical consumers of `research_workflow_v1` / `WorkflowGateSpec`
- generated/schema/template hits are either removed or explicitly documented as non-canonical residue
- shared generated exports do not continue to imply a second live workflow authority surface
- follow-up tracker/redesign/docs sync reflects the post-cleanup boundary rather than the pre-census ambiguity

## Non-goals

- do not reopen `CP-OBJ-01D` or `CP-OBJ-01E`
- do not use this note to claim `M-22` is ready to close
- do not treat schema/generated bindings alone as proof of live authority
- do not let `hepar` / `hep-autoresearch` regain primary generic authority while cleaning up legacy residue
