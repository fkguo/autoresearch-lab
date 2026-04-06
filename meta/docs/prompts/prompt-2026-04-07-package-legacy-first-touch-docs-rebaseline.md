# Package Legacy First-Touch Docs Rebaseline

## Goal

Rebaseline the package-level first-touch docs under `packages/hep-autoresearch/` so they no longer act like the default product front door.

Current truth must stay explicit:

- `autoresearch` is the generic front door for lifecycle state plus the bounded native TS computation entrypoint
- the installable legacy `hepar` / `hep-autoresearch` / `hep-autopilot` public shell no longer exposes public computation, `doctor`, `bridge`, or `literature-gap`
- package-local docs may still document residual legacy workflow/support surfaces or internal compatibility paths, but only as legacy/maintainer/eval/regression-oriented material

This is a bounded docs + anti-drift slice. It does not change CLI semantics, does not reopen residual non-computation `run` retirement, and does not rewrite `workflows/` implementation specs.

## Why This Slice

Root docs now present a coherent generic-first story, but `packages/hep-autoresearch/` still has a package-level first-touch chain that can pull readers back toward the legacy shell:

- package README still presents package docs as the main “Start here” chain
- package index still describes `doctor` / `bridge` as if they remain part of the installable public shell
- package beginner tutorials still use the legacy shell as the main walkthrough instead of clearly framing it as compatibility-only
- package workflow / interaction docs still contain live-looking public examples that contradict current public-shell tests

That drift is high leverage because it affects the next docs a maintainer or operator is likely to read after root docs, and it weakens the repo-wide generic-first front-door story even when the code and root docs are already aligned.

## Required Reads

1. `AGENTS.md`
2. `packages/hep-autoresearch/README.md`
3. `packages/hep-autoresearch/README.zh.md`
4. `packages/hep-autoresearch/docs/INDEX.md`
5. `packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.md`
6. `packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.zh.md`
7. `packages/hep-autoresearch/docs/WORKFLOWS.md`
8. `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.zh.md`
9. `packages/hep-autoresearch/tests/test_public_cli_surface.py`
10. `scripts/lib/front-door-boundary-authority.mjs`
11. `scripts/check-shell-boundary-anti-drift.mjs`
12. `packages/hep-mcp/tests/docs/docToolDrift.test.ts`

## Bounded Implementation

- add explicit package-level framing in the package README / README.zh so readers are sent to repo-root `README.md`, `docs/QUICKSTART.md`, and `docs/TESTING_GUIDE.md` for current front-door truth
- relabel package-local `README` / `docs/INDEX.md` / beginner-tutorial surfaces as legacy-surface or maintainer-oriented package docs rather than default product first touch
- update package docs so public-shell truth matches current tests:
  - no installable public computation on `hepar run`
  - no installable public `doctor`
  - no installable public `bridge`
  - no installable public `literature-gap`
- where package docs still mention those retired paths, keep them only as internal compatibility paths for maintainer/eval/regression coverage
- update the shared anti-drift wording fixture and doc drift test coverage so this package-level first-touch truth fails closed if it drifts again

## Explicit No-Go

- no CLI or parser changes
- no changes to residual non-computation `run` semantics
- no broader Pipeline A deletion slice
- no rewrite of `packages/hep-autoresearch/workflows/*.md`
- no changes outside the bounded doc / guard / test files in this slice

## Acceptance

- `git diff --check`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`
- `python3 -m pytest -q packages/hep-autoresearch/tests/test_public_cli_surface.py`

## Review Focus

- confirm package-level first-touch docs no longer position the legacy shell as the default product entrypoint
- confirm package docs now match the public-shell tests for retired public computation / `doctor` / `bridge` / `literature-gap`
- confirm internal compatibility paths, where still documented, are clearly maintainer/eval/regression-only
- confirm anti-drift guardrails now cover package-level first-touch framing instead of only root docs
