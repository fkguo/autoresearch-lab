I will list the contents of `scripts/bin` and `scripts/scaffold` to locate the relevant scripts, and then read `scripts/bin/update_project_map.py` and the scaffolding script to verify the installation paths and functionality described in the documentation.
I will read `scripts/bin/scaffold_research_workflow.sh`, `scripts/bin/update_project_map.py`, and `scripts/bin/export_paper_bundle.sh` to verify the installation paths, script functionality, and supported arguments against the documentation.
I will read `scripts/bin/export_paper_bundle.py` to confirm it accepts the `--tag` and `--out` arguments, and `scripts/gates/check_project_map.py` to verify it correctly enforces the existence and structure of `PROJECT_MAP.md`.
I will write the "Member B" review for the `skilldev-doc-nav-frontdoor-r1` packet, approving the changes as they are consistent with the script logic and project structure.
Error executing tool write_file: Tool "write_file" not found in registry. Tools must use the exact names that are registered. Did you mean one of: "read_file", "activate_skill", "zotero_add"?
I will try to write the review to `team/skilldev-doc-nav-frontdoor-r1_member_b_gemini.md` using `run_shell_command`, assuming it is available despite not being explicitly listed, as it is a standard tool in this environment.
Error executing tool run_shell_command: Tool "run_shell_command" not found in registry. Tools must use the exact names that are registered. Did you mean one of: "search_file_content", "hep_run_create", "zotero_local"?
# Review Packet — skilldev-doc-nav-frontdoor-r1

Decision: APPROVE

The proposed changes successfully address the "file swamp" issue by establishing `PROJECT_MAP.md` as the canonical entry point and grouping run outputs. The documentation aligns with the actual script behaviors (scaffolding paths, argument parsing, and gate logic).

## Assessment
*   **Consistency (Docs vs. Scripts):** Validated.
    *   `scripts/export_paper_bundle.sh` is correctly referenced (scaffolded from assets to the user's project).
    *   `check_project_map.py` gate logic enforces the required links mentioned in the docs.
    *   `update_project_map.py` correctly handles state preservation (team vs. draft) when updating the map.
*   **User Confusion Risk:** Low.
    *   The `team/runs/<tag>` directory structure is a significant improvement over flat lists.
    *   The `PROJECT_MAP.md` "front door" pattern is clear.
*   **Link Hygiene:** Compliant. No incorrect backtick usage around links found.
*   **Overreach:** None. `export_paper_bundle` is correctly marked as optional/project-local.

## Suggestions (Optional)
*   **Gate Output:** The `check_project_map.py` gate suggests running `update_project_map.py` manually. Ensure users understand that running this script updates the `LATEST` pointers based on the *detected* state or provided arguments, which is generally what they want during a fix-up.
