I will verify the codebase structure and scripts to ensure they align with the review packet's description of the desired "Nutstore localdocs sync" behavior.

I will read the relevant scripts to verify that the codebase implements the structure and features described in the review packet.

I will read `scripts/bin/run_team_cycle.sh` and `assets/research_team_config_template.json` to verify the output directory structure and default configuration settings.

DECISION: ACCEPT

BLOCKERS:
- (None)

NONBLOCKING:
- (None)

NOTES:
- Verified `team/runs/<tag>` canonical layout is enforced by `scripts/bin/run_team_cycle.sh`.
- Verified `PROJECT_MAP.md` generation and `LATEST` pointer updates via `scripts/bin/update_project_map.py`.
- Verified `PROJECT_MAP.md` is explicitly listed in `markdown_math_hygiene.targets` in `assets/research_team_config_template.json`, matching hygiene requirements.
- Verified existence of all called-out scripts (smoke tests, demo generators, gates).
- Verified `render_claim_graph.py` hook in `run_team_cycle.sh` for Graphviz updates.
