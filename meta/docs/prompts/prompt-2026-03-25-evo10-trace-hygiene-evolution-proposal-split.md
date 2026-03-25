# EVO-10 Trace Hygiene: Provider-Local Split of `evolution_proposal.py`

## Summary

- Execute the deferred EVO-10 hygiene slice only: split and clean up `packages/hep-autoresearch/src/hep_autoresearch/toolkit/evolution_proposal.py`.
- This is a provider-local hygiene lane, not a migration lane.
- Do not move authority into `packages/shared/`, `packages/orchestrator/`, or a new generic abstraction.
- Keep the live public authority exactly where it already is:
  - `hep_autoresearch.toolkit.evolution_proposal::EvolutionProposalInputs`
  - `hep_autoresearch.toolkit.evolution_proposal::evolution_proposal_one`
- Keep caller contracts, artifact names, return shape, and behavioral semantics unchanged.

## Required Reads Before Implementation

1. `AGENTS.md`
2. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
3. `meta/REDESIGN_PLAN.md`
4. `meta/remediation_tracker_v1.json`
5. `gitnexus://repo/autoresearch-lab-trace-hygiene-evo10-split/context`

## GitNexus Requirements

- Re-run `npx gitnexus analyze --force` before implementation because the worktree is dirty and the lane adds new helper modules.
- Re-run `npx gitnexus analyze --force` again before formal review.
- Gather blast-radius evidence at minimum for:
  - `evolution_proposal_one`
  - direct callers in `evolution_trigger.py`, `orchestrator_cli.py`, and `scripts/run_evolution_proposal.py`

## Scope Boundaries

- In scope:
  - split `evolution_proposal.py` into a thin front door plus provider-local helper modules
  - tighten internal boundaries between analysis, render, and write/output sequencing
  - adjust adjacent tests only when directly needed to lock existing behavior
- Out of scope:
  - `EVO-12a`
  - `EVO-14`
  - approval/reporting expansion
  - daemon/watcher behavior
  - broader trace schema / SQLite index / query surface work
  - genericization / shared-framework extraction
  - touching `.github/workflows/ci.yml`
  - touching `packages/idea-engine/tsconfig.json`

## Required Code Shape

- Keep `packages/hep-autoresearch/src/hep_autoresearch/toolkit/evolution_proposal.py` as the sole public front door.
- Extract analysis-only logic into `packages/hep-autoresearch/src/hep_autoresearch/toolkit/evolution_proposal_analysis.py`.
  - scan source-run `analysis.json`
  - read failure payloads
  - classify failures
  - build candidate proposals
  - apply `auto_handled` normalization
  - preserve dedupe / stagnation accounting inputs
- Extract render-only logic into `packages/hep-autoresearch/src/hep_autoresearch/toolkit/evolution_proposal_render.py`.
  - render `proposal.md`
  - render `trace_stub.md`
  - keep truncation / Markdown helpers local to render logic
- Extract output-bundle construction and write sequencing into `packages/hep-autoresearch/src/hep_autoresearch/toolkit/evolution_proposal_outputs.py`.
  - build manifest / summary / suggested eval payload
  - coordinate `write_artifact_report`
  - write KB trace when enabled
  - preserve the write order with `analysis.json` written last
- Reuse provider-local history/dedupe support in `packages/hep-autoresearch/src/hep_autoresearch/toolkit/evolution_proposal_history.py` as needed to keep each file within repo modularity rules.

## Affected Files

- Required implementation surface:
  - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/evolution_proposal.py`
  - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/evolution_proposal_analysis.py`
  - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/evolution_proposal_render.py`
  - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/evolution_proposal_outputs.py`
  - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/evolution_proposal_history.py`
- Allowed adjacent test touch only if directly needed:
  - `packages/hep-autoresearch/tests/test_evolution_proposal.py`
  - `packages/hep-autoresearch/tests/test_evolution_trigger.py`
- Read-only verification surface:
  - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/evolution_trigger.py`
  - `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
  - `packages/hep-autoresearch/scripts/run_evolution_proposal.py`
  - `packages/hep-autoresearch/tests/test_run_quality_metrics.py`
  - `packages/hep-autoresearch/docs/EVOLUTION.zh.md`

## Acceptance Commands

Run exactly this narrow EVO-10 slice:

```bash
PYTHONPATH=/Users/fkg/Coding/Agents/autoresearch-lab-trace-hygiene-evo10-split/packages/hep-autoresearch/src \
python -m pytest \
  packages/hep-autoresearch/tests/test_evolution_proposal.py \
  packages/hep-autoresearch/tests/test_evolution_trigger.py \
  packages/hep-autoresearch/tests/test_run_quality_metrics.py -q
```

```bash
git diff --check
```

## Review Packet Requirements

- Formal review packet should include only:
  - the split files
  - direct callers
  - the narrow evolution tests
  - acceptance commands
  - GitNexus evidence
- Formal review must answer:
  1. Did any authority migrate out of `hep-autoresearch`? Expected: no.
  2. Was any generic/shared abstraction introduced? Expected: no.
  3. Is `evolution_proposal.py` still the sole public front door? Expected: yes.
  4. Did artifact names, return keys, `auto_handled`, dedupe, stagnation semantics, and `analysis.json`-last behavior remain unchanged? Expected: yes.

### Required Reviewers

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5)`

If any reviewer is unavailable, record the failure reason and use same-model rerun / normalization before asking for fallback.

## Self-Review Requirements

Self-review must be source-grounded and re-check:

- front-door authority completeness
- provider-local boundary discipline
- caller compatibility
- acceptance evidence
- GitNexus post-change evidence
- adopted / declined / deferred amendment dispositions

## Governance Closeout

- Do not touch `AGENTS.md`, `meta/remediation_tracker_v1.json`, or `meta/REDESIGN_PLAN.md` before implementation/review.
- After acceptance and review converge:
  - check in this canonical prompt with the implementation
  - update `meta/remediation_tracker_v1.json` to record that the deferred EVO-10 oversized-file hygiene follow-up is now complete
  - update `meta/REDESIGN_PLAN.md` to replace the deferred follow-up note with a factual closeout note
  - re-check `AGENTS.md` and `.serena/memories/architecture-decisions.md`; if no new durable invariant emerged, record explicit no-op instead of editing them

## Debt Handling

- Absorb now:
  - the oversized-file split itself
  - low-risk mechanical import updates needed to preserve the same front door
  - one narrow regression assertion if needed to lock artifact behavior
- Defer:
  - migration/genericization
  - cleanup of `skill_proposal.py` or other similar files
  - approval/reporting expansion
  - `EVO-12a`
  - `EVO-14`
  - daemon/watcher / fleet / broader trace work

## Completion Check

This slice is complete only when:

1. the split files are in place and public authority remains unchanged
2. the narrow acceptance commands pass
3. formal review converges with `0 blocking`
4. self-review finds `0 blocking`
5. tracker / plan / canonical prompt are synchronized to the current code fact pattern
6. `AGENTS.md` and `.serena/memories/architecture-decisions.md` are explicitly rechecked for no-op vs required update
