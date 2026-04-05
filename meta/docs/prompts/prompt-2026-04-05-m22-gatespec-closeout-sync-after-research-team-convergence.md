# M-22 GateSpec Closeout Sync After Research-Team Convergence

## Intent

This is the canonical implementation prompt for the next truthful `M-22` slice after the already-landed research-team convergence-gate consumer adoption.

The goal is **not** to widen `M-22` into a new implementation rollout immediately. The goal is to repair SSOT truth so `meta/` matches current source reality:

- `main` already contains the research-team convergence-gate consumer adoption;
- current tracker / redesign text still reads as if that slice were deferred;
- the lane must sync `meta/` to current source truth and narrow the remaining `M-22` scope to what is actually still open.

## Read First

Implementation lane must read, in order:

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. the full `M-22` section in `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. prior prompts for context:
   - `meta/docs/prompts/prompt-2026-03-29-m22-gatespec-ts-approval-consumers-first.md`
   - `meta/docs/prompts/prompt-2026-03-31-m22-gatespec-research-team-convergence-first.md`
6. landed consumer source now on `main`:
   - `skills/research-team/scripts/gates/convergence_schema.py`
   - `skills/research-team/scripts/gates/check_team_convergence.py`
   - `skills/research-team/scripts/gates/check_draft_convergence.py`
   - `skills/research-team/tests/test_convergence_gate.py`
   - `skills/research-team/tests/test_convergence_gate_json.py`
7. still-adjacent remaining authorities that must be inspected but not widened by default:
   - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py`
   - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/computation.py`
   - `meta/schemas/research_workflow_v1.schema.json`

## GitNexus And Serena

- Activate Serena on the implementation worktree before using Serena output as authority.
- Run onboarding check before Serena-guided navigation.
- Read GitNexus repo context before coding.
- This lane is expected to be narrow and may be meta-heavy, but source-grounded closeout still matters; if you need to rely on graph evidence for authority-map claims, refresh with `npx gitnexus analyze --force`.

## Exact Scope

### In scope

- Re-verify that the research-team convergence-gate consumer adoption is already landed on the current branch baseline.
- Update:
  - `meta/remediation_tracker_v1.json`
  - `meta/REDESIGN_PLAN.md`
  so they truthfully reflect that landed slice.
- If needed, sync the relevant checked-in prompt / note references so the canonical prompt chain is accurate.
- Narrow the remaining `M-22` open scope to only the authority families that are still genuinely unresolved after this landed slice.

### Out of scope

- Do not reopen the already-landed TS approval consumer-first slice.
- Do not implement a new Python legacy approval migration in this lane.
- Do not rewrite `research_workflow_v1.schema.json` or workflow templates in this lane unless a source-grounded blocker proves the current `meta/` truth cannot be stated accurately without a tiny corrective edit.
- Do not broaden into repo-wide governance cleanup beyond what is necessary to make `M-22` truthful again.

## Required Design Constraints

1. This is a source-truth sync lane first, not a speculative next-implementation lane.
2. Do not describe the research-team convergence slice as pending if current source already landed it.
3. Do not mark `M-22` fully done unless source proves the remaining duplicate-authority families are gone.
4. If some part of the remaining scope is now smaller or different than the old wording, rewrite it precisely rather than carrying forward stale defer text.
5. If you discover a genuine still-open follow-up that should be implemented later, record it narrowly; do not silently convert this lane into that implementation.

## Front-door Surface Audit

Because this lane updates governance / closeout truth, the audit must cover at least:

- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`
- `meta/docs/prompts/prompt-2026-03-29-m22-gatespec-ts-approval-consumers-first.md`
- `meta/docs/prompts/prompt-2026-03-31-m22-gatespec-research-team-convergence-first.md`
- `skills/research-team/scripts/gates/convergence_schema.py`
- `meta/schemas/research_workflow_v1.schema.json`

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `python3 -m json.tool /Users/fkg/Coding/Agents/autoresearch-lab-m22-gatespec-closeout-sync-after-research-team-convergence/meta/remediation_tracker_v1.json >/dev/null`
- `python3 -m pytest /Users/fkg/Coding/Agents/autoresearch-lab-m22-gatespec-closeout-sync-after-research-team-convergence/skills/research-team/tests/test_convergence_gate.py`
- `python3 -m pytest /Users/fkg/Coding/Agents/autoresearch-lab-m22-gatespec-closeout-sync-after-research-team-convergence/skills/research-team/tests/test_convergence_gate_json.py`
- `rg -n "research-team convergence|convergence_schema.py|WorkflowGateSpec|research_workflow_v1|pending|deferred" /Users/fkg/Coding/Agents/autoresearch-lab-m22-gatespec-closeout-sync-after-research-team-convergence/meta/REDESIGN_PLAN.md /Users/fkg/Coding/Agents/autoresearch-lab-m22-gatespec-closeout-sync-after-research-team-convergence/meta/remediation_tracker_v1.json /Users/fkg/Coding/Agents/autoresearch-lab-m22-gatespec-closeout-sync-after-research-team-convergence/meta/docs/prompts/prompt-2026-03-31-m22-gatespec-research-team-convergence-first.md /Users/fkg/Coding/Agents/autoresearch-lab-m22-gatespec-closeout-sync-after-research-team-convergence/skills/research-team/scripts/gates/convergence_schema.py /Users/fkg/Coding/Agents/autoresearch-lab-m22-gatespec-closeout-sync-after-research-team-convergence/meta/schemas/research_workflow_v1.schema.json`

## Review Requirements

Formal trio review is mandatory because this lane changes checked-in closeout / governance truth:

- `Opus`
- `Gemini(auto)`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Seat note:
- `Gemini(auto)` is a reviewer seat name; when invoked via CLI runners it maps to the Gemini model selector `auto`.

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must confirm that the revised `meta/` wording matches current source and does not overclaim `M-22` done-ness.
- If Gemini or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than diff-only review.
- Formal self-review is also required after trio convergence.

## Expected Closeout Claims

If the batch succeeds, the truthful closeout claim is narrow:

- `main` already contains the research-team convergence-gate consumer adoption;
- `meta/` now states that truth accurately;
- remaining `M-22` scope is narrowed to the authority families still genuinely open after that landed slice.

Anything broader than that needs fresh source evidence and should not be claimed by default.
