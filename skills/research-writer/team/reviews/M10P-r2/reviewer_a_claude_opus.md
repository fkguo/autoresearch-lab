VERDICT: READY

## Blockers

(none)

## Non-blocking

1. The backup strategy ("write `main.tex.bak` once, do not overwrite if already present") means a stale `.bak` from a previous run could silently persist while the tool mutates `main.tex` again. Consider timestamped backups (`main.tex.bak.<iso8601>`) or at minimum logging a warning when `.bak` already exists and is **not** being overwritten.

2. The `hep://` check ("no `.tex` contains `hep://`") is a simple substring match. If a user writes a comment like `% see hep://...` or a `\url{hep://...}` that is intentional documentation, this will false-positive. A future milestone could scope the check to non-comment lines or make it configurable. Fine for v1.

3. Citekey conflict detection appears to be string-equality on the `@type{KEY,` line. Confirm the parser handles case-insensitive keys (`@Article{k,` vs `@article{K,`) since BibTeX treats them identically. If not handled now, note it as a known limitation in `RUNBOOK.md`.

4. No explicit test for the `--dry-run` + `--compile` combination (i.e., confirming compile is truly skipped under dry-run even when the flag is passed). Worth adding a one-liner smoke case.

## Real-research fit

- The workflow matches a realistic pattern: MCP tool exports a scaffold, researcher runs a local deterministic step before pushing to CI or Overleaf. Good.
- Fail-fast on citekey conflicts with guidance is genuinely useful; duplicated keys are a common silent-corruption source in multi-author papers.
- `latexmk` detection with deterministic `SKIPPED` is the right call—many CI images lack a full TeX distribution.

## Robustness & safety

- `--dry-run` addresses the r1 blocker about non-destructive operation. Good.
- `latexmk -interaction=nonstopmode -halt-on-error` prevents interactive hangs; correct.
- No network, no LLM, no content generation—attack surface is minimal.
- Audit trail with `before_sha256` / `after_sha256` of `main.tex` provides sufficient forensics.
- One concern: `build_trace.jsonl` is append-only. Over many runs it could grow unboundedly. Not a safety issue but worth a note in the runbook about periodic truncation or rotation.

## Specific patch suggestions

1. **`research_writer_consume_paper_manifest.py` — stale backup warning**
   ```python
   # Where main.tex.bak is checked:
   if bak_path.exists():
       log.warning("main.tex.bak already exists; skipping backup (existing backup may be stale)")
       # also write this warning into build_trace entry
   ```

2. **`RUNBOOK.md` — add known limitation for case-insensitive citekeys**
   ```markdown
   ### Known limitations (M10)
   - Citekey conflict detection is currently case-sensitive. BibTeX treats keys
     case-insensitively; a future milestone will normalise keys before comparison.
   ```

3. **`run_all_smoke_tests.sh` — add dry-run + compile guard test**
   ```bash
   # Verify --dry-run suppresses compile even when --compile is passed
   output=$(python3 scripts/bin/research_writer_consume_paper_manifest.py \
     --paper-manifest "$OK_FIXTURE/paper/paper_manifest.json" \
     --dry-run --compile 2>&1)
   echo "$output" | grep -q "SKIPPED\|dry.run" || { echo "FAIL: dry-run did not suppress compile"; exit 1; }
   echo "[smoke] consume paper manifest: --dry-run suppresses --compile"
   ```
