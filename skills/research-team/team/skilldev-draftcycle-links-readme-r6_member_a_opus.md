Using the `review-patch` skill to ensure I follow the correct workflow for patch review.

I'll review this minimal patch systematically.

---

# Patch Review: Smoke Test Links + README Convention Doc

## 1. Correctness/UX Review

### Smoke Test Addition (lines 108-118)

**Correctness: ✓ Good**
- The assertions correctly verify that the draft packet contains properly formatted Markdown links to preflight artifacts
- The exact-match grep patterns (`-F` for fixed strings) ensure the links are clickable Markdown format: `[filename](filename)`
- Error handling follows the existing pattern: on failure, dumps first 120 lines of the packet for debugging
- Line numbers in grep output (`-n`) aid debugging

**UX considerations:**
- The test naming `[test2b]` is clear—it's a sub-assertion of test2's setup
- Error messages are actionable ("expected preflight report link missing from packet")

### README Template Addition

**Correctness: ✓ Good**
- The one-line explanation is accurate: `_`-prefixed files are defaults/templates used by scripts
- Placement under "Note:" section is appropriate—doesn't clutter the main documentation flow
- Language "customize them per project" gives users clear guidance

**UX considerations:**
- The convention explanation is discoverable where users will look (the prompts README)
- Single line keeps it minimal as intended

---

## 2. Risks / Edge Cases

### Low Risk
1. **Grep pattern brittleness**: The exact-match patterns depend on specific formatting in the packet generator. If someone later changes the link format (e.g., adds a space or uses absolute paths), the test breaks. However, this is *intentional*—it's a contract test. **Acceptable.**

2. **README template is scaffolded once**: The note about `_` convention only helps new projects. Existing projects won't see it unless they manually update their `prompts/README.md`. **Acceptable for minimal scope—documentation exists in skill files too.**

### Non-issues
- The test doesn't verify the links actually resolve (files exist)—but that's outside scope; the preflight check already validates artifact generation.
- No new dependencies or configuration changes.

---

## 3. Recommendation

**APPROVE**

The patch meets its stated goals with minimal, correct changes:
- Smoke test enforces the clickable-link contract without over-testing
- README addition is appropriately brief and placed correctly

No nits—the implementation is clean and matches the constraints.
