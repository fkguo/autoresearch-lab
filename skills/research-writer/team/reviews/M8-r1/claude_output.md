VERDICT: NOT_READY

## Blockers

1. **No source code provided for `scripts/bin/distill_discussion_logic.py`.** The packet describes what the script should do and shows its file path, but does not include the actual implementation. Without reviewing the code, I cannot verify:
   - Deterministic normalization rules are implemented correctly.
   - Output format matches the acceptance criteria (`CONSENSUS.md`, `DISAGREEMENTS.md`, `STATS.json`).
   - The script respects the Skill vs Agent boundary (no auto-mutation of playbook/SKILL.md).
   - Pattern-matching logic is sound and auditable.

2. **No smoke test output provided.** The packet references `team/reviews/M8-r1/smoke_output.txt` but does not include its content. Without this, I cannot verify:
   - The `--stub-models` path actually exercises the distiller end-to-end.
   - Outputs are deterministic (same input → identical output).
   - The 2-paper stub scenario produces well-formed `CONSENSUS.md`, `DISAGREEMENTS.md`, and `STATS.json`.

3. **No content of `CONSENSUS.md`, `DISAGREEMENTS.md`, or `STATS.json` shown.** Even for the real-run example, only file paths are listed. Without seeing at least one concrete output, I cannot confirm counts are present in `CONSENSUS.md`, paper IDs are present in `DISAGREEMENTS.md`, or `STATS.json` schema is usable as SSOT for downstream tooling.

## Non-blocking

- The robustness note about `_model_output_ok` in the learn script is a welcome side-fix but is outside M8 scope. Confirm it has its own test coverage so it doesn't regress.
- The packet mentions "deterministic normalization rules are documented in the output (and in code)" but without seeing either artifact, this remains an unverified claim. Once code is provided, verify that the normalization logic (lowercasing, synonym collapsing, etc.) is explicitly enumerated in a docstring or header comment **and** echoed in the output files.

## Real-research fit

- The stated goal (reducing agent/human load at O(10²–10³) scale) is sound and matches a real bottleneck in multi-model discussion-logic workflows.
- Writing `STATS.json` as SSOT is a good design choice for downstream programmatic consumption.
- The separation into consensus vs. disagreements maps well to how researchers actually triage multi-annotator outputs (first lock in agreement, then adjudicate differences).

## Robustness & safety

- **Skill vs Agent boundary:** Cannot confirm compliance without source code. The reviewer request specifically asks about this — the code must be inspected to rule out any writes to `SKILL.md`, `RUNBOOK.md`, or `PLAN.md`.
- **Determinism:** Cannot verify without seeing the normalization rules or running/inspecting the smoke test. If the script uses any LLM calls (even for clustering), determinism is at risk; the acceptance criteria imply pure-code normalization, which is the correct approach.
- **Idempotency:** Does re-running the distiller on the same input overwrite or append to `distill/`? This should be documented and tested.

## Specific patch suggestions

1. **Include the full source of `distill_discussion_logic.py` in the review packet.** This is the primary deliverable; review cannot proceed without it.
2. **Include the verbatim smoke test output** (`smoke_output.txt`) or at minimum the relevant section showing the distiller's stdout and a diff/hash of the generated files.
3. **Include at least one concrete example of each output file** (`CONSENSUS.md`, `DISAGREEMENTS.md`, `STATS.json`) — either from the stub run or the real run — so reviewers can assess format, completeness, and auditability.
4. **Add an idempotency assertion to the smoke test:** run the distiller twice on the same stub directory and assert file-level identity (`diff` or SHA comparison).
5. **In `STATS.json`, document the schema** (even a brief JSON-Schema or a comment block) so downstream tooling authors know what fields to expect. Include this schema documentation in the review packet.
