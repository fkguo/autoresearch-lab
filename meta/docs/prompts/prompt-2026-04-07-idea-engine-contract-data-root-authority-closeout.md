# Prompt: 2026-04-07 Idea-Engine Contract/Data-Root Authority Closeout

## Why this lane exists now

`main` already removed `idea-map` as a live shared authority surface and tightened the public `idea-engine` capability inventory to the TS-hosted set. Two smaller but still real authority leaks remain:

1. the checked-in `idea-engine` discovery card still points its OpenRPC authority at `packages/idea-core/...`, which keeps legacy Python package layout in the discovery contract story even though TS `idea-engine` is now the only public host authority;
2. `idea-mcp` still silently defaults its data root to repo-local `packages/idea-engine/runs`, which conflicts with the repo rule that real-project runtime state must fail closed away from the development monorepo.

This lane closes those leaks without reopening broader `idea-core` retire-all or deeper runtime redesign.

## Primary objective

Land a bounded closeout where:

1. `idea-engine` discovery contract authority points to the TS-owned contract path, not `idea-core`;
2. `idea-mcp` refuses to run without an explicit `IDEA_MCP_DATA_DIR`, and rejects repo-local paths under this dev monorepo;
3. tests, plan, and tracker truth all match the stricter generic-first boundary.

## Hard boundaries

1. Do not widen into contract-id renaming (`idea_core_rpc_v1` can stay as an internal identifier in this lane).
2. Do not reopen Python `idea-core` runtime parity or broader `idea-engine` capability changes.
3. Do not widen into orchestrator runtime seams, REP transport, or Pipeline A deletion beyond SSOT sync directly required by this lane.
4. Keep the change fail-closed: no replacement repo-local fallback, no compatibility env knob, no silent default state directory.

## Source-grounded surfaces to touch

Implementation:

- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/agent_cards/idea-engine.json`
- `packages/idea-mcp/src/server.ts`
- `packages/idea-mcp/src/rpc-client.ts`

Tests / anti-drift:

- `packages/idea-mcp/tests/server.test.ts`
- `packages/idea-mcp/tests/rpc-client.test.ts` only if constructor semantics need direct locking
- `packages/rep-sdk/tests/discovery-agent-card.test.ts`
- `packages/hep-autoresearch/tests/test_agent_registry.py`

SSOT:

- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`
- `.serena/memories/architecture-decisions.md` only if a stable cross-session invariant emerges beyond current root rules

## Current live authority to respect

- The live TS public idea host surface remains exactly: `campaign.init`, `campaign.status`, `search.step`, `eval.run`.
- TS contract authority already exists under `packages/idea-engine/contracts/idea-generator-snapshot/schemas/idea_core_rpc_v1.openrpc.json`.
- `idea-mcp` is TS-host-only and must not recreate repo-local runtime-state authority by default.

## Recommended implementation sequence

1. Repoint the `idea-engine` agent card `source_path` and wording to the TS-owned contract path.
2. Make `resolveIdeaDataDir()` fail closed when `IDEA_MCP_DATA_DIR` is absent.
3. Add a repo-root containment guard so `IDEA_MCP_DATA_DIR` cannot resolve inside `/Users/fkg/Coding/Agents/autoresearch-lab`.
4. Remove the repo-local default root from `IdeaRpcClient`, requiring explicit `rootDir` from callers/tests.
5. Update tests and SSOT notes to reflect the stricter contract/data-root truth.

## Acceptance

- `git diff --check`
- `pnpm --filter @autoresearch/idea-mcp test -- tests/server.test.ts tests/rpc-client.test.ts tests/rpc-client.integration.test.ts tests/tool-registry.test.ts`
- `pnpm --filter @autoresearch/idea-mcp build`
- `pnpm --filter @autoresearch/rep-sdk test -- tests/discovery-agent-card.test.ts tests/discovery-agent-registry.test.ts`
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/hep-autoresearch/tests/test_agent_registry.py -q`

## Formal review packet requirements

Review packet must include:

- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/agent_cards/idea-engine.json`
- `packages/idea-mcp/src/server.ts`
- `packages/idea-mcp/src/rpc-client.ts`
- `packages/idea-mcp/tests/server.test.ts`
- `packages/rep-sdk/tests/discovery-agent-card.test.ts`
- `packages/hep-autoresearch/tests/test_agent_registry.py`
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`

Reviewers must explicitly challenge:

1. whether discovery contract authority still leaks back to `idea-core`,
2. whether any repo-local default run root survived on the public `idea-mcp` path,
3. whether the lane stayed bounded away from broader contract-id rename / capability-surface redesign.

## Self-review focus

Before closeout, self-review must confirm:

1. the TS-owned contract path is now the only discovery authority claimed by the card,
2. `idea-mcp` truly fails closed without explicit external state location,
3. tests lock both the stricter data-root rule and the agent-card authority path,
4. plan/tracker wording stays consistent with the code and acceptance evidence.
