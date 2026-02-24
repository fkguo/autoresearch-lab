I need to review documentation for accuracy and clarity. Let me check if there's a relevant skill first.

<use_skill>
<skill_name>reviewing</skill_name>
<explanation>Reviewing documentation changes for technical accuracy and user navigation</explanation>
</use_skill>

<use_skill>
<skill_name>using-superpowers</skill_name>
<explanation>Need to check available skills for documentation review</explanation>
</use_skill>

Based on the available skills, I'll proceed with a direct technical review focused on the stated criteria.

---

## Verdict: **OK with minor concerns**

## Concerns

- **Minor terminology drift**: "writing bundle export" vs "paper bundle" — both terms appear (RUNBOOK says "writing bundle", SKILL.md says "paper bundle", script is `export_paper_bundle.sh`). Recommend picking one term consistently.

- **Gate scan target asymmetry**: SKILL.md shows `PROJECT_MAP.md` added to math hygiene gate scan targets, but RUNBOOK excerpt doesn't confirm all three hygiene gates (math/macro/link) consistently include it. The RUNBOOK text says "default scan target lists for math/macro/link hygiene gates to include `PROJECT_MAP.md`" but doesn't show the actual gate invocation examples.

- **Implicit knowledge boundary**: Users unfamiliar with the trajectory index (`trajectory_index.json`) won't know what it does from these excerpts alone. If `PROJECT_MAP.md` is the "single front door," should it explain or link to trajectory concepts, or is that intentionally left to deeper docs?

## Minimal Improvements

1. **Terminology**: Pick one term — either "paper bundle" or "writing bundle" — and use it consistently in both RUNBOOK.md and SKILL.md (script name is `export_paper_bundle.sh`, so "paper bundle" may be simplest).

2. **Gate scan confirmation**: Add a one-line example in RUNBOOK showing that all three hygiene gates (math/macro/link) now scan `PROJECT_MAP.md` by default, e.g.:
   ```
   All hygiene gates (math, macro, link) now scan PROJECT_MAP.md by default.
   ```

3. **Trajectory index mention**: If `trajectory_index.json` is visible in the front door workflow, add one sentence in RUNBOOK explaining its role (e.g., "Tracks run history for navigation; see [trajectory docs] for details") or explicitly note it's an internal artifact users can ignore.

4. **Consistency check**: Confirm that `update_project_map.py --notes Draft_Derivation.md --team-dir team` example matches the script's actual default behavior (does it auto-detect `team/` if omitted?). If `--team-dir team` is always required, the example is fine; if it's optional, clarify.

5. **Link hygiene self-test**: The review packet itself should demonstrate the desired link format — all Markdown links in the excerpts correctly avoid backtick-wrapping (✓), so no change needed, but call out in final commit message that this was intentionally validated.

---

**Overall**: The changes deliver on the stated goal (reduce "file swamp" via `PROJECT_MAP.md` front door + `LATEST*.md` pointers + `team/runs/<tag>/...` layout). Navigation is clear, script alignment is correct, and the optional export workflow is appropriately scoped. The concerns are cosmetic/consistency-level, not structural.
