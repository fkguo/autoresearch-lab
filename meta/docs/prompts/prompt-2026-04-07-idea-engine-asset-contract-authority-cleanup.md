# Prompt: 2026-04-07 Idea-Engine Asset / Contract Authority Cleanup

## Why this lane exists now

Current repo truth already moved installable `idea-mcp` public hosting to TS-only `idea-engine`, and the legacy Python host fallback/env knobs are fail-closed. But the live TS runtime still back-references Python-side package assets for two authority seams:

- `packages/idea-engine/src/contracts/openrpc.ts`
  - default contract dir still points at `packages/idea-core/contracts/idea-generator-snapshot/schemas`
- `packages/idea-engine/src/service/hep-domain-pack.ts`
  - HEP builtin pack catalog still points at `packages/idea-core/src/idea_core/engine/hep_builtin_domain_packs.json`

That means the public/default host authority has moved, while part of the runtime asset/contract authority still quietly lives under legacy Python package paths.

This lane is the next bounded generic-first cut after host cleanup:

1. move runtime contract/default asset authority for live TS `idea-engine` into package-local TS-owned paths;
2. add fail-closed tests so future edits cannot silently reintroduce `idea-core` runtime back-references;
3. update plan/tracker truth so the next queue is no longer "host compatibility cleanup" but the later broader parity / retire-all closure.

## Primary objective

Deliver a bounded first cut where:

1. live TS `idea-engine` runtime no longer reads default contract or builtin pack assets from `packages/idea-core/**`;
2. the package-local TS-owned asset paths are explicit and test-backed;
3. plan/tracker/docs truth reflects that the remaining `idea-core` work is broader parity / retire-all cleanup, not lingering default asset authority.

## Hard boundaries

1. Do not reopen `idea-mcp` host-selection / compatibility-backend debate; that is already closed.
2. Do not widen public MCP inventory in this lane.
3. Do not claim full `idea-core retire-all`.
4. Do not move into orchestrator/runtime/fleet/session redesign.

## Source-grounded touch surface

- `packages/idea-engine/src/contracts/openrpc.ts`
- `packages/idea-engine/src/contracts/catalog.ts`
- `packages/idea-engine/src/service/hep-domain-pack.ts`
- `packages/idea-engine/tests/**` (new/updated anti-drift coverage)
- package-local asset directories created for TS-owned runtime authority
- `meta/docs/plans/2026-04-07-next-batch-generic-closure-plan.md`
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`
- `.serena/memories/architecture-decisions.md` only if a new stable invariant is actually introduced

## Recommended implementation sequence

1. Copy the currently consumed default contract snapshot into a package-local `idea-engine` authority path.
2. Copy the HEP builtin pack catalog into a package-local `idea-engine` authority path.
3. Repoint runtime source files to those package-local paths.
4. Add exact anti-drift tests proving runtime default authority no longer resolves through `packages/idea-core/**`.
5. Update checked-in planning/tracker truth from "asset authority follow-up pending" to the new narrower remainder.

## Acceptance

Run at least:

- `git diff --check`
- `pnpm --filter @autoresearch/idea-engine build`
- `pnpm --filter @autoresearch/idea-engine test`
- `pnpm --filter @autoresearch/idea-mcp build`
- `pnpm --filter @autoresearch/idea-mcp test`

And include one explicit regression check that fails if `idea-engine` runtime default contract/builtin asset paths point back into `packages/idea-core/**`.

## Formal review packet requirements

Formal review must include:

1. TS runtime asset/contract authority surfaces:
   - `packages/idea-engine/src/contracts/openrpc.ts`
   - `packages/idea-engine/src/contracts/catalog.ts`
   - `packages/idea-engine/src/service/hep-domain-pack.ts`
2. new or updated anti-drift tests
3. package-local copied asset/contract directories
4. plan/tracker closeout edits

Reviewers must challenge:

- whether live TS runtime really stopped consuming `idea-core` default asset/contract paths;
- whether this lane stayed bounded away from host inventory / public method expansion;
- whether any new duplicated authority was introduced without an explicit narrowed ownership claim.

## Self-review focus

Before closeout, self-review must confirm:

1. no runtime default path under `packages/idea-engine/src/**` still references `packages/idea-core/**`;
2. current public `idea-mcp` inventory is unchanged;
3. `meta/REDESIGN_PLAN.md` / tracker / tests truthfully describe the remaining `idea-core` follow-up as parity / retire-all, not host fallback or default asset authority;
4. no new generic/shared HEP leakage was introduced.
