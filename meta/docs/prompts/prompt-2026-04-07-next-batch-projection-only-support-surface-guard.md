# Prompt: Projection-Only Support Surface Guard

## Intent

This lane turns `Lane B`’s residual support surface classification into a clear projection-only guard: the remaining `hep-autoresearch`/`hepar` support commands, web/bridge diagnostics, and internal lifecycle helpers must stay as *projections or compatibility-only helpers*, never regain generic lifecycle/session authority. The lane documents the guard in a prompt that reviewers can follow straight into the relevant files and trace evidence.

## Scope

Focus on precisely the projection-only surfaces:

- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` (internal/full parser commands such as `start`, `checkpoint`, `request-approval`, `reject`, `doctor`, `bridge`, `literature-gap`, and residual non-computation `run` helpers)
- `packages/hep-autoresearch/src/hep_autoresearch/web/app.py` (diagnostics APIs, `status/logs`, canonical CLI hints)
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION*.md`, `README` content, and the front-door guard scripts (`scripts/check-shell-boundary-anti-drift.mjs`, `scripts/lib/front-door-boundary-authority.mjs`) that document/deploy the guard
- `packages/hep-mcp/tests/docs/docToolDrift.test.ts`, `packages/hep-mcp/tests/toolContracts.test.ts`, `packages/hep-mcp/tests/contracts/crossComponentToolSubset.test.ts` (tests already enumerating front-door doc drift)
- `meta/docs/orchestrator-mcp-tools-spec.md` (the spec that still lists orchestrator tool surfaces)

## Questions for the reviewer

1. Which support commands/tools are still listed in `orchestrator_cli.py` but absent from the public help? Are they documented as internal-only?
2. Does `web/app.py` continue to expose only read-only diagnostics, pointing all mutations to `autoresearch`/`@autoresearch/orchestrator`?
3. Do the docs (`README`, `ORCHESTRATOR_INTERACTION*`, `orchestrator-mcp-tools-spec.md`) and guard scripts cite the same publication-level authority (the new inventory) so drift is catchable?
4. Do the help/tests/docs referenced in `docToolDrift.test.ts`/`toolContracts.test.ts`/`crossComponentToolSubset.test.ts` fail if these internal helpers reappear on the public surface?

## Acceptance

- All reviewed files confirm the projection-only boundary (internal helper surfaces not exposed as generic authority). Commented evidence must point to the canonical `autoresearch` front door or the internal-only guard.
- Tests/guards cover the same inventory: `scripts/check-shell-boundary-anti-drift.mjs` sees the same data, `docToolDrift.test.ts` asserts drift fails, and `toolContracts.test.ts` plus `crossComponentToolSubset.test.ts` list only the authorized tool surfaces.
- Reviewer should affirm that `hepar` doc blocks now explicitly call these surfaces "compatibility-only" / "internal-only" and link to a canonical timeline for eventual retirement.

## Output format

Reviewer output should be a JSON block with `verdict`, `blocking_issues`, `amendments`, `positive_findings`, and `summary` (same schema as other review prompts). Highlight any stale tracked surface that still claims authority and mention the projection-only guard path to fix it.
