## Review: skilldev-mdlink-macro-hygiene-r2

### Verdict: **APPROVE**

---

### Blocking issues from r1: Resolution status

| r1 Issue | Status | Notes |
|----------|--------|-------|
| Variable-length backtick delimiters (``...``) causing false positives | ✅ Resolved | `_iter_inline_code_spans` now tracks delimiter length and matches closing delimiter of same length |
| Fenced code block toggle fragility | ✅ Resolved | Now tracks `fence_ch` + `fence_len`; closing fence must match character type and be ≥ opening length (CommonMark compliant) |
| `.md#anchor` treated as non-path | ✅ Resolved | `_looks_like_md_path` now splits on `#` and checks the base; gate flags these; fixer converts to `[path.md#anchor](path.md#anchor)` |
| Missing expansion → silent success | ✅ Resolved | `fix_markdown_latex_macros.py` now calls `_find_unexpandable_macros` and exits with code 2 if forbidden macros lack expansions |
| `.git` traversal | ✅ Resolved | All `rglob` loops now skip paths where `".git" in p.parts` |

---

### Non-blocking suggestions

1. **Anchor link fixer edge case**: When the fixer rewrites `` `foo.md#section` `` → `[foo.md#section](foo.md#section)`, this is correct for relative links. However, if a user writes `` `#local-anchor` `` (same-file anchor), `_looks_like_md_path` returns `False` (no `.md` suffix, no `knowledge_base/` prefix), so it's left alone. This seems fine, but consider documenting that same-file anchors in backticks are intentionally ignored (they're often used as literal anchor references in prose).

2. **Regex compilation caching**: Both gate and fixer recompile `macro_re` per invocation. For large scan targets this is negligible, but if later extended to watch-mode or batched CI, consider caching the compiled pattern.

3. **Warning on zero forbidden macros**: If `latex_macro_hygiene.forbidden_macros` is explicitly set to `[]`, the gate silently passes (the regex matches nothing). Consider emitting a `[info]` message so users know the gate is effectively a no-op rather than misconfigured.

4. **Fixer dry-run output truncation**: Both fixers truncate output at 50 changes per file. For very large violations this is sensible, but the `... (N more)` message could also show the total violation count for the file to help triage.

5. **`--root` vs `--notes` inconsistency**: Gates use `--notes` (a single file that anchors config discovery), while fixers use `--root` (file or directory). This is defensible but worth documenting in the skill-wide README to avoid confusion.

---

### Missing tests / edge cases (non-blocking)

1. **Nested fence edge case**: A line like ```` ``` ```` (exactly 3 backticks on a line) inside a 4-backtick fence should remain fenced. The current logic handles this correctly (opener was 4, so 3-backtick line doesn't close), but an explicit smoke-test case would be reassuring.

2. **Mixed fence characters**: Opening with `~~~` and encountering ```` ``` ```` inside should not close the fence. Current code checks `ch == fence_ch`, so this is correct—worth a regression test.

3. **Inline code with embedded newlines**: CommonMark allows inline code spans to wrap lines (the spec normalizes interior newlines to spaces). The current line-by-line scan won't handle this. This is an edge case unlikely in practice, but documenting the limitation would be prudent.

4. **Unicode in macro names**: LaTeX macro names are ASCII-letter-only by convention, but the regex `(?![A-Za-z])` would allow a macro followed by a non-ASCII letter (e.g., `\Rcé`) to match. Practically harmless, but `(?![A-Za-z\u0080-\uFFFF])` would be more robust if international TeX is ever in scope.

5. **Empty file handling**: Confirm gates/fixers exit 0 on an empty `.md` file (no content, no violations). Likely already works, but worth a one-liner smoke test.

6. **Symlink loops**: `rglob` can follow symlinks into loops. Adding `followlinks=False` or a visited-set guard would harden directory scans.

---

### Summary

The r2 implementation addresses all blocking issues raised in r1. The inline-code span parser is now robust to variable-length delimiters, fenced-block handling is CommonMark-compliant, the macro fixer fails loudly on missing expansions, and `.git` is properly excluded. The code is deterministic and the template should pass these gates cleanly.

**Approved for merge.**
