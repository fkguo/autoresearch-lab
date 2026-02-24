I'll invoke the research-team skill to ensure I'm reviewing against the current canonical behavior.

Using the research-team skill to verify the canonical layout and gate semantics for this review.

Now let me examine the actual skill content to verify the canonical layout and compare against the proposed documentation updates.

Let me also check the specific scripts and gates referenced to verify path accuracy.

Let me check the actual gate scripts to verify the command-line interface:

Let me also verify the actual output layout used by the scripts:

Now let me verify the PROJECT_MAP and LATEST pointer structure:

Based on my review of the skill files, scripts, and actual project structure, here is my assessment:

DECISION: REQUEST_CHANGES

BLOCKERS:
- `research_team_skill_usage_zh_v1.md`: Capsule gate script path uses `check_reproducibility_capsule.py` but the actual script is `check_reproducibility_capsule.py` (correct) - however, the `--notes` flag should be `--artifact` based on the argparser in the script (line: `parser.add_argument("--artifact", "-a", required=True, ...)`). Fix: change `--notes ./Draft_Derivation.md` → `--artifact ./Draft_Derivation.md`
- `research_team_skill_usage_zh_v1.md`: Claim gate debug command uses `--notes` but `check_claim_graph.py` uses `--artifact` flag. Fix: change `--notes ./Draft_Derivation.md` → `--artifact ./Draft_Derivation.md`
- Missing from canonical layout specification: `team/runs/<tag>/<tag>_trajectory_appendix.md` is created by orchestration scripts (see `append_trajectory.py` output) but not listed in the "Canonical layout" section of the review packet. Either add it or confirm it's intentionally omitted.

NONBLOCKING:
- `hybrid_architecture_claim_dag_trajectory_v1.md`: minority report path `team/runs/<tag>/<tag>_minority_member_a.md` uses underscore between `minority` and `member_a`. Verify this matches actual manual naming convention - the pattern is plausible but no script enforces it; consider documenting it's a suggested convention, not enforced.
- Graphviz diagrams: The `research_team_system_map_v1.dot` should include edge from `append_trajectory.py` → `trajectory_index.json` if that script updates the index (verify append_trajectory.py behavior).
- Consider adding `team/runs/<tag>/<tag>_synthesis.md` to canonical layout if synthesis output is a standard artifact (check if orchestrator produces this).

NOTES:
- Verified `scripts/gates/check_reproducibility_capsule.py` uses `--artifact` not `--notes` (lines 47-48 in argparser)
- Verified `scripts/gates/check_claim_graph.py` uses `--artifact` not `--notes` (lines 38-39 in argparser)
- The `PROJECT_MAP.md` navigation front door pattern is correctly reflected in the Graphviz sources
- `team/LATEST.md`, `team/LATEST_TEAM.md`, `team/LATEST_DRAFT.md` pointer pattern appears consistent with skill definition
- Demo generator script path `scripts/bin/generate_demo_milestone.sh` exists and path is correct
- Smoke test path `scripts/dev/smoke/smoke_test_capsule_gate.sh` exists and path is correct
- The `--root <PROJECT_ROOT>` optional flag documentation is accurate for the capsule gate
