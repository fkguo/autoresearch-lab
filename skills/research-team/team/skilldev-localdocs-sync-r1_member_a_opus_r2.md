I'll review this localdocs update packet carefully, checking for semantic correctness, path consistency, and gate behavior accuracy.

Let me start by invoking the relevant skill to ensure I follow proper review procedures.

DECISION: REQUEST_CHANGES

BLOCKERS:
- **Minority report path mismatch**: Document B shows `<tag>_minority_member_a.md` but the canonical layout section shows `<tag>_minority_<member>.md`. The `_member_` infix is redundant/inconsistent. Should be one of:
  - `<tag>_minority_a.md` (shorter, matches member letter pattern)
  - `<tag>_minority_member_a.md` (explicit but verbose)
  Pick one and enforce everywhere. Current mix will cause lookup failures.

- **Capsule gate script invocation ambiguity**: The command shown is:
  ```
  python3 ~/.codex/skills/research-team/scripts/gates/check_reproducibility_capsule.py --notes Draft_Derivation.md
  ```
  But `Draft_Derivation.md` is a bare filename—no path context. If the script expects a path relative to `--root`, this should be explicit: `--notes path/to/Draft_Derivation.md` or the doc should clarify that CWD must be the project root. Users will get "file not found" errors.

- **Missing `team/trajectory_index.json` in Graphviz diagrams**: The canonical layout lists `team/trajectory_index.json` as a key artifact, but neither diagram excerpt (C or D) mentions it. If the diagrams claim to show the data layer comprehensively, this is a missing node.

NONBLOCKING:
- **Graphviz node label consistency**: Packet node uses `{tag}` but canonical layout uses `<tag>`. Pick one placeholder style for all docs (recommend `<tag>` since it's more common in path templates).

- **`theory_breakthrough_mechanisms_appendix_v1.md` not excerpted**: No verification that this file's paths were actually updated. Request spot-check or excerpt.

- **Hygiene note incomplete**: The hygiene section mentions "global scan target list includes `PROJECT_MAP.md`" but doesn't specify what scans run against it. Clarify whether this is a lint target, a nav-refresh input, or both.

NOTES:
- The `update_project_map.py` inclusion in diagram C is good—shows the refresh trail correctly.
- The LATEST pointer trio (`team/LATEST.md`, `team/LATEST_TEAM.md`, `team/LATEST_DRAFT.md`) plus `artifacts/LATEST.md` is correctly represented in D.
- Script paths under `~/.codex/skills/research-team/scripts/` look consistent with typical skill installation layout.
- The smoke test path (`scripts/dev/smoke/smoke_test_capsule_gate.sh`) and demo generator (`scripts/bin/generate_demo_milestone.sh`) follow a sensible hierarchy.
