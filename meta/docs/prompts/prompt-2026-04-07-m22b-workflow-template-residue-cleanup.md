# M-22B — Workflow/Template Residue Cleanup And Truth Rebaseline

This is the canonical follow-on prompt for the second `M-22` remainder slice identified by:

- `meta/docs/plans/2026-04-07-m22-remainder-split-plan.md`
- `meta/docs/prompts/prompt-2026-04-07-m22a-python-legacy-root-authority-retirement.md`

`M-22B` is not a fresh discovery lane. The census is already complete. This batch should operate from that settled truth and remove the old residue cleanly.

## Goal

Delete or demote the old `research_workflow_v1` / `WorkflowGateSpec` workflow-template residue so recipe-based workflow authority remains the only live canonical path.

Truthful success for this slice means:

- `autoresearch workflow-plan` + `@autoresearch/literature-workflows` + `meta/recipes/*.json` remain the only live workflow authority
- old workflow graph schema/template/codegen residue is removed or explicitly downgraded out of runtime/test/front-door authority
- shared/generated exports no longer imply a second live workflow substrate

## Why This Slice Exists

The fresh repo-wide census is already done:

- live workflow authority now sits on:
  - `packages/orchestrator/src/cli-workflow-plan.ts`
  - `packages/literature-workflows/src/recipeLoader.ts`
  - `packages/literature-workflows/src/resolver.ts`
  - `meta/schemas/workflow_recipe_v1.schema.json`
  - `meta/recipes/*.json`
  - `packages/hep-mcp/tests/core/workflowRecipes.test.ts`
  - `skills/research-team/scripts/bin/literature_fetch.py`
  - `skills/research-team/scripts/lib/literature_workflow_plan.py`
- the old `research_workflow_v1` family survives only as residue:
  - `meta/schemas/research_workflow_v1.schema.json`
  - `meta/schemas/workflow-templates/*.json`
  - `packages/shared/src/generated/research-workflow-v1.ts`
  - `packages/shared/src/generated/index.ts`
  - `meta/generated/python/research_workflow_v1.py`
  - `meta/generated/python/__init__.py`
  - `packages/hep-mcp/tests/core/researchWorkflowSchema.test.ts`

Current source evidence did not find a hidden live runtime consumer blocking cleanup. The risk here is stale codegen/test/doc authority, not runtime dependency.

## Required Reads

Read in this order before implementation:

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. the full `M-22` section in `meta/REDESIGN_PLAN.md`
4. `meta/docs/plans/2026-04-07-m22-remainder-split-plan.md`
5. live recipe authority:
   - `meta/protocols/session_protocol_v1.md`
   - `packages/orchestrator/src/cli-workflow-plan.ts`
   - `packages/literature-workflows/src/recipeLoader.ts`
   - `packages/literature-workflows/src/resolver.ts`
   - `packages/literature-workflows/src/types.ts`
   - `meta/schemas/workflow_recipe_v1.schema.json`
   - `meta/recipes/*.json`
   - `packages/orchestrator/tests/autoresearch-cli.test.ts`
   - `packages/hep-mcp/tests/core/workflowRecipes.test.ts`
   - `skills/research-team/scripts/bin/literature_fetch.py`
   - `skills/research-team/scripts/lib/literature_workflow_plan.py`
   - `skills/research-team/tests/test_literature_workflow_plan.py`
6. residue to remove or demote:
   - `meta/schemas/research_workflow_v1.schema.json`
   - `meta/schemas/workflow-templates/original_research.json`
   - `meta/schemas/workflow-templates/reproduction.json`
   - `meta/schemas/workflow-templates/review.json`
   - `packages/shared/src/generated/research-workflow-v1.ts`
   - `packages/shared/src/generated/index.ts`
   - `meta/generated/python/research_workflow_v1.py`
   - `meta/generated/python/__init__.py`
   - `packages/hep-mcp/tests/core/researchWorkflowSchema.test.ts`
7. codegen / contract authority:
   - `Makefile`
   - `meta/scripts/codegen.sh`
   - `meta/ECOSYSTEM_DEV_CONTRACT.md`
   - `meta/docs/design-new01-codegen.md`

## GitNexus And Serena

- Activate Serena on the implementation worktree before using Serena output as authority.
- Run onboarding check before Serena-guided navigation.
- Read GitNexus repo context before coding.
- If the worktree is dirty or contains new symbols/callsites, refresh with `npx gitnexus analyze --force` before relying on graph evidence.
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if downstream recipe/codegen/export blast radius is not obvious from direct source inspection.

## Exact Scope

### In scope

- Remove `research_workflow_v1` and `workflow-templates` as live schema/test/codegen residue.
- Re-run the checked-in codegen path so generated TS/Python bindings match the post-cleanup schema set.
- Delete or rewrite tests that still lock the old workflow/template surface as current authority.
- Rebaseline tracker / redesign / relevant docs so the surviving truth is “recipe authority live, old workflow graph residue removed”.

### Out of scope

- `M-22A`
- redesigning recipe-based workflow authority
- inventing a new generic workflow graph schema
- repointing `hepar` / `hep-autoresearch`
- reopening `CP-OBJ-01`, `NEW-RT-*`, or literature runtime semantics
- broad prompt/doc archaeology beyond surfaces that still affect authority judgment

## Required Design Constraints

1. Recipe-based workflow authority must remain the only canonical path after cleanup.
2. Do not replace one duplicate authority with another renamed workflow schema/template artifact.
3. Generated deletions must be handled via the normal codegen/check path; do not leave stale generated exports behind.
4. If a historical doc/prompt remains only as audit trail, it may stay, but it must not keep describing the deleted schema/template surface as current truth.
5. Do not treat `packages/shared/src/generated/index.ts` re-export presence alone as justification to keep dead schema/codegen alive.

## Packet Assumptions To Re-Check

Reviewers and self-review must explicitly verify:

1. There is still no checked-in runtime consumer of `research_workflow_v1` / `WorkflowGateSpec`.
2. The only surviving workflow authority path is recipe-based (`workflow_recipe_v1` + resolver + launcher consumers).
3. `packages/hep-mcp/tests/core/researchWorkflowSchema.test.ts` is locking dead residue rather than a still-needed runtime contract.
4. Codegen/build coupling is fully accounted for in the batch, so removed schemas do not leave stale generated outputs behind.

If any assumption is false on the implementation worktree, treat that as a packet assumption breach and widen the audit before claiming closeout.

## Front-door Surface Audit

Because this slice changes workflow authority truth, the review packet must include an explicit front-door audit covering at least:

- `README.md`
- `docs/README_zh.md`
- `docs/PROJECT_STATUS.md`
- `docs/QUICKSTART.md`
- `docs/ARCHITECTURE.md`
- `docs/TESTING_GUIDE.md`
- `skills/research-team/README.md`
- `meta/protocols/session_protocol_v1.md`
- `packages/orchestrator/tests/autoresearch-cli.test.ts`
- `packages/hep-mcp/tests/core/workflowRecipes.test.ts`

If some surface remains unchanged, the packet must still record that it was checked and why it is unaffected.

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `make codegen-check`
- `pnpm --filter @autoresearch/shared build`
- `pnpm --filter @autoresearch/literature-workflows test`
- `pnpm --filter @autoresearch/orchestrator test -- tests/autoresearch-cli.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/workflowRecipes.test.ts`
- `python3 -m pytest skills/research-team/tests/test_literature_workflow_plan.py -q`
- `rg -n "ResearchWorkflowV1|WorkflowGateSpec|research-workflow-v1|research_workflow_v1|workflow-templates" packages meta/generated/python meta/schemas packages/hep-mcp/tests --glob '!**/dist/**'`

Implementation note:

- The final `rg` audit does not have to be zero-hit globally, but remaining hits must be obviously historical planning/audit text rather than runtime/codegen/test authority.

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini(auto)`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Reviewers must explicitly answer:

1. Is there any live runtime caller that still depends on `research_workflow_v1` / `WorkflowGateSpec`?
2. Were all schema/template/codegen/test residue surfaces removed or correctly downgraded?
3. Do front-door docs/tests now point only to recipe-based workflow authority?
4. Did the batch accidentally re-open broader workflow design instead of bounded cleanup?

Additional review handling:

- Prefer one `OpenCode workspace` discovery pass first, because hidden generated/export/test residue is plausible here.
- If `Gemini(auto)` or `OpenCode` fail to produce a usable source-grounded verdict, prefer same-model embedded-source reruns rather than shrinking to diff-only review.
- Self-review is mandatory after trio convergence.

## Expected Truthful Closeout Claim

If the batch succeeds, the narrow truthful claim is:

- recipe-based workflow authority remains the only live canonical path
- `research_workflow_v1` / `workflow-templates` residue has been removed or explicitly downgraded out of runtime/codegen/test authority
- `M-22B` is closed as residue cleanup, not as a new workflow-design effort

Anything broader than that requires fresh source evidence and should not be claimed by default.
