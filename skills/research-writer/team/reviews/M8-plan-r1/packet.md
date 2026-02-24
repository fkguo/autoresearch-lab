# research-writer — M8-plan-r1 Review Packet (forward plan with Skill vs Agent separation)

## Goal
Approve the forward development plan as **realistic and auditable**, and confirm that the Skill/Agent boundary is correct:
- Skills: deterministic, testable tooling and pipelines.
- Agent: judgment-heavy physics writing + skepticism + manual merges.

## Acceptance criteria for this plan
- A single progress-tracking document exists and is clear: `PLAN.md`.
- The plan explicitly separates:
  - what becomes a skill feature vs what remains an agent responsibility,
  - and forbids auto-mutation of `assets/style/physics_discussion_logic_playbook.md`.
- Milestones include concrete deliverables + acceptance criteria + progress checklists.
- `ROADMAP.md` points to `PLAN.md` for M8+ tracking.

## Evidence

### Files
```text
PLAN.md
ROADMAP.md
```

### Summary of proposed milestones
- **M8**: deterministic `distill/` reports (consensus vs disagreements) over dual-model outputs; agent manually merges patterns.
- **M9**: paper scaffold upgrade (sections + provenance + UNVERIFIED registry); agent shapes narrative and validation plans.
- **M10**: quality gate beyond compilation (warnings/undefined refs/cites/bib health).
- **M11**: optional performance hardening for very large corpora.

## Reviewer request
Return `VERDICT: READY` only if the plan is actionable, auditable, and correctly splits responsibilities, with no blockers.

