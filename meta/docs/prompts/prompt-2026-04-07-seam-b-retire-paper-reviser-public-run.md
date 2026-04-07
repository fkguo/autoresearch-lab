# Prompt: 2026-04-07 Next Batch — Retire `paper_reviser` Public Run

## 1) Scope and Objective

This lane closes the remaining **Python-side public run workflow** exposed by the installable `hepar` shell. Today `PUBLIC_RUN_WORKFLOW_IDS` still exposes only `paper_reviser`, and `cmd_run(...)` within `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` remains the actual stateful Python-run orchestration authority. The front-door authority map, CLI tests, and docs currently point at that list, so any drift here silently reopens a second long-term orchestrator path.

We must:

- retire the public `run --workflow-id paper_reviser` exposure as the last `hepar`-scripted Python workflow authority;
- keep the `run` command in the installable shell, but ensure it no longer advertises a Python workflow that is still backed by `cmd_run`;
- update every public-facing doc/test/authority fixture (including `front_door_authority_map_v1.json`) so that the contract between `hepar run` and canonical TypeScript `autoresearch run` is explicit and consistent.

## 2) Source-Grounded Authority Baseline (read first)

Read these files before editing. They explain today’s contract seams:

- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` (`PUBLIC_RUN_WORKFLOW_IDS`, `_public_run_workflow_ids`, `cmd_run`, `_run_workflow_id_help`, and the `_assert_public_shell_inventory` guard)
- `packages/hep-autoresearch/tests/test_public_cli_surface.py` (the assertions that tie `PUBLIC_RUN_WORKFLOW_IDS` to help text, the CLI command list, and `meta/front_door_authority_map_v1.json`)
- `meta/front_door_authority_map_v1.json` (the `hepar_public_shell.run_workflow_ids` mirror of the public list)
- `packages/hep-autoresearch/README.md` + `README.zh.md` + `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.md` + `.zh` versions (exact inventory snippets used by tests)
- `scripts/check-shell-boundary-anti-drift.mjs` (anti-drift guard for public shell wording and `front_door` authority)
- `packages/hep-autoresearch/docs/WORKFLOWS.md` (spoken workflow inventory)

### Current truth you must preserve or intentionally break with explicit justification

- The installable shell exposes `PUBLIC_SHELL_COMMANDS` and `run`.
- `_public_run_workflow_ids()` is the single source of truth for what `hepar run` suggests to users.
- `cmd_run(...)` still mutates `.autoresearch/state.json`, sets up ledger events, and routes workflow execution in Python, so letting any workflow id remain accessible would keep a second orchestrator authority alive.
- `front_door_authority_map_v1.json` explicitly read from `PUBLIC_RUN_WORKFLOW_IDS`, and tests tie doc snippets to `PUBLIC_SHELL_COMMANDS`.
- CLI help, docs, and front-door map must stay in sync with whatever final inventory we authorize.

## 3) Required Implementation Output

Deliver a checked-in outcome where:

1. The public `run` command no longer advertises or accepts `paper_reviser` as a workflow id; the `hepar` front door now points users explicitly at the canonical TypeScript `autoresearch run --workflow-id` path for any future workflows.
2. `PUBLIC_RUN_WORKFLOW_IDS` becomes empty (or is otherwise reduced to the new minimal set you explicitly document) and `_public_run_workflow_ids()` reflects that truth.
3. `cmd_run(...)` continues to own the only Python-run authority, but it is no longer exposed via installable `hepar run --workflow-id`.
4. `meta/front_door_authority_map_v1.json`’s `hepar_public_shell.run_workflow_ids` list is updated to match the new (likely empty) canonical list.
5. `packages/hep-autoresearch/tests/test_public_cli_surface.py` still asserts the inventory truths but now verifies the new state (e.g., that `run` help no longer lists `paper_reviser` and the authority map run list matches).
6. Docs/README/ORCHESTRATOR_INTERACTION summaries maintain the exact command inventory snippets.

## 4) Hard Boundaries

### Must do

- keep `public run` retirement bounded to this single Python workflow (`paper_reviser`) and lock it down across help text, docs, tests, and the front-door map.
- treat `cmd_run(...)` as the sole Python-side workflow authority and do not create alternative workflow ids under this lane.
- keep anti-drift scripts/tests (e.g., `scripts/check-shell-boundary-anti-drift.mjs`) green with the new inventory.
- document the change in the docs/scripts that currently repeat the public inventory snippet so they stop referencing `paper_reviser`.

### Must not do

- do not add new workflow ids to `PUBLIC_RUN_WORKFLOW_IDS`, even temporarily.
- do not expand this lane into repointing other runtimes (`doctor`, `bridge`, `literature-gap`) or into TS-level `autoresearch` commands.
- do not remove the installable `run` command itself; it should stay as a compatibility surface pointing to canonical `autoresearch run`.
- do not leave the front-door map or CLI docs/tests stale—missing updates must fail the acceptance suite.

### Non-goals

- canonicalizing a second TypeScript workflow inventory inside `hepar`; the canonical inventory remains in `packages/orchestrator`.
- any runtime refactor of `cmd_run`.
- cross-package conceptual rebaseline of `front-door` authority beyond this single workflow.

## 5) Likely Files To Touch

- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `meta/front_door_authority_map_v1.json`
- `packages/hep-autoresearch/README.md` and `.zh.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.md` and `.zh`
- `packages/hep-autoresearch/docs/WORKFLOWS.md`
- `scripts/check-shell-boundary-anti-drift.mjs`
- any other docs or tests that currently document `paper_reviser` as a public workflow id (search for the string)

## 6) Recommended Implementation Sequence

1. Remove `paper_reviser` from `PUBLIC_RUN_WORKFLOW_IDS`, ensure `_public_run_workflow_ids()` remains the only helper that surfaces that list, and double-check `_run_workflow_id_help()`/`cmd_run` help still make sense when the list is empty.
2. Update `packages/hep-autoresearch/tests/test_public_cli_surface.py` to confirm the run help and authority map no longer mention `paper_reviser`, and adapt any inventory snippets it asserts on (README/ORCHESTRATOR_INTERACTION text, `front_door_authority_map_v1.json`, CLI help output, etc.).
3. Refresh `meta/front_door_authority_map_v1.json` so `hepar_public_shell.run_workflow_ids` matches the new canonical list (typically `[]`) and leave an inline note describing why the surface now reports that inventory.
4. Sweep the docs/README/ORCHESTRATOR text that was copied from `PUBLIC_SHELL_COMMANDS_MARKDOWN` so they no longer refer to `paper_reviser`.
5. Run `scripts/check-shell-boundary-anti-drift.mjs` and confirm it still passes with the new wording/authority map.

## 7) Acceptance (must pass)

1. `git diff --check`
2. `python3 -m pytest packages/hep-autoresearch/tests/test_public_cli_surface.py -q`
3. `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`
4. `node scripts/check-shell-boundary-anti-drift.mjs`

If you add any new direct CLI tests or front-door fixtures, include them in the acceptance list.

## 8) Formal Review Packet Requirements

Review packet must include:

- changed YAML/JSON & code seams:
  - `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` (the `PUBLIC_RUN_WORKFLOW_IDS` definition, `_public_run_workflow_ids()`, `cmd_run`, `_run_workflow_id_help`)
  - `meta/front_door_authority_map_v1.json` (the `hepar_public_shell` entry)
- direct CLI/test evidence:
  - `packages/hep-autoresearch/tests/test_public_cli_surface.py`
  - `scripts/check-shell-boundary-anti-drift.mjs`
- doc/lock updates:
  - `packages/hep-autoresearch/README.md` + `.zh.md`
  - `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.md` + `.zh.md`
  - `packages/hep-autoresearch/docs/WORKFLOWS.md`

Reviewer challenge checklist:

1. “Is the only remaining Hepar-run public workflow exposure now the empty list (or the documented minimal list) backed by this lane?”
2. “Does the front-door map and CLI help agree with the new inventory instead of referencing `paper_reviser`?”
3. “Have we documented why `cmd_run` is still the only Python workflow authority and ensured no stray workflow ids regrow?”
4. “Do the docs/tests that publish `PUBLIC_SHELL_COMMANDS_MARKDOWN` no longer mention `paper_reviser`?”

## 9) Self-Review Focus

Before declaring done:

1. Confirm `PUBLIC_RUN_WORKFLOW_IDS` and `_public_run_workflow_ids()` describe the new empty (or minimal) inventory and that `hepar run --workflow-id` help re-renders correctly.
2. Confirm `meta/front_door_authority_map_v1.json`’s `hepar_public_shell.run_workflow_ids` is in sync with the new list and the map still classifies the surface as compatibility (not canonical public).
3. Confirm `packages/hep-autoresearch/tests/test_public_cli_surface.py` still enforces the command/run inventory via help output and the authority map.
4. Confirm all docs and the anti-drift script have been touched so they no longer mention `paper_reviser`.
5. Confirm there is a documented follow-up (if any) explaining why this surface now reports zero public Python workflows, so the retirement lane remains traceable.

Only mark this lane done once acceptance + review + self-review all pass with 0 blocking issues and the `hepar` public shell no longer carries a Python `run --workflow-id` authority.
