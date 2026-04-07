# Prompt: 2026-04-07 RuntimePermissionProfileV1 First Slice

## Why this lane exists now

The current runtime structural order is now source-grounded and partially landed:

`DelegatedRuntimeHandleV1 -> RuntimePermissionProfileV1 -> DelegatedRuntimeTransport`

`DelegatedRuntimeHandleV1` is now in the codebase. The next real structural gap is permission compile authority:

- `packages/orchestrator/src/team-execution-permissions.ts`
  - delegation matrix lookup, additive inheritance, and allowed-tool compilation are still entangled
- `packages/orchestrator/src/tool-execution-policy.ts`
  - `ToolPermissionView` still acts as both compiled view and de facto authority source
- `packages/orchestrator/src/mcp-client.ts`
  - enforcement reads `ToolPermissionView` directly at call time
- `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
  - runtime still receives a compiled tool view rather than a canonical permission profile
- `packages/orchestrator/src/orch-tools/agent-runtime.ts`
  - the direct non-team path still implicitly derives runtime visibility/policy without a shared profile seam

Without `RuntimePermissionProfileV1`, the next transport seam would only freeze today’s scattered matrix/view/wrapper semantics into a new layer.

## External source constraints that matter

These are already reflected in `meta/docs/plans/2026-04-07-runtime-structural-seams-deep-dive.md` and should be treated as design constraints for this lane:

- Borrow from Codex:
  - typed permission profiles with explicit scope/request/grant semantics are good
  - filesystem/network policy as typed compile authority is good
- Do **not** borrow from Codex:
  - forward-compat parser baggage / unknown-token complexity
- Borrow from Claude Code:
  - permission, agent runtime, and transport/session layers should stay separated
- Do **not** borrow from Claude Code:
  - mutable UI-centric permission stores (`alwaysAllowRules`, `alwaysDenyRules`, `alwaysAskRules`, prompt UX flags) do not belong in the control-plane core

## Primary objective

Land a bounded first cut where:

1. runtime permission becomes a typed internal compile source instead of being scattered across matrix/view/runtime inputs;
2. `ToolPermissionView` becomes a compiled runtime view, not the primary authority object;
3. delegated and direct runtime paths can both derive permissions from the same profile seam;
4. sandbox/network/approval fields have typed authority slots even if first-slice enforcement remains partial;
5. the change stays internal to orchestrator runtime/control-plane code with no public/team-view payload widening.

## Hard boundaries

1. Do not implement transport in this lane.
2. Do not widen into UI permission contexts, prompt-managed allow/deny rule stores, or interactive reviewer UX.
3. Do not add backward-compat shims, fallback profiles, or compatibility backends.
4. Do not promote transcript/job/turn/session-host objects into permission authority.
5. Do not widen public MCP/host payloads with runtime permission profile fields.
6. First slice may carry sandbox/network/approval metadata without enforcing every field end-to-end, but authority must no longer be prompt-only or wrapper-only.

## Expected contract shape

The first cut should stay close to:

```ts
interface RuntimePermissionProfileV1 {
  version: 1;
  actor: {
    scope: 'agent_session' | 'delegated_assignment';
    actor_id: string | null;
    source: 'host_runtime' | 'team_permission_matrix' | 'internal';
  };
  tools: {
    allowed_tool_names: string[];
    execution_policies: Record<string, ToolExecutionPolicy>;
    inheritance_mode: 'runtime_tools' | 'team_permission_matrix' | 'inherit_from_assignment';
    inherit_from_assignment_id?: string;
  };
  sandbox: {
    filesystem: null | {
      mode: 'inherit_host' | 'restricted';
      read_roots?: string[];
      write_roots?: string[];
    };
    network: null | {
      mode: 'inherit_host' | 'restricted' | 'enabled';
    };
  };
  approvals: {
    mode: 'inherit_gate' | 'request_explicit';
    grant_scope: 'session' | 'assignment';
    reviewer: string | null;
  };
}
```

Field names may adapt to existing repo types, but the semantic content above must not be lost.

## First-slice compile targets

The minimum useful compile chain for this lane is:

- `RuntimePermissionProfileV1 -> ToolPermissionView`
- `RuntimePermissionProfileV1 -> visible tools + execution policy filtering`
- `RuntimePermissionProfileV1 -> delegated approval/runtime scope metadata`
- `RuntimePermissionProfileV1 -> carry-only sandbox/network slots`

The goal is not “full sandbox implementation.” The goal is to stop letting those semantics live only in wrappers, matrices, or implicit runtime defaults.

## Source-grounded touch surface

Implementation:

- `packages/orchestrator/src/team-execution-permissions.ts`
- `packages/orchestrator/src/tool-execution-policy.ts`
- `packages/orchestrator/src/mcp-client.ts`
- `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
- `packages/orchestrator/src/team-unified-runtime-support.ts`
- `packages/orchestrator/src/orch-tools/agent-runtime.ts`
- `packages/orchestrator/src/team-execution-types.ts`
- new file expected:
  - `packages/orchestrator/src/runtime-permission-profile.ts`

Tests / supporting evidence:

- `packages/orchestrator/tests/team-unified-runtime.test.ts`
- `packages/orchestrator/tests/team-unified-runtime-sequential.test.ts`
- `packages/orchestrator/tests/team-unified-runtime-parallel-recovery.test.ts`
- `packages/orchestrator/tests/team-execution-runtime.test.ts`
- `packages/orchestrator/tests/orchestrator.test.ts`
- expected new focused tests:
  - `packages/orchestrator/tests/runtime-permission-profile.test.ts`
  - or equivalent focused coverage proving direct/delegated compilation
- `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`
- `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-sequential.test.ts`
- `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts`
- `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts`
- `meta/docs/plans/2026-04-07-runtime-structural-seams-deep-dive.md`
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`
- external architecture references for reviewer challenge only:
  - `../codex/codex-rs/app-server-protocol/src/protocol/v2.rs`
  - `../codex/codex-rs/protocol/src/permissions.rs`
  - `../claude-code-sourcemap/restored-src/src/Tool.ts`
  - `../claude-code-sourcemap/restored-src/src/tools/AgentTool/runAgent.ts`

## Recommended implementation sequence

1. Introduce `RuntimePermissionProfileV1` in a dedicated internal module.
2. Add a compiled-view helper:
   - `RuntimePermissionProfileV1 -> ToolPermissionView`
3. Rework delegated permission compilation so:
   - team permission matrix + inheritance resolve into `RuntimePermissionProfileV1`
   - `ToolPermissionView` is produced from that profile, not vice versa
4. Thread optional `runtime_permission_profile` through delegated runtime execution.
5. Add the same profile seam for the direct non-team runtime path without breaking existing behavior.
6. Keep sandbox/network/approval slots typed in the profile even if first-slice enforcement remains limited to current tool-view/runtime-gate behavior.
7. Add focused tests proving:
   - delegated and direct paths both compile from the new profile seam
   - tool visibility and fail-closed enforcement remain unchanged
   - no public/team-view payload widening occurs

## Non-goals

- no `DelegatedRuntimeTransport` yet
- no websocket/SSE/remote session semantics
- no mutable rule store or UI permission dialog model
- no fleet/lease/scheduler widening
- no public API / CLI / host payload changes
- no compatibility fallback path for old permission objects

## Acceptance

- `git diff --check`
- `pnpm --filter @autoresearch/orchestrator test -- tests/runtime-permission-profile.test.ts`
  - if the final test filename differs, include the exact focused test file(s) in the acceptance record
- `pnpm --filter @autoresearch/orchestrator test -- tests/team-unified-runtime.test.ts tests/team-unified-runtime-sequential.test.ts tests/team-unified-runtime-parallel-recovery.test.ts`
- `pnpm --filter @autoresearch/orchestrator test -- tests/team-execution-runtime.test.ts tests/orchestrator.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-sequential.test.ts tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts`

## Formal review packet requirements

Review packet must include at minimum:

- the new `RuntimePermissionProfileV1` type and compile helpers
- delegated permission compilation before/after authority flow
- direct runtime path before/after authority flow
- call-time enforcement seam in `mcp-client.ts`
- tests proving no public/team-view payload widening
- `meta/docs/plans/2026-04-07-runtime-structural-seams-deep-dive.md`
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`

Reviewers must explicitly challenge:

1. whether `RuntimePermissionProfileV1` is truly the typed compile source rather than another wrapper around `ToolPermissionView`;
2. whether direct and delegated runtime paths now share the same structural permission seam;
3. whether sandbox/network/approval fields became typed authority rather than prompt-only placeholders;
4. whether any public/team-view/host payload accidentally widened;
5. whether Codex/Claude-Code-inspired structure was adopted at the right abstraction level without importing compatibility/UI baggage.

## Self-review focus

Before closeout, self-review must confirm:

1. `ToolPermissionView` is now a compiled runtime view rather than the primary authority object.
2. direct runtime and delegated runtime both compile permissions from the same typed seam.
3. no permission semantics remain hidden only inside wrapper-local branching when they should live in the profile.
4. sandbox/network/approval slots exist as typed profile authority even if first-slice enforcement remains bounded.
5. the structural order still remains `DelegatedRuntimeHandleV1 -> RuntimePermissionProfileV1 -> DelegatedRuntimeTransport`.
