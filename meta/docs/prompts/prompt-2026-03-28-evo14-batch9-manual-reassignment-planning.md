# EVO-14 Batch 9 — Explicit Manual Reassignment Planning

## Intent

This is a governance/planning prompt that locks the next bounded `EVO-14` implementation slice after Batch 8.

Batch 9 should stay **manual reassignment only**:

- add one explicit same-project reassignment surface for a currently claimed queue item
- keep queue truth, worker truth, scheduler truth, and intervention truth separate
- leave broader lifecycle automation as a later planning question rather than smuggling it into this slice

## Scope

The smallest credible Batch 9 is:

- add one explicit mutation tool, tentatively `orch_fleet_reassign_claim`
- allow an operator to move a **currently claimed** queue item from one **current explicit owner worker** to one **explicit target worker**
- keep all mutation within one `project_root`
- keep `orch_fleet_status` as the only cross-root read surface
- reuse existing `fleet_queue_v1` + `fleet_workers_v1` authority instead of creating a new fleet file or new scheduler surface

Batch 9 must not broaden into generic lifecycle automation. It only closes the bounded operator handoff gap that still remains after:

- Batch 4 manual stale-claim adjudication
- Batch 6 explicit lease authority
- Batch 7 worker claim-acceptance gate
- Batch 8 drained-worker unregister

## Hard No-Go

Explicitly forbidden in Batch 9:

- auto takeover
- auto reassignment
- daemonized scheduling
- central tick or hidden sweep
- second fleet authority file
- second cross-root fleet mutation surface
- reopening `EVO-13` team-local runtime semantics
- `EVO-15` / community / publication / multi-instance work
- bulk drain orchestration, drain plans, or multi-item migration workflows
- scheduler-selected target workers, score-based target ranking, or capability matching
- deriving reassignment truth from `state.json`, `ledger.jsonl`, `team-execution-state.json`, `live_status`, or `replay`

## Required Reads

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `.serena/memories/architecture-decisions.md`
5. `meta/docs/prompts/prompt-2026-03-22-evo14-batch2-queue-claim-substrate.md`
6. `meta/docs/prompts/prompt-2026-03-22-evo14-batch3-worker-poll-heartbeat-resource-slots.md`
7. `meta/docs/prompts/prompt-2026-03-22-evo14-batch4-manual-stale-claim-adjudication.md`
8. `meta/docs/prompts/prompt-2026-03-22-evo14-batch5-operator-stale-signal-status-audit-contract.md`
9. `meta/docs/prompts/prompt-2026-03-22-evo14-batch6-lease-authority-explicit-expiry-contract.md`
10. `meta/docs/prompts/prompt-2026-03-22-evo14-batch7-worker-claim-acceptance-gate.md`
11. `meta/docs/prompts/prompt-2026-03-23-evo14-batch8-worker-unregister-contract.md`
12. current orchestrator / hep-mcp fleet queue / worker / status source and adjacent tests

## Preflight

Before implementation, re-confirm the already locked `EVO-14` invariants:

- queue truth lives only in `.autoresearch/fleet_queue.json`
- worker/resource truth lives only in `.autoresearch/fleet_workers.json`
- lease authority lives only in queue claim records
- scheduler truth remains transient `orch_fleet_worker_poll` behavior only
- cross-root fleet visibility remains `orch_fleet_status` only
- intervention truth remains explicit tool call plus queue mutation plus audit ledger event, not a second persisted intervention file

## Authority Map

- Queue truth authority: `.autoresearch/fleet_queue.json`
- Worker/resource truth authority: `.autoresearch/fleet_workers.json`
- Lease authority: `items[].claim` inside `.autoresearch/fleet_queue.json`
- Scheduler truth authority: transient `orch_fleet_worker_poll` behavior only
- Existing intervention truth:
  - `orch_fleet_adjudicate_stale_claim`
  - `orch_fleet_worker_set_claim_acceptance`
  - `orch_fleet_worker_unregister`
- Batch 9 intervention addition:
  - explicit `orch_fleet_reassign_claim` only

Batch 9 must not create:

- `fleet_reassignments.json`
- `fleet_lifecycle.json`
- `scheduler_state.json`
- a second cross-root mutation tool

## Contract Locks

### Reassignment surface

Batch 9 should add exactly one new mutation surface:

- `orch_fleet_reassign_claim`

Tentative input contract:

- `project_root`
- `queue_item_id`
- `expected_claim_id`
- `expected_owner_id`
- `target_worker_id`
- `reassigned_by`
- `note`

### Required behavior

The new tool must:

- fail closed unless the queue item is currently `claimed`
- fail closed unless `expected_claim_id` and `expected_owner_id` exactly match the live queue truth
- fail closed unless the current owner worker still exists in `.autoresearch/fleet_workers.json`
- fail closed unless the target worker exists in `.autoresearch/fleet_workers.json`
- fail closed if `target_worker_id === expected_owner_id`
- fail closed unless the target worker has `accepts_claims = true`
- derive target worker active-claim pressure only from `.autoresearch/fleet_queue.json`
- fail closed if the target worker is already at capacity under existing worker-slot truth
- mutate only `.autoresearch/fleet_queue.json`
- append one audit-only ledger event
- avoid all worker-registry mutation
- avoid requeue / release / terminal settle semantics
- avoid target auto-selection or scheduler-like ranking

### Claim mutation contract

Reassignment should stay inside queue truth by replacing the live claim record on the same queue item:

- queue item remains `claimed`
- `attempt_count` remains unchanged
- priority / deterministic ordering fields remain unchanged
- a new `claim_id` is minted
- `owner_id` becomes `target_worker_id`
- `claimed_at` resets to reassignment time
- `lease_duration_seconds` is preserved from the existing live claim
- `lease_expires_at` is recomputed from the preserved duration and new reassignment time

Batch 9 must not change the checked-in queue/worker JSON schema shapes unless implementation evidence proves the current schemas are insufficient. The planning default is:

- no new JSON schema authority
- no codegen
- no queue or worker file shape expansion

### Audit contract

Add one new audit-only ledger event, tentatively:

- `fleet_claim_reassigned`

Its details should at least include:

- `queue_item_id`
- `prior_claim_id`
- `prior_owner_id`
- `new_claim_id`
- `new_owner_id`
- `lease_duration_seconds`
- `reassigned_by`
- `note`

### Read-model boundary

`orch_fleet_status` remains the only cross-root read surface.

Batch 9 should not add a second read tool or a second lifecycle snapshot. The default planning boundary is:

- no `orch_fleet_status` shape change beyond the already visible current owner/lease truth that naturally follows from queue mutation
- no reassignment counters
- no reassignment history surface outside the existing ledger audit path

## Boundary Clarification

To keep responsibilities separated:

- queue truth answers: which queue item is claimed, by whom, under which lease
- worker truth answers: which workers exist, whether they accept new claims, and what capacity they advertise
- scheduler truth answers only: how `orch_fleet_worker_poll` renews/sweeps/claims under existing authority
- intervention truth answers only: which explicit operator command mutated queue truth and what audit event it emitted

Batch 9 is valid only if it keeps those four questions separate.

## Out Of Scope After Batch 9

Still explicitly out of scope after Batch 9:

- automation that picks a target worker for the operator
- automation that drains a worker by sweeping multiple queue items
- lifecycle daemons, schedulers, watchers, or auto-heal loops
- automatic reassignment on lease expiry, heartbeat loss, unregister, or claim-acceptance shutdown
- cross-root queue mutation orchestration
- worker-pool or fleet-wide balancing policy
- any `EVO-15` community/publication substrate

Broader lifecycle automation, if it is ever planned later, must remain a separate bounded follow-up after Batch 9 rather than being treated as implicitly authorized by manual reassignment.

## Expected Affected Files

Planning expectation for the later implementation lane:

- `meta/docs/prompts/prompt-2026-03-28-evo14-batch9-manual-reassignment-planning.md`
- `meta/remediation_tracker_v1.json`
- `meta/REDESIGN_PLAN.md`
- `packages/shared/src/tool-names.ts`
- `packages/orchestrator/src/orch-tools/{schemas.ts,fleet-tool-specs.ts,fleet-queue-tools.ts}` or a narrowly scoped new reassignment helper
- `packages/orchestrator/tests/{orch-fleet-claim.test.ts,orch-fleet-worker-poll.test.ts,orch-fleet-worker-unregister.test.ts}` plus a dedicated reassignment regression file if needed
- `packages/hep-mcp/src/{tool-names.ts,tool-risk.ts}`
- `packages/hep-mcp/tests/contracts/{orchFleetQueue.test.ts,orchFleetWorkerPoll.test.ts}` plus a dedicated reassignment contract file if needed
- `packages/hep-mcp/tests/toolContracts.test.ts`

## Acceptance

For this planning lane:

1. `git diff --check`
2. `python3 -m json.tool meta/remediation_tracker_v1.json >/dev/null`
3. `rg -n "EVO-14|Batch 9|manual reassignment|reassignment|takeover|daemon|second authority|cross-root" meta/REDESIGN_PLAN.md meta/remediation_tracker_v1.json meta/docs/prompts/prompt-2026-03-28-evo14-batch9-manual-reassignment-planning.md`
4. `git diff --name-only -- packages` must stay empty

For the later implementation lane, acceptance must be defined afresh in the implementation prompt rather than silently inherited from this planning-only lane.

## Review-Swarm Packet Assumptions

Formal reviewers must re-check, not trust, these assumptions:

1. Batch 9 is explicit manual reassignment only, not broader lifecycle automation.
2. Queue truth still lives only in `.autoresearch/fleet_queue.json`.
3. Worker truth still lives only in `.autoresearch/fleet_workers.json`.
4. Scheduler truth still lives only in transient `orch_fleet_worker_poll` behavior.
5. Manual reassignment target selection is operator-supplied, not scheduler-derived.
6. Missing/stale current-owner cases remain Batch 4 adjudication territory rather than being silently absorbed into Batch 9.
7. No daemon, no takeover, no second authority file, and no second cross-root mutation surface appear.

Formal review lineup for this lane and its future implementation closeout is:

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

## Self-Review Checklist

1. Reassignment mutates only queue claim truth and audit ledger output.
2. Worker registry remains validation input only, not a second mutation target.
3. The target worker is explicit and validated, never auto-selected.
4. Lease authority stays on the queue claim record before and after reassignment.
5. Stale/missing-owner recovery remains distinct from manual reassignment.
6. No broader lifecycle automation was smuggled into the slice.

## Closeout Sync

- `meta/remediation_tracker_v1.json`: keep `EVO-14` as `in_progress`, record Batch 9 as the next bounded slice, and keep broader lifecycle automation explicitly later
- `meta/REDESIGN_PLAN.md`: mark Batch 9 planning/design as locked without claiming implementation done
- `.serena/memories/architecture-decisions.md`: update only if a truly new stable cross-session invariant emerges during implementation closeout
- `AGENTS.md`: no change expected unless phase summary or root governance truth changes

## Version Control Gate

- Do not `git commit`, `git push`, or merge without fresh human authorization.
- If a future implementation lane is authorized, this canonical Batch 9 prompt must ship with that implementation work rather than being recreated ad hoc.
