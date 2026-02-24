# Adjudication — skilldev-doc-nav-frontdoor-r1 (Docs: navigation front door)

## Goal

Update `SKILL.md` and `RUNBOOK.md` so users can navigate scaffolded projects without “file swamp”:
- make `PROJECT_MAP.md` the single front door,
- clarify `team/runs/<tag>/...` + `team/LATEST*.md`,
- document the optional paper-bundle export path,
- keep gate/doc alignment (scan targets include `PROJECT_MAP.md`).

## Changes Landed

- `SKILL.md`: add `PROJECT_MAP.md` + `team/runs/<tag>` + `artifacts/` + `scripts/export_paper_bundle.sh` to the scaffold output list; add a short “导航前门” subsection; align math-hygiene scan targets to include `PROJECT_MAP.md`; clarify artifacts are user-produced and the skill maintains `artifacts/LATEST.md` pointers.
- `RUNBOOK.md`: add an “Orientation” section (front door + runs layout + trajectory index + export); add a `check_project_map.py` failure-mode entry; align scan target lists to include `PROJECT_MAP.md`; update pointer-lint report path to `team/runs/<tag>/<tag>_pointer_lint.md`.

## Deterministic Checks

- `bash scripts/dev/run_all_smoke_tests.sh` ✅

## Member Reviews (A/B/C)

- Member A (Opus): `team/skilldev-doc-nav-frontdoor-r1_member_a_opus.md` → **REQUEST_CHANGES**
  - Main concern: claimed missing `export_paper_bundle.py`, missing `LATEST_TEAM.md`, and missing artifacts pointer logic.
  - Adjudication: these concerns are **not supported by the current code**:
    - Export exists: `scripts/bin/export_paper_bundle.py`, `scripts/bin/export_paper_bundle.sh`, and scaffolded project wrapper `assets/export_paper_bundle.sh`.
    - Latest pointers exist: `scripts/bin/update_project_map.py` writes `team/LATEST.md`, `team/LATEST_TEAM.md`, and `team/LATEST_DRAFT.md`.
    - Artifacts pointer exists: `scripts/bin/update_project_map.py` writes `artifacts/LATEST.md` (best-effort).
- Member B (Gemini): `team/skilldev-doc-nav-frontdoor-r1_member_b_gemini.md` → **APPROVE**
- Member C (Sonnet): `team/skilldev-doc-nav-frontdoor-r1_member_c_sonnet.md` → **OK (minor concerns)**
  - Incorporated: terminology consistency (“paper bundle”) + explicit `team/trajectory_index.json` mention.

## Decision

**ACCEPT r1.**

Rationale:
- The docs now clearly point to the single entrypoint (`PROJECT_MAP.md`) and the canonical latest pointers (`team/LATEST*.md`) and match the `team/runs/<tag>/...` layout.
- Minor terminology and trajectory-index clarity improvements applied.
