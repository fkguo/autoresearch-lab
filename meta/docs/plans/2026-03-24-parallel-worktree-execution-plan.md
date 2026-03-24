# Parallel Worktree Execution Plan

> **Date**: 2026-03-24
> **Status**: Proposed
> **Scope**: Execution planning for concurrent Wave 1 worktrees
> **Document role**: Planning only. This file does not define any new runtime API, schema, tool surface, or authority boundary.

## Baseline Verification

The following facts were re-verified on `main` immediately before writing this plan:

- `git status --short` is empty on `/Users/fkg/Coding/Agents/autoresearch-lab`.
- `git worktree list` shows only:
  - `/Users/fkg/Coding/Agents/autoresearch-lab` on `main`
  - `/Users/fkg/Coding/Agents/autoresearch-nds` on `feat/nds-mcp`
- `meta/docs/plans/` currently contains only:
  - `meta/docs/plans/2026-02-24-monorepo-migration-design.md`

The existing `/Users/fkg/Coding/Agents/autoresearch-nds` worktree is treated as independent from this plan. It is not in the Wave 1 ownership set and does not currently overlap with the five proposed lane domains.

The current tracker also still supports the intended Wave 1 dependency shape:

| Lane seed | Tracker status | Dependency state | Notes |
|----------|----------------|------------------|-------|
| `trace-jsonl` | `pending` | ready | Unblocks `EVO-10` and part of `EVO-12a` |
| `EVO-09` | `pending` | ready | To be implemented on the live `idea-engine` `search.step` path |
| `M-15` | `pending` | ready | Direct blocker for `EVO-12` |
| `EVO-17` | `design_complete` | ready | Package does not yet exist; good Wave 1 seed |
| `EVO-20` | `design_complete` | ready | Shared substrate for later Track B work |

## Planning Goals

- Keep `main` clean and integration-only for the whole Wave 1 effort.
- Keep the Wave 1 plan at `5` lanes total, but open only `4` lanes immediately and defer the fifth until one active lane reaches review/merge-ready.
- Avoid worktree ownership overlap on the same primary package domain.
- Keep blocked follow-ups listed as "next on the same lane after merge", not bundled into the initial branch.
- Favor dependency-unlocking lanes over lower-leverage cleanup or documentation-only backlog items.

## Wave 1 Launch Order

Open these lanes immediately:

- `codex/trace-jsonl`
- `codex/skills-platform`
- `codex/rep-sdk`
- `codex/memory-graph`

Defer this lane until one open-now lane reaches `reviewing` or `merge_ready`:

- `codex/idea-engine-evolution`

This launch order keeps the original Wave 1 dependency-unlocking plan, but lowers simultaneous governance pressure and reduces the risk of opening an unnecessary fifth active lane before the first merges start to form.

## Wave 1 Worktrees

| Branch | Worktree path | Initial deliverable | Primary ownership |
|--------|---------------|---------------------|-------------------|
| `codex/trace-jsonl` | `/Users/fkg/Coding/Agents/autoresearch-lab-trace-jsonl` | `trace-jsonl` | tracing/logging seam across Python orchestrator, orchestrator runtime, hep-mcp dispatcher, and trace-related tests |
| `codex/idea-engine-evolution` | `/Users/fkg/Coding/Agents/autoresearch-lab-idea-engine-evolution` | `EVO-09` | `packages/idea-engine/` search-step evolution plus bounded parity/test alignment |
| `codex/skills-platform` | `/Users/fkg/Coding/Agents/autoresearch-lab-skills-platform` | `M-15` | `packages/skills-market/**` and skill install/runtime isolation |
| `codex/rep-sdk` | `/Users/fkg/Coding/Agents/autoresearch-lab-rep-sdk` | `EVO-17` | new `packages/rep-sdk/` plus required workspace wiring |
| `codex/memory-graph` | `/Users/fkg/Coding/Agents/autoresearch-lab-memory-graph` | `EVO-20` | `packages/shared/src/memory-graph*` substrate only |

### 1. `codex/trace-jsonl`

**Worktree path**: `/Users/fkg/Coding/Agents/autoresearch-lab-trace-jsonl`

**Initial scope**:
- `trace-jsonl` only

**Owned surfaces**:
- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/logging_config.py`
- the orchestrator trace/logging seam
- hep-mcp dispatcher/tool-usage logging
- trace-related tests

**Why this is Wave 1**:
- dependency-ready in the tracker
- directly unblocks `EVO-10`
- removes part of the prerequisite debt for `EVO-12a`

**Out of scope**:
- approval packet/report work
- fleet scheduling or `EVO-14` follow-up
- unrelated hep-mcp tool-surface cleanup

**Next on the same lane after merge**:
- `EVO-10`
- then the trace-dependent part of `EVO-12a`

### 2. `codex/idea-engine-evolution`

**Worktree path**: `/Users/fkg/Coding/Agents/autoresearch-lab-idea-engine-evolution`

**Initial scope**:
- `EVO-09`, implemented on the live `packages/idea-engine/` `search.step` path

**Owned surfaces**:
- `packages/idea-engine/src/service/**`
- `packages/idea-engine/tests/**`
- bounded `packages/idea-core/tests/**` parity fixtures or regression alignment only
- failure-library schemas under the existing checked-in schema authority
- explicitly includes the current domain-pack service surfaces such as `domain-pack-registry.ts`, `domain-pack.ts`, and `hep-domain-pack.ts` when they are touched by the live `search.step` evolution path

**Why this is Wave 1**:
- `EVO-09` is dependency-ready
- `idea-engine` already has a live `search.step` surface, so new search evolution work should land there instead of reopening Python-only authority

**Required lane note**:
- treat `NEW-R10` as a tracker reconciliation item only, with the expected closeout state being `cut` / cancelled rather than a new Python implementation slice
- do not reopen Python structural decomposition work under this lane

**Out of scope**:
- Python-first `idea-core` feature expansion
- `EVO-11` in the first branch
- unrelated `idea-engine` authority or runtime redesign

**Next on the same lane after merge**:
- `EVO-11`

### 3. `codex/skills-platform`

**Worktree path**: `/Users/fkg/Coding/Agents/autoresearch-lab-skills-platform`

**Initial scope**:
- `M-15` only

**Owned surfaces**:
- `packages/skills-market/**`
- skill install/runtime isolation surfaces
- minimal related skill fixtures

**Why this is Wave 1**:
- dependency-ready
- direct blocker for `EVO-12`
- mostly isolated from the other four Wave 1 lanes

**Out of scope**:
- skill LOC governance
- new skill creation
- `EVO-12` in the first branch

**Next on the same lane after merge**:
- `EVO-12`
- then optionally `NEW-R08`
- then optionally `L-02`, `L-03`, and `NEW-SKILL-01` as separate follow-up slices

### 4. `codex/rep-sdk`

**Worktree path**: `/Users/fkg/Coding/Agents/autoresearch-lab-rep-sdk`

**Initial scope**:
- `EVO-17` only

**Owned surfaces**:
- new `packages/rep-sdk/`
- already checked-in REP schemas
- the minimum package/workspace wiring needed for builds and tests

**Why this is Wave 1**:
- dependency-ready
- the package does not yet exist, so ownership is naturally clean
- unlocks the Track A / registry stack without colliding with the live runtime lanes

**Out of scope**:
- `EVO-04`
- `EVO-18`
- HTTP transport or broader productization

**Next on the same lane after merge**:
- `EVO-04`
- then `EVO-18`

### 5. `codex/memory-graph`

**Worktree path**: `/Users/fkg/Coding/Agents/autoresearch-lab-memory-graph`

**Initial scope**:
- `EVO-20` only

**Owned surfaces**:
- `packages/shared/src/memory-graph*`
- minimum shared persistence/types surface required by the existing design

**Why this is Wave 1**:
- dependency-ready
- mostly isolated from the other four worktrees
- foundational substrate for later `EVO-19`, `EVO-12a`, and `EVO-21`

**Out of scope**:
- Gene Library logic
- skill genesis logic
- proactive evolution policy

**Next on the same lane after merge**:
- `EVO-19`, once `EVO-04` is also merged

## Deferred Lanes

The following lanes should **not** be opened as separate worktrees in Wave 1:

### `EVO-14` follow-up

- Do not open a separate worktree yet.
- The tracker still marks `EVO-14` as `in_progress`.
- The next post-Batch-8 slice is not yet narrowed into a decision-complete bounded batch.
- Keep it parked until a fresh prompt or checked-in plan item exists.

### `NEW-R14`

- Do not open it yet.
- `hep-mcp` package-splitting is a large structural lane.
- It should wait until there is no active hep-mcp hardening or surface-governance lane competing for the same paths.

### Lower-priority ready items not selected for Wave 1

Do not start these in Wave 1:

- `EVO-05`
- `EVO-06`
- `EVO-07`
- `EVO-08`
- `M-20`
- `M-22`
- `NEW-02`
- `NEW-03`
- `NEW-04`

These are either lower leverage than the five dependency-unlocking lanes above or better handled later as a dedicated approval/reporting and governance worktree.

### `NEW-R10`

- Do not create a worktree for `NEW-R10`.
- The live Python `service.py` target no longer exists in that form.
- `idea-engine` has already started and completed its Stage 3 baseline.
- Its tracker `decision_gate` is already satisfied (`Phase 3 kickoff: cancel if idea-engine TS migration started`).
- This item should be resolved as tracker/plan cleanup that marks it `cut` / cancelled, not by reopening Python structural work.

## Required Follow-up Retirement Lanes

This Wave 1 plan also records a planning-completeness correction: two retirement lanes were still only implicit in high-level Phase 4 language and should already have been written down as explicit checked-in follow-up targets. They are not Wave 1 branches today, but they should not remain only as oral intent.

### `Pipeline A` run-surface repoint / parity / delete

- This lane should repoint the remaining unrepointed `Pipeline A` commands (`run`, `doctor`, `bridge`) and remove the remaining Python delegation in `autoresearch` once the TS replacement is real and accepted.
- This is not a backward-compatibility lane. The delete step is part of the lane's completion definition, not an optional later cleanup.
- Do not keep `hepar` / `hep-autoresearch` around after the TS run surface truly owns the behavior.
- Retrospective note: the 2026-03-21 `Clean up post-repoint Pipeline A operator docs` slice was the natural place to leave a checked-in pointer to this next bounded lane, because it already normalized `run` / `doctor` / `bridge` as unrepointed commands. That batch was still correct to stay wording-only, but the follow-up lane should have been recorded there.
- Open this lane only after a fresh bounded prompt exists and the active Wave 1 lanes no longer compete for the same `packages/orchestrator/` + `packages/hep-autoresearch/` surfaces.

### `idea-core` retire-all closeout

- This lane should finish the remaining TS authority migration on `packages/idea-engine/`, remove Python-side parity / MCP bridge fallback / remaining unported methods once their TS replacements are accepted, and then retire `packages/idea-core`.
- This is not `NEW-R10`; no Python-first decomposition work should be reopened.
- Prefer to execute this as the post-`EVO-09` / post-`EVO-11` closeout on the same TS lane, because the live `search.step` authority already resides in `packages/idea-engine/`.
- Like the `Pipeline A` lane above, this is not a compatibility-preservation lane. Once TS parity is accepted, the Python fallback should be deleted rather than kept as a dormant legacy surface.

## Coordination Rules

### `main` branch rules

- `main` stays clean and integration-only for the whole effort.
- No implementation happens directly on `main`.
- New work only lands on `main` through reviewed branch integration.

### Ownership rules

Each worktree owns one primary package domain:

- `trace-jsonl` owns cross-cutting tracing surfaces
- `idea-engine-evolution` owns `idea-engine`
- `skills-platform` owns `skills-market` and skill isolation
- `rep-sdk` owns the new `packages/rep-sdk`
- `memory-graph` owns the new shared memory-graph substrate

The existing `/Users/fkg/Coding/Agents/autoresearch-nds` worktree is outside these ownership rules. No Wave 1 lane should assume coordination with that branch unless its package surface later starts overlapping one of the five owned domains.

### Governance-file collision rules

These files should only be touched in each lane's closeout commit, after code and acceptance are stable:

- `meta/remediation_tracker_v1.json`
- `meta/REDESIGN_PLAN.md`
- `AGENTS.md`

The goal is to avoid every lane repeatedly colliding on the same governance surfaces during active implementation.

When multiple lanes close in quick succession, the later lane should rebase onto the most recent merged closeout before touching these files. This is especially important for `meta/remediation_tracker_v1.json`, where last-writer-wins conflict resolution would otherwise risk silently dropping tracker facts.

### Worktree location rules

- Use sibling worktree directories under `/Users/fkg/Coding/Agents/`
- Do not create nested worktrees inside the repository
- Do not use `~/.config/superpowers/...`

### Coordinator protocol

This plan also defines the minimum operator-facing coordination contract for the Wave 1 parallel lanes. The coordinator thread owns the board below; worker threads report state back using the shared report template.

#### Coordinator lane board columns

| Lane | Branch | Worktree | First deliverable | Owned paths | Status | Head | Acceptance | Review | Governance touch | Blocker | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|
| coordinator | `main` | `/Users/fkg/Coding/Agents/autoresearch-lab` | coordination only | no implementation | active | current `main` HEAD | n/a | n/a | no | none | receive worker updates |
| trace-jsonl | `codex/trace-jsonl` | `/Users/fkg/Coding/Agents/autoresearch-lab-trace-jsonl` | `trace-jsonl` | tracing/logging seam | not_started | - | - | - | closeout_only | - | start lane planning |
| skills-platform | `codex/skills-platform` | `/Users/fkg/Coding/Agents/autoresearch-lab-skills-platform` | `M-15` | `packages/skills-market/**` | not_started | - | - | - | closeout_only | - | start lane planning |
| rep-sdk | `codex/rep-sdk` | `/Users/fkg/Coding/Agents/autoresearch-lab-rep-sdk` | `EVO-17` | new `packages/rep-sdk/` | not_started | - | - | - | closeout_only | - | start lane planning |
| memory-graph | `codex/memory-graph` | `/Users/fkg/Coding/Agents/autoresearch-lab-memory-graph` | `EVO-20` | `packages/shared/src/memory-graph*` | not_started | - | - | - | closeout_only | - | start lane planning |
| idea-engine-evolution | `codex/idea-engine-evolution` | `/Users/fkg/Coding/Agents/autoresearch-lab-idea-engine-evolution` | `EVO-09` | `packages/idea-engine/**` | deferred_open | - | - | - | closeout_only | wait_for_slot | open after one lane reaches review/merge-ready |

#### Shared status enum

- `not_started`
- `planning`
- `plan_ready`
- `implementing`
- `acceptance_passed`
- `reviewing`
- `merge_ready`
- `merged`
- `blocked`
- `deferred_open`

#### Worker status report template

```text
[lane]: rep-sdk
[branch]: codex/rep-sdk
[worktree]: /Users/fkg/Coding/Agents/autoresearch-lab-rep-sdk
[status]: plan_ready
[head]: <commit-or-none>
[scope]: EVO-17 first deliverable only
[acceptance]: not_run | passed | failed
[review]: not_run | converged | blocked
[governance_touch]: no
[blocker]: none | <one-line blocker>
[next_action]: <one-line next step>
```

#### Coordinator expectations

- Keep this board in the main coordination thread rather than inside any worker lane.
- Update the relevant row whenever a worker reports a status transition.
- Do not treat the worker report template as optional; use it to keep branch, worktree, acceptance, and review state comparable across lanes.
- Keep `AGENTS.md`, `meta/remediation_tracker_v1.json`, and `meta/REDESIGN_PLAN.md` out of worker implementation churn; only touch them during closeout after code and acceptance are stable.
- Open `codex/idea-engine-evolution` only after one open-now lane reaches `reviewing` or `merge_ready`, unless a new checked-in plan explicitly changes the gate.

#### Coordination gates

Worker lanes do not need to return to the coordinator after every chat turn. They should advance locally inside their owned scope until they hit one of the coordination gates below.

Workers must report back to the coordinator when any of the following happens:

- `plan_ready`: the lane has a concrete plan and is ready for implementation
- `blocked`: a real blocker prevents safe forward progress
- `scope_change_needed`: owned paths or initial scope are no longer sufficient
- `acceptance_passed`: implementation is complete and lane acceptance is green
- `reviewing`: formal review has started
- `merge_ready`: the lane is ready for rebase / merge sequencing
- `governance_touch_requested`: the lane is about to edit `AGENTS.md`, `meta/remediation_tracker_v1.json`, or `meta/REDESIGN_PLAN.md`

This keeps worker lanes autonomous during normal execution, while still forcing explicit coordination at the points where scope, governance, review, or merge order can drift.

#### Worker reminder obligation

Each active worker lane should treat the coordination gates above as a mandatory reminder contract:

- when a gate is reached, emit a status report using the shared worker template
- if the gate is `blocked`, `scope_change_needed`, `merge_ready`, or `governance_touch_requested`, stop and wait for coordinator direction before proceeding
- if the gate is `plan_ready`, `acceptance_passed`, or `reviewing`, report immediately and continue only if no coordinator intervention is required by the lane's scope rules

The coordinator should not have to infer from silence whether a lane is ready for review, merge sequencing, or scope reallocation. Active worker threads are responsible for surfacing those transitions explicitly.

#### Default auto-advance rule

Inside a worker lane's approved scope, the default is to keep moving without waiting for per-step coordinator approval.

Unless a coordination gate is hit, a worker lane should automatically continue through:

- planning
- implementation
- lane acceptance
- bounded implementation commit
- formal review from the lane's own worktree

After each of those steps, the lane should report the reached gate if one applies, but it should not stop merely to ask whether it may perform the next in-scope step.

The worker must stop and wait only when:

- a coordination gate explicitly requires coordinator direction
- a governance-file edit is the next step
- a cross-lane path conflict appears
- the lane needs scope expansion or merge sequencing

#### Commit and review preconditions

Worker lanes must not treat acceptance, formal review, and governance closeout as a single step.

- After lane acceptance passes, create a bounded implementation commit for the accepted first deliverable before requesting governance sync.
- Formal review must run from the lane's own worktree context, or otherwise use source packets that explicitly point at that lane's worktree paths. Do not launch formal review from `/Users/fkg/Coding/Agents/autoresearch-lab` when the implementation lives in a sibling worktree.
- A source-access failure caused by launching review from the wrong worktree is a coordination/setup failure, not a substantive blocking verdict on the implementation itself.
- `merge_ready` should normally mean: bounded implementation commit exists, acceptance is green, and formal review has either converged or is ready to rerun from the correct worktree context without further code changes.
- Governance-file edits (`AGENTS.md`, `meta/remediation_tracker_v1.json`, `meta/REDESIGN_PLAN.md`) remain closeout-only after the implementation commit exists and the lane has cleared the correct-worktree review gate.

## Verification Notes

- This plan is documentation-only.
- It does not add or modify runtime contracts.
- It does not define any new schema or tool surface.
- It does not change the dependency graph by itself.

The planning assumptions were rechecked immediately before writing:

- `main` was clean
- `git worktree list` showed only the main repo and `/Users/fkg/Coding/Agents/autoresearch-nds`
- the tracker still marked the five Wave 1 seeds as ready or design-ready in the dependency shape used by this plan

## Assumptions

- The current clean `main` state remains the integration baseline while Wave 1 begins.
- No hidden local worktrees exist outside `git worktree list`.
- `EVO-09` and `EVO-11` should advance on `idea-engine`, not as new Python `idea-core` authority, because the live TS `search.step` surface already exists and `NEW-05a Stage 3` is tracked as complete.
- The first goal is mergeable acceleration, not maximizing the raw number of simultaneously open branches.

## Launch Checklist

- Create the lane branch with the planned `codex/` prefix.
- Create the sibling worktree under `/Users/fkg/Coding/Agents/`.
- Confirm the new worktree starts clean before any edits.
- Restrict edits to the lane's owned paths for the initial branch.
- Keep the first branch scoped to the lane's initial deliverable only.
- Leave governance files for the lane's closeout commit unless an early correction is absolutely required.
