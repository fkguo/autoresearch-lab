I'll review this documentation update carefully by first examining the actual scripts to verify accuracy.

**Using `research-team` skill to understand the context and verify claims.**

Let me examine the actual implementation files to verify the documentation claims.

---

## Review Summary

**Decision: REQUEST_CHANGES**

### High-Risk Issues

1. **`export_paper_bundle.py` does not exist** — The documentation references `scripts/bin/export_paper_bundle.py` (in the "verify against" list) and `scripts/export_paper_bundle.sh` as a project-local wrapper, but I found no such file in the skill's `scripts/bin/` directory. The RUNBOOK excerpt says "Optional writing bundle export (project-local wrapper): `bash scripts/export_paper_bundle.sh`" — if this script doesn't exist (or is only scaffolded into projects), you must clarify that it's a *scaffolded* file, not a skill-global script. Otherwise users will try to run a non-existent command.

2. **`LATEST_TEAM.md` / `LATEST_DRAFT.md` naming mismatch** — The `update_project_map.py` script writes:
   - `LATEST.md` (always)
   - `LATEST_DRAFT.md` (when `--is-draft`)
   - But the code shows the *non-draft* variant is just `LATEST.md`, not `LATEST_TEAM.md`.
   
   The documentation claims three files (`team/LATEST.md`, `team/LATEST_TEAM.md`, `team/LATEST_DRAFT.md`), but the script only produces two variants. Verify intended behavior and align doc ↔ code.

3. **`artifacts/LATEST.md` + `artifacts/runs/<tag>/...` undocumented in scripts** — The excerpt claims `artifacts/runs/<tag>/...` layout with `artifacts/LATEST.md`, but `update_project_map.py` only handles `--team-dir` outputs; it does not touch an `artifacts/` directory. If this is intended future behavior or handled by a different script, clarify. Otherwise remove or mark as "future."

### Suggested Edits

- **Clarify `export_paper_bundle.sh` origin**: Add "(scaffolded into project by `scaffold_research_workflow.sh`)" so users know it's project-local, not skill-global.
- **Correct LATEST pointer list**: Change `team/LATEST.md`, `team/LATEST_TEAM.md`, `team/LATEST_DRAFT.md` → `team/LATEST.md` (always), `team/LATEST_DRAFT.md` (draft cycles only) — unless you intend to add `LATEST_TEAM.md` to the script.
- **Remove or annotate `artifacts/LATEST.md` + `artifacts/runs/<tag>/`**: Unless another script produces this, the claim is currently false.
- **Gate scan-target alignment confirmed OK**: `check_project_map.py` does check for `PROJECT_MAP.md` existence and required sections; adding it to the scan-target lists in other gates is consistent with current behavior.

### Anything Missing

- **No mention of `--notes` semantics for `update_project_map.py`**: The RUNBOOK example shows `--notes Draft_Derivation.md`, but doesn't explain what this argument does (it sets the derivation-chain anchor). Consider a one-liner.
- **`trajectory_index.json` location**: The SKILL.md excerpt mentions it's maintained but doesn't say where. (It's `team/trajectory_index.json` per the script.) Add explicit path.
- **Link hygiene check**: The excerpts do not wrap Markdown links or citations in backticks — this is correct; no issue here.

---

**Bottom line:** The navigation-front-door concept and `PROJECT_MAP.md` semantics are accurate and valuable. Fix the three high-risk factual mismatches (export script existence, LATEST file naming, artifacts layout) before merging.
