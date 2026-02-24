# Adjudication — skilldev-project-nav-ux-r1 (Project Navigation UX)

## Problem

Projects produced by `research-team` can generate hundreds/thousands of files; users cannot quickly locate:
- the full derivation chain,
- the algorithm/method selection chain,
- a writing-ready view.

## Member Reviews (A/B/C)

- Member A (Opus): `team/skilldev-project-nav-ux-r1_member_a_opus.md` → **Recommend staged P0→P1→P2**; P0 is the minimum viable fix; P1 high value to reduce clutter; P2 optional.
- Member B (Gemini): `team/skilldev-project-nav-ux-r1_member_b_gemini.md` → **Recommend P0 first, then a *modified* P1**; warns deep archiving/nesting can break agent reliability and cause link rot; prefers archiving only “closed” material.
- Member C (Sonnet): `team/skilldev-project-nav-ux-r1_member_c_sonnet.md` → **CONCERNS (non-blocking)**; agrees P0→P1→P2 but insists P0 must be auto-generated + validated to avoid “dashboard decay”; pushes `LATEST.md` pointers + partitioning for scale.

## Adjudication (Recommendation)

**Adopt a staged hybrid: P0 + shallow P1 now; P2 later.**

Rationale:
- P0 is unanimously “essential” and fixes the *orientation* failure immediately.
- P1 is necessary for >O(10) cycles, but should be implemented in a way that keeps agent usage shallow:
  - stable root entrypoint,
  - stable `LATEST.md` pointers,
  - avoid requiring users/agents to traverse large deep trees for normal operation.
- P2 is valuable for paper deadlines, but should be optional and not a prerequisite for day-to-day team cycles.

## Minimal Spec (P0 + shallow P1)

**Files (root / stable):**
- `PROJECT_MAP.md` (or `START_HERE.md`): canonical “front door” (≤ ~100 lines, task-oriented).
- `team/LATEST.md`: points to latest run outputs (A/B/adjudication + status).
- `artifacts/LATEST.md`: points to latest figure/data/manifest set (if applicable).
- `knowledge_base/INDEX.md` (optional Tier-2): generated map; may be long; `PROJECT_MAP.md` links to it.

**Directory layout (shallow P1):**
- `team/runs/<tag>/...` and `artifacts/runs/<tag>/...` (or equivalent) so top-level dirs stay readable.
- `PROJECT_MAP.md` links primarily to root docs + `LATEST.md` (not to arbitrary historical files).

**Update triggers:**
- Scaffold creates `PROJECT_MAP.md` + `LATEST.md` stubs.
- After each successful team cycle / draft cycle: auto-update `PROJECT_MAP.md` + `LATEST.md` pointers deterministically.

**Gate policy (practical):**
- **Mandatory**: `PROJECT_MAP.md` exists and contains links to the 4 canonical docs (`PROJECT_CHARTER.md`, `RESEARCH_PLAN.md`, `PREWORK.md`, `Draft_Derivation.md`) + latest team status link.
- **Warn-only**: link integrity checks (broken link report), and optional “stale map” warning based on timestamp.

## Next Step

Implement P0 + shallow P1 in the skill (new scaffold templates + deterministic updater + light gate), then run full smoke/regression.

