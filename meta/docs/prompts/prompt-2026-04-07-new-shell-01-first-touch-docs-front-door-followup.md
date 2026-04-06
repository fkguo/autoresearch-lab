# NEW-SHELL-01 Follow-up — First-Touch Front-Door Docs

## Goal

Keep the generic-first front-door truth coherent in the first docs that a new maintainer or operator is likely to read next: `docs/QUICKSTART.md` and `docs/TESTING_GUIDE.md`.

This is a bounded docs + anti-drift slice. It does not reopen runtime behavior, package boundaries, or broader Pipeline A retirement sequencing.

## Why This Slice

Recent follow-ups already corrected root/front-door docs, retired public `hepar literature-gap`, and centralized wording locks into a shared fixture. The remaining high-leverage gap is first-touch guidance drift:

- `docs/QUICKSTART.md` still surfaced a lower-level Python workflow consumer in the main happy-path text
- `docs/TESTING_GUIDE.md` still led with `hep-mcp` as if it were the primary front door, and visually placed an internal `literature-gap` compatibility command next to the public `autoresearch workflow-plan` example

That drift does not break CI immediately, but it does distort operator default mental models and weakens the generic-first substrate story.

## Required Reads

1. `AGENTS.md`
2. `meta/REDESIGN_PLAN.md`
3. `meta/remediation_tracker_v1.json`
4. `docs/QUICKSTART.md`
5. `docs/TESTING_GUIDE.md`
6. `scripts/lib/front-door-boundary-authority.mjs`
7. `scripts/check-shell-boundary-anti-drift.mjs`
8. `packages/hep-mcp/tests/docs/docToolDrift.test.ts`

## Bounded Implementation

- update `docs/QUICKSTART.md` so it explicitly frames itself as a domain-pack quickstart beneath the generic `autoresearch` front door
- remove lower-level Python workflow-consumer wording from the main QUICKSTART happy path
- update `docs/TESTING_GUIDE.md` so it explicitly distinguishes generic `autoresearch` front-door authority from the current strongest domain MCP front door `@autoresearch/hep-mcp`
- demote the internal `python -m hep_autoresearch.orchestrator_cli ... literature-gap` compatibility example to maintainer/eval/regression-only wording instead of a peer public example
- extend `scripts/lib/front-door-boundary-authority.mjs` so the shared anti-drift fixture also locks these first-touch docs
- sync `meta/REDESIGN_PLAN.md` and `meta/remediation_tracker_v1.json` to the new first-touch doc truth

## Explicit No-Go

- no change to `autoresearch workflow-plan` semantics
- no change to `hep-mcp` runtime/tool behavior
- no new Pipeline A command retirement cut
- no rewrite of deeper architecture/status docs that are already aligned
- no new shell/UI/app package work

## Acceptance

- `git diff --check`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`

## Review Focus

- confirm first-touch docs now lead with `autoresearch` as the generic front door and `@autoresearch/hep-mcp` as a domain pack/front door rather than root product identity
- confirm lower-level Python workflow consumers remain documented only as lower-level or maintainer-only paths
- confirm the shared wording fixture, not ad hoc copies, is the authority for these first-touch surfaces
