I'll check if there are any relevant skills for this review task.

<function_calls>
<invoke name="Skill">
<parameter name="skill_name">code-review</parameter>
</invoke>
</function_calls>
<thinking>
The user wants me to review a UX patch. Let me check if there's a code-review skill that might apply.
</thinking>

<function_calls>
<invoke name="Skill">
<parameter name="skill_name">brainstorming</parameter>
</invoke>
</function_calls>
<thinking>
Let me check for any relevant skills that might apply to this review task.
</thinking>

I'll proceed with the review based on the patch provided and the stated requirements.

---

# UX Patch Review: Draft Cycle Enhancements

## 1. Correctness/UX Review

### What the patch claims to do vs. what it actually does:

| Claimed Change | Evidence in Diff | Status |
|----------------|------------------|--------|
| Draft packet includes clickable links to preflight report + JSON structure map | **NOT SHOWN** — diff only shows scaffold changes | ❓ Incomplete patch |
| Scaffold writes `prompts/README.md` | ✅ `copy_template ... prompts_readme_template.md → prompts/README.md` | ✅ Correct |
| New draft-cycle system prompts added | ✅ `_system_draft_member_a.txt`, `_system_draft_member_b.txt` | ✅ Correct (bonus) |

### Critical Observation:
**The diff is incomplete.** The description says `build_draft_packet.py` now inserts clickable links, but **the patch only shows changes to `scaffold_research_workflow.sh`**. I cannot verify:
- Whether links are correctly formatted as clickable Markdown (`[text](url)`)
- Whether links are NOT wrapped in backticks
- Whether the preflight report path resolution is correct

### What IS shown looks correct:
- Template copy order is logical (draft prompts grouped near related system prompts)
- `README.md` placement in `prompts/` is standard and discoverable

---

## 2. Risks / Edge Cases

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Missing `build_draft_packet.py` changes** — cannot verify link clickability constraint | 🔴 High | Provide complete diff |
| **Template files not shown** — cannot verify `prompts_readme_template.md` content quality | 🟡 Medium | Low risk if smoke tests validate |
| Relative vs. absolute paths in links — if preflight/JSON files move, links break | 🟡 Medium | Use relative paths; document assumption |
| `prompts/README.md` overwrites on re-scaffold | 🟢 Low | Expected behavior; `copy_template` likely handles this |
| Draft system prompts added without explanation | 🟢 Low | Appears intentional; adds capability for draft-specific Member A/B behavior |

---

## 3. Recommendation

### **APPROVE WITH CHANGES**

#### Required before merge:
1. **Include the `build_draft_packet.py` diff** — the core UX claim (clickable links) cannot be verified without it.

#### Should verify (but not blocking if smoke tests pass):
2. Confirm links in draft packet use bare Markdown syntax: `[Preflight Report](./preflight_report.md)` — NOT `` `[link](url)` ``
3. Confirm `prompts_readme_template.md` content matches the stated purpose (explain each prompt file).

#### No changes needed:
- Scaffold ordering is fine
- Addition of draft-specific system prompts is a reasonable enhancement
- Smoke test pass provides baseline confidence

---

**TL;DR:** The scaffold half looks good, but **I cannot approve the "clickable links" claim** because that code isn't in the diff. Please provide the complete patch.
