# Prompt: 2026-04-07 Next Batch — Idea-Engine Default-Host Authority First Cut

> Status note (later on 2026-04-07): this prompt is a historical first-cut packet only. Current repo truth has since advanced one step further: installable `idea-mcp` is now TS-only, the public Python compatibility backend/fallback path is deleted, and `IDEA_MCP_BACKEND` / `IDEA_CORE_PATH` must fail closed. Do not reuse this prompt to reintroduce compatibility semantics.

## Why this lane exists now

Current generic-first sequencing already moved `idea-engine default-host authority first cut` into the immediate batch (`Seam D`) instead of the later structural runtime seams.

Source-grounded current truth:

- `idea-mcp` still defaults to spawning Python `idea-core` (`resolveIdeaCorePath()` + `IdeaRpcClient` spawning `uv run python -m idea_core.rpc.server`):
  - `packages/idea-mcp/src/server.ts`
  - `packages/idea-mcp/src/rpc-client.ts`
- TS `idea-engine` already owns live RPC handling for:
  - `campaign.init`
  - `search.step`
  - `eval.run`
  - `rank.compute`
  - `node.promote`
  via:
  - `packages/idea-engine/src/service/rpc-service.ts`
  - `packages/idea-engine/src/service/post-search-service.ts`
- `idea-mcp` public tool inventory still exposes extra campaign lifecycle methods (`campaign.topup/pause/resume/complete`) that are not yet aligned with current TS-host authority:
  - `packages/idea-mcp/src/tool-registry.ts`
  - `packages/idea-mcp/tests/rpc-client.integration.test.ts` already asserts `campaign.pause` fails on current backend.

If this mismatch is deferred, legacy Python path remains the default host authority and public method inventory continues to drift away from the TS control-plane direction.

This lane is therefore a **first cut to lock default host authority and public method inventory**, not a full `idea-core retire-all`.

## Primary objective

Deliver a bounded first-cut alignment where:

1. default host authority for active public idea path points to TS `idea-engine`/`idea-mcp` direction rather than implicit Python `idea-core` default.
2. public `idea-mcp` method/tool inventory matches what current default host authority can actually serve.
3. any retained Python path is explicit compatibility/fallback, not silent default authority.

## Hard authority boundaries

1. Do not claim full `idea-core` retirement in this lane.
2. Do not widen into orchestrator runtime/fleet/session redesign.
3. Do not silently keep public methods that are “declared live but default backend cannot serve”.
4. Keep generic-first framing: this lane is about default host authority correctness, not domain-specific feature expansion.

## Non-goals

- no full `idea-core` package deletion
- no one-shot migration of every historical idea RPC method
- no broad shared package authority rewrite beyond directly related inventory alignment
- no reopen of unrelated `M-22`/Pipeline-A retirement slices

## Source-grounded surfaces to inspect/touch

Core runtime/host surfaces:

- `packages/idea-mcp/src/server.ts`
- `packages/idea-mcp/src/rpc-client.ts`
- `packages/idea-mcp/src/tool-registry.ts`
- `packages/idea-engine/src/service/rpc-service.ts`
- `packages/idea-engine/src/service/post-search-service.ts`

Shared seam to reassess (only if directly required by authority alignment):

- `packages/shared/src/tool-names.ts`

Likely adjacent tests/docs:

- `packages/idea-mcp/tests/rpc-client.integration.test.ts`
- `packages/idea-mcp/tests/tool-registry.test.ts`
- `packages/idea-engine/tests/post-search-rpc.test.ts`
- `packages/idea-engine/tests/{write-rpc-parity.test.ts,search-step-parity.test.ts,read-rpc-parity.test.ts}` (if touched behavior crosses read/write/search ownership)

## Recommended implementation sequence (bounded)

1. **Authority baseline audit**
   - Enumerate current default-host path and currently declared public methods.
   - Produce a concise method matrix: `declared public` vs `served by TS default host` vs `compat-only`.
2. **Default host first-cut switch/alignment**
   - Make default-host authority explicit toward TS path (implementation choice can vary: direct TS host, explicit backend selector with TS default, or equivalent).
   - Ensure Python backend remains opt-in compatibility path if still needed.
3. **Public method inventory first-cut alignment**
   - Align `idea-mcp` tool registry and RPC exposure with default authority.
   - For unsupported lifecycle methods, choose one and encode it explicitly:
     - remove from public inventory in this cut, or
     - retain as explicit compatibility-only methods with clear guard/error semantics and tests.
4. **Guardrails/tests/docs**
   - Add/adjust tests so future drift cannot reintroduce “declared public but default host unsupported”.
   - Update any directly impacted docs/comments to reflect first-cut scope truth.

## Acceptance (minimum)

Run at least:

- `git diff --check`
- `pnpm --filter @autoresearch/idea-engine build`
- `pnpm --filter @autoresearch/idea-engine test`
- `pnpm --filter @autoresearch/idea-mcp build`
- `pnpm --filter @autoresearch/idea-mcp test`

And include one explicit host-authority regression check that fails if default host path silently falls back to legacy Python authority without explicit configuration.

## Formal review packet requirements

Formal review must include:

1. host/default authority surfaces:
   - `packages/idea-mcp/src/server.ts`
   - `packages/idea-mcp/src/rpc-client.ts`
2. public inventory surfaces:
   - `packages/idea-mcp/src/tool-registry.ts`
   - related `idea-mcp` tests
3. TS authority surfaces:
   - `packages/idea-engine/src/service/rpc-service.ts`
   - `packages/idea-engine/src/service/post-search-service.ts`
   - relevant `idea-engine` RPC tests
4. shared seam (if touched):
   - `packages/shared/src/tool-names.ts`

Reviewers must explicitly challenge:

- whether default authority truly moved to TS path (not just wording changed),
- whether public method inventory and host capability are consistent,
- whether retained Python path is now explicit compatibility/fallback only.

## Self-review focus

Before closeout, self-review must confirm:

1. lane remains first-cut scoped (not over-claiming full retire-all),
2. default host authority is explicit and test-backed,
3. public method inventory no longer over-promises unsupported default methods,
4. no unrelated authority families were widened,
5. tracker/REDESIGN_PLAN wording can truthfully state “default-host first cut landed” without implying full legacy retirement.

## Why this is immediate-batch priority (not later)

This lane blocks clean generic-first progression for two reasons:

1. **authority correctness debt**: public `idea-mcp` inventory currently advertises methods not aligned with default served authority.
2. **host-path debt**: default still points to legacy Python path while TS engine already carries core live RPC responsibilities.

Delaying this keeps a known split-brain authority at the public host boundary, which is riskier than deferring deeper runtime-handle/transport/permission-lattice work.

## SOTA alignment note (bounded)

Use mature runtime layering only as boundary guidance:

- Codex keeps canonical runtime/session authority explicit instead of letting projection paths become silent authority.
- Claude Code keeps permission/session behavior explicit at agent/run boundaries rather than implicit wrapper drift.

Apply that lesson narrowly here: explicit default host authority + explicit public method inventory contract.
