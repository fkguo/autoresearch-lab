VERDICT: NOT_READY

## Blockers
- Test-instance pollution persists in `docs/plans/auto-relay/idea-program.profile.yaml`, which contains a hardcoded `m5_case` for the "pion GFF bootstrap" research seed. This violates the decoupling policy.
- Test-instance research artifacts persist in `docs/plans/agent-team-output/2026-02-15-m5-retro-swarm-v1/`, which contains detailed physics-specific audit logs (e.g., `claude_output.md` and `gemini_output.md` with specific Julia code critiques for the pion project). This content should be moved to the `idea-runs` repository.
- The anti-pollution gate `scripts/check_no_test_instance_pollution.py` has false negatives; it only checks three specific roots (`research/`, `docs/research/`, `artifacts/runs/`) and fails to detect research-specific content embedded in `docs/plans/` or `docs/reviews/`.

## Non-blocking
- The `Makefile` in `idea-generator` is too minimal; it only runs the pollution check but does not yet integrate schema validation or other generic quality gates.
- The `idea-runs` monorepo structure lacks a clear `PROVENANCE.md` or similar machine-readable metadata in the archive paths to track exactly when and from where content was migrated.

## Real-research fit
- The architectural move to a decoupled `idea-runs` repository is essential for scaling across multiple physics targets (e.g., pion GFF, dark matter EFT, etc.) while keeping the toolchain version-locked via `manifest.lock.json`.
- The retrospective document `docs/plans/2026-02-15-m5-test-instance-retro-and-hardening.md` is a high-value tooling policy artifact that correctly identifies "method drift" as a critical quality risk.

## Robustness & safety
- The gate script correctly implements a "fail-fast" strategy in `make validate`.
- `FORBIDDEN_ROOTS` is a good starting point, but a keyword-based heuristic (e.g., grepping for "pion", "gff" in non-archive paths) would be more robust against accidental pollution in planning subdirectories.

## Specific patch suggestions
- `scripts/check_no_test_instance_pollution.py`: Expand `FORBIDDEN_ROOTS` or implement a content-scanning check to prevent physics-specific seeds/logs from leaking into `docs/plans/` or `docs/reviews/`.
- `docs/plans/auto-relay/idea-program.profile.yaml`: Remove the `m5_case` section or replace it with a generic `example_case` template. Move the actual pion charter to a project subdirectory in `idea-runs`.
- `docs/plans/agent-team-output/2026-02-15-m5-retro-swarm-v1/`: Relocate this entire directory to `idea-runs/projects/pion-gff-bootstrap-m5-legacy/reviews/`.
