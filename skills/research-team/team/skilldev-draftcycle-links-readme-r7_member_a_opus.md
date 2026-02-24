I'll review this minimal UX patch to the TeX draft cycle.

---

# Review: Minimal UX Patch — Draft Packet prompts/README.md Link

## 1) Correctness/UX Review

### Implementation Correctness

**build_draft_packet.py (lines 475-479):**
- ✅ Conditional check `prompts_readme.is_file()` correctly handles missing file case
- ✅ Relative path calculation using `os.path.relpath()` with explicit `start=args.out.parent.resolve()` is correct for generating clickable Markdown links
- ✅ Path separator normalization (`.replace(os.sep, "/")`) ensures cross-platform URL compatibility
- ✅ Label uses `_rel(root, prompts_readme)` for human-readable display (consistent with other provenance lines)
- ✅ Placement in the "Deterministic Preflight Summary" section is logical since it's reference material for reviewers

**Smoke test (lines 27-30, 124-128):**
- ✅ Creates `prompts/README.md` stub early in test setup
- ✅ Asserts exact link format: `[prompts/README.md](../prompts/README.md)`
- ✅ The relative path `../prompts/README.md` is correct given output is in `team/` subdirectory
- ✅ Failure mode provides diagnostic output (`sed -n '1,140p'`)

**Template (assets/prompts_readme_template.md):**
- ✅ Two-sentence convention clarification is minimal and clear
- ✅ Explains WHAT (`_`-prefix = scaffolded defaults) and WHY (meant to be edited)
- ✅ Maintains existing structure/inventory without bloat

### UX Assessment

| Aspect | Assessment |
|--------|------------|
| Discoverability | Good: link appears alongside other preflight links, making it natural to click |
| Conditional display | Good: no dead link when file doesn't exist |
| Link target utility | Good: README explains file conventions, reducing reviewer confusion |
| Minimalism | Good: single line addition to packet, no new dependencies |

## 2) Risks / Edge Cases

### Low Risk

1. **Symlinked prompts directory**: `is_file()` follows symlinks, so a symlinked README will work correctly. ✅ No action needed.

2. **prompts/ exists but README.md doesn't**: Link simply doesn't appear. ✅ Graceful degradation.

3. **Deeply nested output directory**: `os.path.relpath()` handles arbitrary depth correctly. ✅ Tested implicitly via `team/` subdirectory in smoke test.

### Observations (not risks)

4. **README content not validated**: The smoke test only checks link presence, not README quality. This is appropriate—content validation would be over-engineering for a UX patch.

5. **No migration path for existing projects**: Projects without `prompts/README.md` won't get the link until they create one. This is intentional and documented behavior (conditional display).

### Potential Nit (very minor)

6. **Link label differs from other preflight links**: 
   - Preflight report uses filename only: `[D0-r1_draft_preflight.md](...)`
   - prompts README uses relative path: `[prompts/README.md](...)`
   
   This inconsistency is arguably correct UX—the prompts README lives in a different location, so showing the path aids navigation. Not a blocker.

## 3) Recommendation

**APPROVE**

The patch achieves its stated goal with appropriate minimalism:
- Correct implementation with proper edge case handling
- Regression coverage via smoke test contract assertion
- Clear, concise documentation update
- No unnecessary complexity or over-engineering

No changes required.
