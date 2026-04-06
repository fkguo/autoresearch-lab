# NEW-SHELL-01 Follow-up — Front-Door Authority Fixture

## Goal

Keep `NEW-SHELL-01` bounded while reducing internal drift inside the already-landed front-door enforcement slice. The follow-up is not another doc rewrite and not another legacy-command retirement cut. It only turns duplicated front-door wording locks into a single checked-in authority fixture that multiple enforcement surfaces consume.

This remains generic-first hardening. It must not reopen runtime/product architecture, widen into CLI redesign, or re-elevate `hepar` / `hep-autoresearch`.

## Why This Slice

Current repo truth already shows the same root/front-door wording duplicated across:

- `scripts/check-shell-boundary-anti-drift.mjs`
- `packages/hep-mcp/tests/docs/docToolDrift.test.ts`

That duplication weakens the very anti-drift guardrail we just promoted into CI. A wording update can now require coordinated edits in multiple places, which raises the risk of silent enforcement skew.

Source-first external references reinforce the same design lesson:

- Codex centralizes slash-command authority in `codex-rs/tui/src/slash_command.rs` and reuses it through `codex-rs/tui/src/bottom_pane/slash_commands.rs` instead of re-listing visible command truth at each callsite.
- Claude Code keeps tool-schema authority generated from a single schema source into `package/sdk-tools.d.ts`, rather than maintaining handwritten parallel copies.

The adaptation here is modest: centralize front-door wording authority, then let checker/test surfaces consume it.

## Required Reads

1. `AGENTS.md`
2. `meta/REDESIGN_PLAN.md`
3. `meta/remediation_tracker_v1.json`
4. `meta/docs/prompts/prompt-2026-03-26-new-shell-01-boundary-enforcement-anti-drift.md`
5. `scripts/check-shell-boundary-anti-drift.mjs`
6. `packages/hep-mcp/tests/docs/docToolDrift.test.ts`
7. `packages/orchestrator/src/cli-help.ts`
8. `docs/QUICKSTART.md`
9. `docs/TESTING_GUIDE.md`
10. `/Users/fkg/Coding/Agents/codex/codex-rs/tui/src/slash_command.rs`
11. `/Users/fkg/Coding/Agents/codex/codex-rs/tui/src/bottom_pane/slash_commands.rs`
12. `/Users/fkg/Coding/Agents/claude-code-sourcemap/package/sdk-tools.d.ts`

## Bounded Implementation

- add one checked-in root fixture/module for front-door boundary wording authority
- make `scripts/check-shell-boundary-anti-drift.mjs` consume that fixture
- make `packages/hep-mcp/tests/docs/docToolDrift.test.ts` consume the same fixture
- keep `packages/orchestrator/src/cli-help.ts` in review scope as an adjacent front-door surface, but do not widen this slice into CLI-help content refactoring unless a direct contradiction is exposed
- update `meta/REDESIGN_PLAN.md` and `meta/remediation_tracker_v1.json` so closeout truth reflects the new single-authority enforcement path

## Explicit No-Go

- no new shell/frontend/gateway package
- no runtime/orchestrator behavior change
- no first-touch doc rewrite in `docs/QUICKSTART.md` or `docs/TESTING_GUIDE.md` in this batch
- no new legacy-command retirement cut in `hep-autoresearch`
- no second authority fixture for the same wording

## Acceptance

- `git diff --check`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`

## Review Focus

- confirm there is exactly one live source for root/front-door wording locks
- confirm checker and doc drift test now consume the same authority rather than shadow-copying strings
- confirm no runtime/provider/public-command behavior changed
- confirm `autoresearch` remains the generic-first front door and `hepar literature-gap` remains legacy compatibility-only
