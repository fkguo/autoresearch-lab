**Using audit review skill to evaluate this UX patch**

<details>
<summary>Audit Review</summary>

## 1. Nits / Risks

### **build_draft_packet.py (lines 472–473)**

**Risk: Relative link assumptions**
- Links use bare `{preflight_report.name}` and `{preflight_json.name}` (just filename, no path).
- **Assumption**: The Markdown file and these artifacts are siblings in the same directory.
- **Validation needed**: Confirm `args.out.parent == preflight_report.parent == preflight_json.parent`.
- **Mitigation**: If they're not guaranteed siblings, use relative paths like `[{name}](./{name})` or construct proper relative links.

**Nit: Comment placement**
- Line 471 comment "keep them out of backticks" is helpful but could be more precise: "Clickable links require bare Markdown syntax (no backticks)."

**Nit: Consistency**
- Lines 466–469 use backtick-wrapped paths for provenance (non-clickable).
- Lines 472–473 use bare Markdown links (clickable).
- **Good**: This is intentional—provenance paths are informational, preflight artifacts are actionable. No change needed, but documenting the rationale in a comment would future-proof it.

---

### **prompts_readme_template.md**

**Risk: Drift / staleness**
- README lists specific prompt files but is static.
- If new prompts are added (e.g., `_system_member_d.txt`), the README won't auto-update.
- **Mitigation**: Add a maintenance note:
  ```markdown
  > **Note**: If you add new prompt files, update this README to reflect them.
  ```

**Nit: "optional numerics sidecar"**
- The phrase "non-blocking" is clear, but "optional" might confuse users about when to use it.
- **Suggestion**: "Member C numerics sidecar (non-blocking; invoke if validating computation)" or similar.

**Nit: File naming convention**
- Files use `_system_*` prefix but `_team_packet.txt` doesn't.
- README doesn't explain the underscore convention (likely means "template/internal").
- **Suggestion**: Add a one-liner: "Files prefixed with `_` are internal templates/system prompts."

---

### **scaffold_research_workflow.sh (line 113)**

**Low risk: Order dependency**
- `prompts/README.md` is written *after* other prompt files (lines 108–112, 114).
- If `copy_template` fails midway, the README might document files that don't exist.
- **Mitigation**: Either (a) write README first, or (b) ensure `copy_template` is atomic/fail-fast.
- **Observation**: Current order is fine if `copy_template` is robust (smoke tests pass, so likely OK).

---

## 2. Robustness Check

### **Path assumptions**
- `{preflight_report.name}` assumes filename-only works as a link target.
- If the draft packet is opened in an editor/viewer that resolves links relative to CWD (not the file's directory), links will break.
- **Test**: Open the generated Markdown in VS Code, Obsidian, or a web browser—verify links work.

### **Minimalism**
- No over-engineering detected. Links are simple bare filenames, README is static text.
- **Good**: No dynamic templating, no filesystem scanning, no "smart" logic that could fail.

---

## 3. Verdict

**OK WITH NITS**

### Blocking concerns: **None**
- Smoke tests pass.
- Links are clickable (not wrapped in backticks).
- Scaffold adds minimal documentation without complexity.

### Non-blocking recommendations:
1. **Validate sibling assumption**: Add a sanity check in `build_draft_packet.py`:
   ```python
   assert args.out.parent == preflight_report.parent == preflight_json.parent, \
       "Draft packet and preflight artifacts must be in the same directory"
   ```
2. **README maintenance note**: Add a line about updating the README if new prompts are added.
3. **Document underscore convention**: One-liner in README explaining `_system_*` naming.

### Why "OK WITH NITS" (not "NEEDS FIX"):
- Nits are about future-proofing and clarity, not correctness.
- Current implementation works as designed (smoke tests confirm).
- Relative link risk is low if usage pattern is controlled (output dir structure is deterministic).

</details>

---

**Summary**: Patch is **approved for merge** with suggested hardening (sibling path assertion) and documentation polish (README maintenance note, underscore convention). No blocking issues.
