# M-20 Registry Migration Rebaseline

## Purpose

This prompt is the checked-in SSOT for the 2026-03-29 source-grounded rebaseline of `M-20`.
It exists to prevent future work from re-implementing already-landed baseline infrastructure.

## Rebaselined Truth

- `M-20` is **done as baseline infrastructure**, not pending as a from-scratch implementation lane.
- Commit `85f816f` already landed the live baseline surfaces:
  - `meta/schemas/migration_registry_v1.schema.json`
  - `meta/schemas/migration_registry_v1.json`
  - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/migrate.py`
  - `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` `migrate` CLI wiring
  - `packages/hep-autoresearch/tests/test_migrate.py`
- Targeted proof on the rebaseline lane still passes:
  - `PYTHONPATH=packages/hep-autoresearch/src python3 -m pytest packages/hep-autoresearch/tests/test_migrate.py -q`
  - expected result: `15 passed`

## Current Boundary

- The checked-in migration registry is still empty:
  - `meta/schemas/migration_registry_v1.json` currently has `chain_count=0`
- The live migration command is intentionally narrow:
  - `workspace migrate` only scans `.autoresearch/**`
- No broader artifact-migration rollout is live.
- No non-`.autoresearch/**` migration authority is claimed by this closeout.

## Smallest Truthful Reopen Slice

Only reopen `M-20`-adjacent work if one of these is true:

1. We are adding the **first real checked-in migration chain** for a `.autoresearch/**` runtime artifact.
2. We are making an **explicit governance decision to widen migration scope** beyond `.autoresearch/**`.

Anything larger than that should be split into its own bounded lane or follow-up prompt.

## Hard Constraints For Future Work

- Do **not** re-implement `migration_registry_v1` schema generation, `toolkit/migrate.py`, or CLI `migrate` wiring.
- Do **not** claim that a live migration rollout exists beyond `.autoresearch/**` unless code, tests, and checked-in registry entries prove it.
- Do **not** infer that the presence of versioned schemas or `schema_version` fields elsewhere in the repo means they are already covered by the checked-in migration registry.
- If a future lane discovers stale or duplicate migration authority, record it in checked-in SSOT rather than leaving it only in chat or review output.
