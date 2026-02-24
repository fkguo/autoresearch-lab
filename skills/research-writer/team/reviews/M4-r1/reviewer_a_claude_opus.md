VERDICT: READY

## Blockers

(empty)

## Non-blocking

1. **System prompt file not included in packet**: `assets/style/discussion_logic_extractor_system_prompt.txt` is referenced in the script (`--run-models` path) but not shown in the evidence. Confirm it exists and is consistent with the playbook's "Prompt template" section.

2. **Trace event key inconsistency**: The smoke test fixture checks for `"event": "inspire_fixture_loaded"` and similar keys, but the script uses `_append_jsonl` with `sort_keys=True`. Verify the actual JSON structure matches what the grep expects (appears to work based on smoke output, but fragile if keys change).

3. **Model CLI availability not validated at pack-generation time**: The `--run-models` path checks runner file existence but not whether `claude`/`gemini` CLIs are actually in PATH. A clearer error or early check would improve UX.

## Real-research fit

- **Strength**: The N=10 mixed-mode workflow is well-designed for real research. It separates deterministic corpus preparation from optional model-assisted extraction, and keeps human/agent merge as the final step for anti-plagiarism and stability.

- **Strength**: The playbook's "UNVERIFIED protocol" and "kill criterion" language directly addresses the skepticism requirement from the style profile.

- **Strength**: Masking math and citations before LLM extraction focuses the models on logical structure rather than domain specifics, improving pattern generality.

- **Minor gap**: The playbook Section G patterns are labeled "N≈10" but `style_sources_used.md` lists exactly 10 papers. The "≈" is harmless but slightly inconsistent.

## Robustness & safety

- **Good**: No automatic playbook mutation; model outputs are advisory only.

- **Good**: Tar extraction uses safe member rejection (validated by smoke test checking `evil.tex` is rejected).

- **Good**: The trace.jsonl provides full auditability of every step.

- **Acceptable**: The `_flatten_inputs` function has depth/size limits preventing runaway recursion or memory exhaustion.

- **Note**: The `_strip_latex_comments` function handles common cases but is explicitly "not a full TeX parser"—this is appropriately documented and acceptable for reading-pack generation.

## Specific patch suggestions

1. **`scripts/bin/research_writer_learn_discussion_logic.py`, ~line 280**: Add an early check when `--run-models` is passed:
   ```python
   if args.run_models:
       for cli in ("claude", "gemini"):
           if subprocess.run(["which", cli], capture_output=True).returncode != 0:
               print(f"WARNING: '{cli}' CLI not in PATH; --run-models may fail", file=sys.stderr)
   ```

2. **`assets/style/physics_discussion_logic_playbook.md`, Section G header**: Change "N≈10" to "N=10" for consistency with the audit trail in `style_sources_used.md`.

3. **`SKILL.md`, line ~75**: The example command uses `--mask-math` and `--mask-cites` but doesn't explain why these are recommended. Add a one-line note: `# (masking focuses LLM on logical structure, not domain specifics)`.

4. **Evidence file for review**: Consider adding `assets/style/discussion_logic_extractor_system_prompt.txt` to future review packets when `--run-models` is in scope.
