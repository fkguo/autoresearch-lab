VERDICT: READY

## Blockers

(none)

## Non-blocking

1. **Model runner dependency not documented**: The `--run-models` path requires `claude-cli-runner` and `gemini-cli-runner` skills to exist under `$CODEX_HOME/skills/`. This is mentioned only implicitly via `_find_runner()`. Consider adding a note in RUNBOOK.md section 7 about prerequisites.

2. **Hardcoded model names may drift**: `--gemini-model` defaults to `"gemini-3.0-pro"` which may not be the canonical model name (typically `gemini-1.5-pro` or similar). Low risk since it's a CLI default that users can override.

3. **Pack excerpt clipping is aggressive**: `_clip()` truncates to `max_chars` without regard for sentence/paragraph boundaries, which could produce incomplete sentences in packs. Acceptable for N=10 learning but worth noting.

## Real-research fit

- **Good**: The workflow supports real INSPIRE queries and arXiv source retrieval with graceful degradation (trace logs, fixture-based offline testing).
- **Good**: Masking options (`--mask-math`, `--mask-cites`) correctly focus extraction on argument structure rather than domain-specific notation—appropriate for transferable discussion logic.
- **Good**: The playbook's "UNVERIFIED" protocol and kill-criterion pattern directly address the skill's stated skepticism requirement.
- **Good**: The dual-model clean-room pass logs traces but does **not** auto-mutate the playbook, preserving human/agent oversight for the merge step.

## Robustness & safety

- **Safe tarfile extraction**: The fixture test explicitly checks that path-traversal members (`../evil.tex`) are rejected and logged (`unsafe_rejected`). The main fetcher script presumably implements this (not shown in packet but tested).
- **Deterministic offline tests**: Smoke tests use fixture JSON and synthetic tarball—no network required. The `--dry-run` mode is also exercised.
- **Trace logging**: Both fetcher and pack generator append to `trace.jsonl` with timestamped events, enabling post-hoc audit of failures.
- **No automatic playbook mutation**: Acceptance criterion is met; `--run-models` writes per-paper outputs only.

## Specific patch suggestions

1. **RUNBOOK.md §7 prerequisite note** (optional, non-blocking):
   ```markdown
   > **Prerequisites**: `--run-models` requires the `claude-cli-runner` and `gemini-cli-runner` skills installed under `$CODEX_HOME/skills/`.
   ```

2. **Default Gemini model name** in `research_writer_learn_discussion_logic.py` (line ~240):
   ```python
   ap.add_argument("--gemini-model", default="gemini-1.5-pro")
   ```
   (or whatever the current canonical name is—easy to change later).

3. **Minor typo/consistency**: In `discussion_logic_extractor_system_prompt.txt`, the phrase "excerpt section name" could be "excerpt section heading" for consistency with the playbook terminology. Cosmetic only.
