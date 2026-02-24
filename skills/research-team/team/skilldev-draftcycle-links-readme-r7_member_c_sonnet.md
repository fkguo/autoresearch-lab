I need to audit this minimal UX patch for robustness and minimalism. Let me check if there are any relevant skills first.

<Skill>
<name>code-review</name>
</Skill>

**Using code-review skill to audit the UX patch systematically**

<TodoWrite>
<title>Audit UX patch for robustness and minimalism</title>
<bullets>
<bullet>Check relative link correctness in build_draft_packet.py</bullet>
<bullet>Assess grep brittleness in smoke test assertions</bullet>
<bullet>Verify prompts README template clarity</bullet>
<bullet>Check for over-engineering</bullet>
<bullet>Validate output contract compliance</bullet>
</bullets>
</TodoWrite>

## Audit: Minimal UX Patch for Draft Packet Links

### 1. Nits / Risks

#### Relative Link Construction (build_draft_packet.py, lines 475-479)
**RISK: Path traversal edge case**
```python
href = os.path.relpath(prompts_readme.resolve(), start=args.out.parent.resolve()).replace(os.sep, "/")
```

The code uses `.resolve()` (absolute paths) then `relpath()` - this is robust. However:
- **Nit**: If `args.out.parent` doesn't exist yet (line 457 creates it), `.resolve()` behavior depends on Python version for non-existent parent dirs
- **Mitigation**: Line 457 (`args.out.parent.mkdir(parents=True, exist_ok=True)`) runs **before** line 477, so parent exists. ✓ Safe.

**Correctness check**: The test expects `../prompts/README.md` from `team/D0-r1_draft_packet.md` → `prompts/README.md`. The relpath logic produces this correctly when both paths are resolved.

#### Grep Brittleness (smoke test, lines 114-128)
**MODERATE RISK: Fixed-string assertions too rigid**

Three grep assertions:
```bash
grep -nF -- "- Preflight report: [D0-r1_draft_preflight.md](D0-r1_draft_preflight.md)"
grep -nF -- "- Preflight structure map (JSON): [D0-r1_draft_structure.json](D0-r1_draft_structure.json)"
grep -nF -- "- Prompt files README: [prompts/README.md](../prompts/README.md)"
```

**Issues**:
1. **Exact whitespace dependency**: Any formatting change (e.g., double-space → single-space after colon) breaks test
2. **Label text brittleness**: Changing "Preflight report:" to "Preflight Report:" breaks test
3. **False precision**: We care about *link presence*, not *exact formatting*

**Recommendation**: Use regex patterns for flexibility:
```bash
# Example: check link target exists, allow label variation
grep -E '\[.*\]\(D0-r1_draft_preflight\.md\)'
grep -E '\[.*\]\(\.\./prompts/README\.md\)'
```

**Counter-argument (minimalism)**: Fixed strings document the **exact output contract**. If we want format stability, this is a feature, not a bug.

**Verdict**: Acceptable for now (output contract is intentionally strict), but **brittle by design**. Consider relaxing if format churn occurs.

#### Prompts README Template Clarity
**MINOR: Underscore convention explanation**

Template says:
> Files prefixed with `_` are scaffolded defaults used by scripts.
> Customize them per project (they are meant to be edited).

**Nit**: "Customize them" could be misread as "you must customize" vs. "you may customize". 

**Suggested tweak** (optional):
> Files prefixed with `_` are scaffolded defaults. Edit them to fit your project.

**Severity**: Low. Current wording is clear enough.

#### Over-Engineering Check
**PASS**: No over-engineering detected.
- Link logic: minimal (5 lines)
- Smoke test: direct assertions (no abstraction layers)
- Template: 2 sentences as specified

### 2. Verdict

**OK WITH NITS**

**Summary**:
- ✓ Relative link construction is correct (resolved paths prevent breakage)
- ⚠️ Grep assertions are brittle by design (acceptable trade-off for contract enforcement, but will break on formatting changes)
- ✓ No over-engineering
- ✓ Prompts README is clear (minor wording nit is cosmetic)

**Recommended follow-up** (non-blocking):
- If format churn occurs in packet output, relax grep patterns to regex
- Consider adding a test comment explaining the brittleness trade-off

**No blocking issues identified.** Patch achieves stated goals with acceptable risk profile.
