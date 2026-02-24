VERDICT: NOT_READY

## Blockers

1. **Bib layering implementation is invasive and fragile**: The approach of mutating `main.tex` to add `references_manual` to the `\bibliography{}` command is problematic:
   - No evidence of backup/restore mechanism for `main.tex` before modification
   - Regex-based TeX modification is brittle (what about `\addbibresource{}` for biblatex users?)
   - The acceptance criteria says "main.tex must reference both" but doesn't clarify if this is a validation check or an auto-mutation. The evidence shows auto-mutation, which should be opt-in or at least logged as a warning before modifying user files.

2. **Missing fixture content verification**: The packet claims smoke tests cover validate + compile + failure modes, but provides no evidence that:
   - The `bad_hep_uri_root` fixture actually contains `hep://` in a `.tex` file
   - The `bad_citekey_conflict_root` fixture actually has overlapping keys
   - The actual error messages emitted are actionable (acceptance criteria says "fail-fast with guidance")

3. **`--compile` without `--paper-manifest` behavior undefined**: CLI help shows both flags but doesn't specify behavior if `--compile` is passed without a manifest or if manifest validation fails partway.

## Non-blocking

- The `_RE_BIBKEY` regex doesn't handle multi-line `@type{key,` patterns or keys with special characters allowed by BibTeX (e.g., colons, underscores in unusual positions).
- Audit trail uses `input_hash` covering "all figure files" but manifest only specifies `figuresDir`, not a file list—how are figure files enumerated? Could be non-deterministic if directory listing order varies.
- No mention of exit codes for different failure modes (validation fail vs. compile fail vs. latexmk missing).

## Real-research fit

- The `hep://` ban is reasonable for catching unresolved INSPIRE placeholders, but researchers may have legitimate `hep://` in comments or documentation strings. Consider restricting check to non-comment lines or making it configurable.
- Auto-creating empty `references_manual.bib` is helpful for workflow, but modifying `main.tex` without explicit consent could surprise collaborators using version control.
- The fixture uses `apsrev4-2` (APS journals), which is appropriate for HEP, but the tool should work with any bib style.

## Robustness & safety

- **No rollback on partial failure**: If bib layering succeeds but compile fails, the mutated `main.tex` persists. Consider atomic operations or explicit `--dry-run` mode.
- **latexmk invocation security**: No evidence of input sanitization for `main.tex` path passed to subprocess. If `paper_root` contains shell metacharacters, this could be exploited.
- **Audit log append-only but no rotation**: `build_trace.jsonl` grows indefinitely. Not critical but worth noting for long-running projects.

## Specific patch suggestions

1. **`scripts/bin/research_writer_consume_paper_manifest.py`**: Add `--dry-run` flag that validates and reports what mutations *would* happen to `main.tex` without writing. This addresses the invasive mutation concern.

2. **`scripts/bin/research_writer_consume_paper_manifest.py`**: Before modifying `main.tex`, write a backup to `main.tex.bak` or log the original content hash in `build_trace.jsonl` with a `main_tex_original_hash` field.

3. **`scripts/bin/research_writer_consume_paper_manifest.py`**: For the `latexmk` subprocess call, use `shlex.quote()` on the `main.tex` path or pass arguments as a list (not shell string) to `subprocess.run()`.

4. **Fixture evidence**: Add to packet the actual content of:
   - `bad_hep_uri_root/paper/sections/some_file.tex` showing the `hep://` line
   - `bad_citekey_conflict_root/paper/references_generated.bib` and `references_manual.bib` showing the conflicting key
   - The actual error message output for each failure case

5. **`scripts/bin/research_writer_consume_paper_manifest.py`**: Define and document exit codes:
   - `0`: success (including SKIPPED compile)
   - `1`: validation failure
   - `2`: compile failure
   - This enables scripted CI pipelines to distinguish failure modes.
