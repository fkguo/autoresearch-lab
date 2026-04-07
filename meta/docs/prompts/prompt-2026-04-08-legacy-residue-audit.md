# Prompt: 2026-04-08 Legacy Residue Audit (Superseded Redirect)

This prompt is superseded and kept only as a redirect anchor.

Use:

- `meta/docs/prompts/prompt-2026-04-08-pipeline-a-residual-support-surfaces-sequenced-lanes.md`

## Why superseded

The original audit framing in this file became stale relative to live repo truth:

- `doctor` / `bridge` are no longer part of the current residual support-surface queue.
- `method-design` and `run-card` do have direct tests (`test_method_design_cli.py`, `test_run_card.py`), so "no direct tests" is no longer accurate.
- Execution now requires explicit sequencing:
  1. `method-design` first
  2. `run-card validate/render` wrapper contraction second
  3. `branch` state/approval semantics lane last

Do not implement from this superseded file. Implement from the sequenced-lanes prompt above.
