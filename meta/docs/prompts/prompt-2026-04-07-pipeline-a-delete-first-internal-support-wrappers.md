# Prompt: 2026-04-07 Pipeline A Delete-First Internal Support Wrappers

## Why this lane exists now

The installable public `hepar` / `hep-autoresearch` shell has already been narrowed to exactly one public command, `run`. A smaller follow-up queue remains inside the internal full parser, but not all residue is equal:

- some commands still carry live workflow semantics or are still named in active contract / protocol / eval surfaces (`doctor`, `bridge`, `literature-gap`, `paper_reviser`, `method-design`, `run-card`, `branch`);
- a narrower group now survives mainly as legacy command wrappers while the still-valuable authority already lives in lower-level artifacts/toolkits/tests.

This lane only deletes that second group:

- `approvals`
- `report`
- `logs`
- `context`
- `smoke-test`
- `propose`
- `skill-propose`
- `migrate`

The goal is to shrink legacy shell authority without reopening compatibility paths or dragging in the harder workflow-bearing residues.

## Primary objective

Land a bounded delete-first closeout where:

1. the internal full parser no longer exposes the eight wrapper commands above;
2. any still-needed lower-level authority remains available through its real owner surface rather than a legacy shell wrapper;
3. tests, authority maps, plan, and tracker truth all match the narrower post-delete reality;
4. no Python compatibility shell or fallback surface is reintroduced.

## Hard boundaries

1. Do not widen into `doctor`, `bridge`, `literature-gap`, `paper_reviser`, `method-design`, `run-card`, or `branch`.
2. Do not revive installable public shell inventory beyond the current exact truth: public shell still exposes only `run`.
3. Delete command wrappers, not the still-live lower-level authority that they call into.
4. Historical prompts / deep-refactor notes are not live authority by themselves; only update checked-in SSOT or front-door/current docs when they still describe current truth.

## Source-grounded surfaces to inspect before editing

Implementation:

- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`

Tests / authority / docs:

- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `packages/hep-autoresearch/tests/test_approval_packet.py`
- `packages/hep-autoresearch/tests/test_report_renderer.py`
- `packages/hep-autoresearch/tests/test_evolution_proposal.py`
- `packages/hep-autoresearch/tests/test_evolution_trigger.py`
- `packages/hep-autoresearch/tests/test_migrate.py`
- `packages/hep-autoresearch/tests/test_mcp_doctor_and_bridge_cli.py`
- `meta/front_door_authority_map_v1.json`
- `scripts/lib/front-door-authority-map.mjs`
- `scripts/lib/front-door-boundary-authority.mjs`
- `packages/hep-autoresearch/README.md`
- `packages/hep-autoresearch/README.zh.md`
- `packages/hep-autoresearch/docs/EVOLUTION.zh.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.zh.md`
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`

## Source-grounded expectations

- `approvals` / `report` / `logs` / `context` / `smoke-test` are currently internal parser verbs, but the durable authority is the approval packet/report/context/tooling layer, not the shell wrapper itself.
- `propose` / `skill-propose` are wrappers around evolution / skill proposal generation; the durable authority is the lower-level proposal logic and its tests, not the CLI verb.
- `migrate` already has direct toolkit-level tests and should not need a shell wrapper to remain testable.
- `test_approval_packet.py` currently imports `cmd_approvals_show`; this lane must re-home or remove that wrapper-level assumption rather than leaving dead imports behind.
- `meta/REDESIGN_PLAN.md` still contains at least one stale acceptance line that says ``hepar approvals show`` + ``hepar report render`` should be available; this lane must correct that SSOT drift.

## Recommended implementation sequence

1. Remove parser registration and wrapper implementations for the eight commands from `orchestrator_cli.py`.
2. Re-home any wrapper-coupled tests to the actual lower-level authority they are meant to validate.
3. Update authority maps and boundary helpers so these commands no longer appear as surviving internal full-parser residue.
4. Tighten current docs / plan / tracker truth to reflect that these wrappers are gone, while explicitly leaving the harder workflow-bearing residues untouched.
5. Run targeted acceptance plus formal review/self-review before closeout.

## Non-goals

- no change to installable public `run`
- no deletion of `doctor`, `bridge`, `literature-gap`, `paper_reviser`, `method-design`, `run-card`, `branch`
- no broader Pipeline A retire-all claim
- no runtime structural work (`DelegatedRuntimeHandleV1`, permission profile, transport)

## Acceptance

- `git diff --check`
- `python3 -m pytest -q packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `python3 -m pytest -q packages/hep-autoresearch/tests/test_approval_packet.py packages/hep-autoresearch/tests/test_report_renderer.py packages/hep-autoresearch/tests/test_evolution_proposal.py packages/hep-autoresearch/tests/test_evolution_trigger.py packages/hep-autoresearch/tests/test_migrate.py packages/hep-autoresearch/tests/test_mcp_doctor_and_bridge_cli.py`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`

## Formal review packet requirements

Review packet must include at minimum:

- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `packages/hep-autoresearch/tests/test_approval_packet.py`
- `packages/hep-autoresearch/tests/test_report_renderer.py`
- `packages/hep-autoresearch/tests/test_evolution_proposal.py`
- `packages/hep-autoresearch/tests/test_evolution_trigger.py`
- `packages/hep-autoresearch/tests/test_migrate.py`
- `packages/hep-autoresearch/tests/test_mcp_doctor_and_bridge_cli.py`
- `meta/front_door_authority_map_v1.json`
- `scripts/lib/front-door-authority-map.mjs`
- `scripts/lib/front-door-boundary-authority.mjs`
- `packages/hep-autoresearch/docs/EVOLUTION.zh.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.zh.md`
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`

Reviewers must explicitly challenge:

1. whether any deleted wrapper still carries live authority that was not re-homed;
2. whether docs/tests/authority maps still mention these wrappers as current truth;
3. whether this lane accidentally widens into the workflow-bearing residues that are intentionally out of scope.

## Self-review focus

Before closeout, self-review must confirm:

1. no deleted wrapper name remains on the parser or authority map by accident;
2. lower-level approval/report/context/proposal/migrate authority still has real test coverage after wrapper deletion;
3. current SSOT no longer promises `hepar approvals show` / `hepar report render`;
4. the lane stayed delete-first and did not sneak in a new compatibility shim.
