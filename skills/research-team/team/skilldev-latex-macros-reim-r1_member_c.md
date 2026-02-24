## Non-blocking Robustness Audit – Member C (Claude Sonnet)

**Verdict: APPROVE**

---

### Blocking issues
None found. The change is narrowly scoped, well-tested, and addresses a real pain point.

---

### Non-blocking suggestions

1. **Case sensitivity documentation**  
   - `\re` and `\im` are lowercase; `\Re` and `\Im` might also appear in the wild.  
   - Consider documenting (or briefly testing) whether uppercase variants should also be forbidden/expanded.  
   - If uppercase variants are valid LaTeX primitives in some engines, explicitly excluding them from the forbidden list might prevent confusion.

2. **Expansion consistency**  
   - `{\operatorname{Re}}` and `{\operatorname{Im}}` are reasonable defaults.  
   - Some authors prefer `\mathrm{Re}` or `\text{Re}` for upright text.  
   - If this becomes a frequent override request, consider adding a comment in `research_team_config_template.json` showing an example override.

3. **Macro name collision risk**  
   - `\re` and `\im` are short and might collide with domain-specific macros in some papers (e.g., "relative error" or "image").  
   - **Mitigation**: Since the forbidden list is configurable per project, this is acceptable. Consider a one-line comment in the template noting that teams can remove entries if they define custom `\re`/`\im` macros.

---

### Missing tests / edge cases

1. **Uppercase variants (`\Re`, `\Im`)**  
   - Not currently in the smoke test or forbidden list.  
   - If these appear in real papers, the hygiene gate won't catch them.  
   - **Suggestion**: Add a quick check or comment about uppercase handling.

2. **Macro with arguments**  
   - Current test uses `\re s` (no braces). What about `\re{z}` or `\re(x)`?  
   - The regex-based fixer should handle these, but smoke test could include a braced variant: `\re{s}` or `\im{z}`.

3. **Nested or chained macros**  
   - Example: `\Mc_2(\re z)` or `\bar\re s`.  
   - Smoke test already has `\bar\Rc`, so nested handling is partially covered.  
   - No critical gap, but documenting expected behavior for `\re` inside another macro argument would help future maintainers.

4. **Config override validation**  
   - If a project sets `"forbidden_macros": "not-a-list"`, lines 90–91 fall back to `default_forbidden`.  
   - **Edge**: If `expansions` is malformed (e.g., a list instead of dict), line 92 might fail silently or raise.  
   - Consider a try-except or type check for `exp_raw` similar to `forbid_raw`.

5. **Performance / large files**  
   - If a KB file has thousands of inline math expressions, repeated regex expansion might be slow.  
   - Not a correctness issue, but worth a note if files >10k lines are common.

---

### Summary

The change is **sound and safe**. The defaults are sensible, the smoke test exercises the new macros, and the configurable design allows projects to opt out if needed.

**Recommended next steps** (non-blocking):
- Add `\Re`, `\Im` smoke-test coverage or explicitly document why they're omitted.
- Include a braced-argument example (`\re{z}`) in the smoke test.
- Validate `expansions` type in `fix_markdown_latex_macros.py` (similar to `forbidden_macros`).

**Ship it.** 🚢
