I'll review this UX patch carefully.

---

## 1) Correctness/UX Review

### 1A. Clickable Links in Draft Packet (lines 471-473)

**Correctness: ✓**
- The Markdown link syntax `[name](name)` is correct for relative links to sibling files.
- Links are *not* wrapped in backticks—they will render as clickable in Markdown viewers.
- The comment on line 471 documents the intent, which is good defensive practice.

**UX: ✓**
- Reviewers can now click directly to preflight artifacts instead of hunting for filenames—reduces friction.
- Placing these links in the "Deterministic Preflight Summary" section is logical grouping.

### 1B. `prompts/README.md` (new template + scaffold line 113)

**Correctness: ✓**
- Template clearly explains each prompt file's purpose.
- Grouping by "Team cycle" vs "Draft cycle" is helpful taxonomy.
- `copy_template` placement (line 113) fits the existing scaffold flow.

**UX: ✓**
- New users get orientation without reading source code.
- The underscore-prefix convention for prompt files is implicitly documented via the listing.

**Minor observation:** The template header says `# prompts/README.md`—this is a bit unusual (most READMEs just say `# README` or describe contents). Not a blocker; some projects do use this style for path-awareness.

---

## 2) Risks / Edge Cases

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Relative links break if packet is moved** | Low | Links are to *sibling files*; users typically review in-place. If moved, links break—but this is standard Markdown behavior. No action needed. |
| **`preflight_report` or `preflight_json` variables could be `None`** | Medium | Code should guard against this. Excerpt doesn't show the guard—verify upstream that these are always populated when lines 472-473 execute. |
| **README template drift** | Low | If new prompt files are added later, `prompts/README.md` may go stale. Acceptable: it's scaffolded once; users can edit. |
| **Overwrite on re-scaffold** | Low | `copy_template` semantics matter—if it overwrites existing `prompts/README.md`, user edits are lost. Verify `copy_template` is non-destructive (typical pattern: skip if exists). |

---

## 3) Recommendation

**APPROVE WITH NITS**

### Actionable nits (optional, non-blocking):

1. **Confirm `preflight_report` / `preflight_json` are never `None` at lines 472-473.** If they can be, add a guard or omit the links when absent.

2. **Confirm `copy_template` semantics.** If it overwrites unconditionally, consider documenting this or making it non-destructive for `prompts/README.md` specifically (since users might customize it).

3. *(Cosmetic)* Consider changing the template header from `# prompts/README.md` to something like `# Prompt Files` or `# prompts/` for slightly cleaner rendering. Purely stylistic.

---

**Summary:** The patch is minimal, well-targeted, and improves discoverability without adding LLM constraints or over-engineering. Smoke tests pass. Ship it.
