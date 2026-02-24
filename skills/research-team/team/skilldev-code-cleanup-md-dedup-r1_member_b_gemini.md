[WARN] Skipping unreadable directory: /Library/Trial (EPERM: operation not permitted, scandir '/Library/Trial')
[WARN] Skipping unreadable directory: /dev/fd (EBADF: bad file descriptor, lstat '/dev/fd/3')
**APPROVE**

The motivation is sound (3x/4x duplication is a liability), but the risk of subtle regression in "hygiene" gates is high because "hygiene" is often defined by the specific regexes used in the legacy code. Consolidating them changes the definition of "clean" to the intersection/union of previous bugs.

### Top 3 Risks / Edge Cases

1.  **Inline Code Parsing Divergence ("The Regex Trap")**
    *   **Risk:** Legacy scripts likely use slightly different regexes (e.g., one might use `` `[^`]*` `` while another handles double backticks `` ``...`` ``). A "robust" shared parser might correctly identify spans that were previously missed (and thus not validated), causing the gate to suddenly fail on existing "valid" code.
    *   **Edge Case:** Code spans containing valid delimiters for other checks (e.g., ` `$` ` inside backticks). If the parser is too aggressive or too lax, it will trigger false positives in the math/link checkers.

2.  **File Discovery Inconsistencies**
    *   **Risk:** The existing `_iter_markdown_files` implementations may have subtle differences in how they handle hidden files (`.git`), symbolic links, or specific ignore patterns. Centralizing this into `md_utils` might accidentally start checking `node_modules` or `.tox` if the exclusion logic isn't strictly copied.
    *   **Edge Case:** Passing a specific file vs. a directory as a target. Ensure the shared iterator handles `python script.py specific_file.md` correctly without trying to walk it as a dir.

3.  **Context-Specific Validator Logic**
    *   **Risk:** `check_knowledge_layers.py` validates *referenced* notes. If it passes a partial string or a modified buffer to the shared `validate_markdown_math_hygiene`, and that validator assumes it's processing a full file (e.g., for line number reporting), the error reporting will break or become confusing.

### Minimal Safe Changes / Improvements

1.  **Mandatory Unit Tests for `md_utils`:**
    *   Do not rely on integration tests ("run_all_smoke_tests") alone.
    *   Add `scripts/lib/tests/test_md_utils.py`.
    *   Specifically test `iter_inline_code_spans` against:
        *   `var` (single tick)
        *   ``type`` (double tick)
        *   ``` block ``` (triple tick inline)
        *   `` ` `` (tick inside ticks)
        *   Unclosed ticks (should not crash/hang).

2.  **Preserve Legacy Behavior Flags (if needed):**
    *   If you find one script ignored `.txt` files disguised as markdown and another didn't, add a `extension_whitelist` arg to `iter_md_files_by_targets`, defaulting to `['.md']`. Do not hardcode assumptions.

3.  **Scope Restriction:**
    *   **Correct:** Exclude `check_notebook_integrity.py`. It parses JSON structures where "lines" mean something different. Don't touch it.

### Required Regression Assertions

Before merging, run this diff-check on the output of the gates against the current codebase:

```bash
# Save current output
python scripts/gates/check_markdown_math_hygiene.py . > old_math.log 2>&1
python scripts/gates/check_markdown_link_hygiene.py . > old_links.log 2>&1

# Apply refactor...

# Compare
python scripts/gates/check_markdown_math_hygiene.py . > new_math.log 2>&1
diff old_math.log new_math.log
# (Should be empty or effectively identical)
```
