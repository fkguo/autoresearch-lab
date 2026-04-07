# DOCS-FRONTDOOR-01 — Root First-Touch Ordering And Guard Closure

## Goal

Rebaseline the root first-touch docs so they lead with the generic `autoresearch` front door before HEP-specific example surfaces, then lock that ordering/prominence truth with anti-drift coverage.

Current truth must stay explicit:

- `autoresearch` is the generic lifecycle / workflow-plan / bounded native TS computation front door
- `@autoresearch/hep-mcp` is the current most mature domain MCP front door and strongest end-to-end workflow family
- `hepar` / `hep-autoresearch` remain residual legacy compatibility surfaces that must not regain front-door authority

This is a bounded docs + anti-drift slice. It does not change CLI semantics, tool counts, or the already-landed package-level legacy docs rebaseline.

## Why This Slice

The current root docs are closer to truth than before, but first-touch ordering still drifts:

- `README.md` and `docs/README_zh.md` still introduce Project/Run HEP workflows before the generic lifecycle / workflow-plan front door
- the current entrypoint tables still put `hep-mcp` before `autoresearch`, which weakens the generic-first story even when the wording is technically correct
- `docs/PROJECT_STATUS.md` wording is aligned, but its visible bullet order still makes the domain-pack example appear before the generic front door
- `docs/QUICKSTART.md` is already mostly well-scoped as a domain-pack quickstart, but its first executable path still starts from `hep_*`
- `docs/ARCHITECTURE.md` is largely aligned already

Current guardrails are also too narrow:

- `scripts/check-shell-boundary-anti-drift.mjs` and `scripts/lib/front-door-boundary-authority.mjs` lock wording snippets, but not first-touch order/prominence
- `packages/hep-mcp/tests/docs/docToolDrift.test.ts` checks wording/tool drift, but not the generic-first ordering that human readers actually see first

## Required Reads

1. `AGENTS.md`
2. `README.md`
3. `docs/README_zh.md`
4. `docs/QUICKSTART.md`
5. `docs/ARCHITECTURE.md`
6. `docs/PROJECT_STATUS.md`
7. `scripts/lib/front-door-boundary-authority.mjs`
8. `scripts/check-shell-boundary-anti-drift.mjs`
9. `packages/hep-mcp/tests/docs/docToolDrift.test.ts`

## Front-door Surface Audit

Primary edit targets for this lane:

- `README.md`
- `docs/README_zh.md`
- `docs/PROJECT_STATUS.md`
- `docs/QUICKSTART.md`
- `scripts/lib/front-door-boundary-authority.mjs`
- `scripts/check-shell-boundary-anti-drift.mjs`
- `packages/hep-mcp/tests/docs/docToolDrift.test.ts`

Checked but normally out of direct edit scope unless a contradiction remains after the primary changes:

- `docs/ARCHITECTURE.md`
- `docs/TESTING_GUIDE.md`
- `docs/TOOL_CATEGORIES.md`

## Bounded Implementation

- reorder `README.md` and `docs/README_zh.md` so root first touch leads with:
  - generic lifecycle / workflow-plan / computation front door (`autoresearch`)
  - current workflow families framed capability-first
  - HEP as the current strongest domain-pack example, not the first identity anchor
- keep the HEP sections, tool counts, and capability tables truthful, but move them after the generic front-door framing where appropriate
- add or reorder a short generic lifecycle/control-plane smoke path in root first-touch docs before the HEP smoke path
- reorder `docs/PROJECT_STATUS.md` so generic lifecycle / workflow-plan / bounded computation are visible before the domain-pack example
- add one explicit generic-first getting-started block to `docs/QUICKSTART.md` before the existing HEP Draft/Client paths, while keeping the page framed as a domain-pack quickstart rather than a root identity page
- leave `docs/ARCHITECTURE.md` unchanged unless a direct contradiction is found during implementation
- extend anti-drift coverage so order/prominence fails closed, not only exact wording presence:
  - add stable ordering assertions in the root checker and/or doc test for `README.md`, `docs/README_zh.md`, `docs/PROJECT_STATUS.md`, and `docs/QUICKSTART.md`
  - ensure the checker/test still tolerates bounded wording evolution without losing the generic-first invariant

## Explicit No-Go

- no CLI or shell semantics changes
- no tool registry / tool count changes
- no package-level legacy docs rewrite in this slice
- no reintroduction of `hepar` / `hep-autoresearch` as default first touch
- no broad root-doc rewrite beyond the bounded first-touch ordering/prominence problem

## Acceptance

- `git diff --check`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:check`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`
- `python3 - <<'PY'\nimport json\njson.load(open('meta/remediation_tracker_v1.json'))\nprint('tracker-json-ok')\nPY`

## Review Focus

- confirm root first-touch docs now lead with `autoresearch` as the generic front door before HEP-specific example surfaces
- confirm `docs/QUICKSTART.md` stays a domain-pack quickstart rather than being silently promoted to root identity
- confirm anti-drift now covers ordering/prominence rather than exact wording only
- confirm no tool-count, shell-semantics, or legacy-surface regressions were introduced while reordering the root docs
