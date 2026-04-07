# Prompt: 2026-04-07 Idea-Map Delete + Idea-Engine Discovery Authority Rebaseline

## Why this lane exists now

Current `main` already moved the installable public idea path to TS-first `idea-engine`/`idea-mcp`, and the user explicitly rejected any plan that keeps Python or legacy fallback as a compatibility backend.

Two stale surfaces still lag behind that repo truth:

1. `packages/shared/src/graph-viz/` still ships an `idea-map` adapter/export/test surface even though no current generic/public authority depends on an Idea Map rendering layer.
2. `packages/hep-autoresearch/.../agent_cards/idea-engine.json` still advertises a wider lifecycle/node/ranking capability set than the live TS public host can actually serve.

If we leave these in place, the repo continues to over-advertise dead or unsupported authority.

## Primary objective

Land a bounded closeout where:

1. `idea-map` is removed from live shared graph-viz implementation/export/test surfaces.
2. the checked-in `idea-engine` discovery card advertises only the live TS public capability set.
3. plan/docs/tracker truth explicitly matches the new repo reality.

## Hard boundaries

1. Do not preserve `idea-map` as a compatibility shim, deprecated export, or internal fallback.
2. Do not reopen Python `idea-core` lifecycle parity or OpenRPC retire-all in this lane.
3. Do not widen into orchestrator runtime seams or Pipeline A support-surface retirement beyond directly required SSOT sync.
4. Keep the authority claim exact: this lane is about deleting dead idea-map surface and tightening discovery truth to match current TS host reality.

## Source-grounded surfaces to touch

Implementation:

- `packages/shared/src/graph-viz/adapters/idea-map.ts`
- `packages/shared/src/graph-viz/index.ts`
- `packages/shared/src/__tests__/graph-viz.test.ts`
- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/agent_cards/idea-engine.json`
- `packages/rep-sdk/tests/discovery-agent-card.test.ts`

Front-door / SSOT:

- `meta/docs/graph-visualization-layer.md`
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`
- `.serena/memories/architecture-decisions.md` only if a stable invariant emerges beyond existing generic-first/no-compat rules

## Current live authority to respect

Current TS public idea host inventory is the exact set served by `packages/idea-mcp/src/tool-registry.ts`:

- `campaign.init`
- `campaign.status`
- `search.step`
- `eval.run`

Do not keep `campaign.topup`, `campaign.pause`, `campaign.resume`, `campaign.complete`, `node.get`, `node.list`, `node.promote`, or `rank.compute` in discovery-facing capability truth unless the current public TS host actually exposes them.

## Recommended implementation sequence

1. Delete the live `idea-map` adapter file and all remaining exports/tests that keep it reachable.
2. Tighten the live `idea-engine` agent card capability list to the exact TS public host surface.
3. Update rep-sdk discovery tests so the checked-in card fixture remains a strict anti-drift gate.
4. Rebaseline graph-viz design docs and tracker/plan notes from “5 adapters including Idea Map” to the current “4 active adapters; idea-map retired” truth.
5. Record a new architecture decision only if it is genuinely cross-session and not already covered by root no-compat / exact-authority rules.

## Acceptance

- `git diff --check`
- `pnpm --filter @autoresearch/shared test`
- `pnpm --filter @autoresearch/shared build`
- `pnpm --filter @autoresearch/rep-sdk test -- tests/discovery-agent-card.test.ts tests/discovery-agent-registry.test.ts`
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/hep-autoresearch/tests/test_agent_registry.py packages/hep-autoresearch/tests/test_a2a_adapter.py -q`
- `pnpm --filter @autoresearch/idea-mcp test -- tests/tool-registry.test.ts tests/rpc-client.test.ts tests/rpc-client.integration.test.ts`

## Formal review packet requirements

Review packet must include:

- shared deletion surfaces:
  - `packages/shared/src/graph-viz/index.ts`
  - `packages/shared/src/__tests__/graph-viz.test.ts`
  - deleted `packages/shared/src/graph-viz/adapters/idea-map.ts`
- discovery truth surfaces:
  - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/agent_cards/idea-engine.json`
  - `packages/rep-sdk/tests/discovery-agent-card.test.ts`
  - `packages/idea-mcp/src/tool-registry.ts`
  - `packages/idea-mcp/tests/rpc-client.test.ts`
  - `packages/idea-mcp/tests/rpc-client.integration.test.ts`
- front-door / SSOT surfaces:
  - `meta/docs/graph-visualization-layer.md`
  - `meta/REDESIGN_PLAN.md`
  - `meta/remediation_tracker_v1.json`

Reviewers must explicitly challenge:

1. whether any live shared/public call path still requires `idea-map`,
2. whether the discovery card now exactly matches the TS public host truth,
3. whether docs/tracker still over-claim deleted or unsupported capability surfaces.

## Self-review focus

Before closeout, self-review must confirm:

1. no compatibility/fallback residue was reintroduced for `idea-map`,
2. discovery capability truth is exact rather than aspirational,
3. the lane did not silently widen into Python parity or broader idea-core retirement,
4. plan/tracker/doc wording is consistent with current code and tests.
