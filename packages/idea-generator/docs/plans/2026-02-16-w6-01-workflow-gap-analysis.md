# W6-01 Workflow Gap Analysis (Post Seed-Intake) — 2026-02-16

Purpose: record workflow defects discovered during W6-01 execution, plus concrete remediation ideas that can be integrated later (without creating a parallel tracker; SSOT remains `docs/plans/2026-02-12-implementation-plan-tracker.md`).

NOT_FOR_CITATION (internal process notes).

## Gap 1 — No systematic literature expansion beyond the 5 seed papers

Observed:
- W6-01 initially relied on the 5 core arXiv seeds, but did not automatically expand to:
  - existing pion GFF determinations (lattice, dispersive, model ecosystem),
  - known positivity-style constraints on EMT/GFF observables (beyond GTB PSD),
  - “guardrail” negative results (e.g., GPD positivity violations in common model classes).

What we did (stopgap, evidence-first):
- Added a reproducible arXiv API scout log and a curated related-work map (stored in the **idea-runs** project):
  - `idea-runs/.../literature/search/2026-02-16-arxiv-scout-v1.txt`
  - `idea-runs/.../literature/related/2026-02-16-related-work-map.md`
- Added a new island (`island-ecosystem-benchmarks`) and appended 5 new opportunity cards (machine-checkable, append-only) to track integration targets.

Remediation (future):
- Add a small, deterministic “literature scout” script/target that:
  - runs a fixed set of arXiv API queries and stores outputs with timestamps,
  - optionally performs citation expansion from seed bib files,
  - emits machine-checkable “reference cards” (or opportunity cards) with reuse tags,
  - is wired into gates so the scout output cannot be silently skipped.

## Gap 2 — Cross-repo “instance artifact” pollution risk (path/workdir ambiguity)

Observed:
- During W6-01, instance-style files were accidentally written into the **idea-generator** repo due to relative-path editing and workdir ambiguity.
- This violates the repo hygiene intent (“design repo only; instances live in idea-runs”) and can be easy to miss if not gated.

What we did (immediate hardening):
- Extended `make validate` pollution check to forbid typical instance roots:
  - `projects/**`, `runs/**`, `artifacts/**`, `literature/**` (in addition to `research/**`, `docs/research/**`).
- Removed the accidental pollution directories and ensured all instance artifacts live under `idea-runs/projects/...`.

Remediation (future):
- Add a “preflight guard” pattern: any stage that writes files must declare target repo + absolute paths in an execution manifest (even for local agent work).
- Consider adding a `scripts/assert_repo_role.py` helper that fails fast if a write target is outside the declared repo root.

## Gap 3 — Novelty/coverage risk: no explicit “ecosystem baseline” checkpoint

Observed:
- Without a structured baseline checkpoint, there is a real risk of claiming novelty that is already present in:
  - lattice data,
  - meson-dominance fits,
  - dispersive determinations (even if they use coupled-channel inputs we cannot execute).

Remediation:
- Treat “ecosystem benchmarking” as a first-class island with explicit evaluation metrics:
  - coverage of >= 10 related works,
  - at least one benchmark overlay plot in shared normalization,
  - explicit coupled-channel veto points documented.

## Gap 4 — Mainline physics gap: mapping from GTB objects to pion GFFs not yet fully closed

Observed:
- Current numerics is a D0 spectral-density LP prototype + eta-envelope postprocess.
- We still need an auditable mapping from the GTB form factor objects (e.g., 2++ partial waves / EMT projection operators) to the target pion GFF(s), especially $A^\\pi(t)$.

Remediation:
- Prioritize a normalization/mapping derivation (operator relations + projector conventions) and encode key identities as regression checks.

## Gap 5 — Tooling defects surfaced during dual-review + board-sync steps

Observed:
- **Gemini CLI**: `--approval-mode plan` is documented in `gemini --help`, but it fails unless `experimental.plan` is enabled (error: approval mode "plan" only available when experimental.plan is enabled). This can cause a false-negative in the "dual review" gate if not handled explicitly.
- **gh CLI**: `gh project item-edit` for DraftIssue body updates fails with `GraphQL: Title can't be blank` unless `--title` is passed explicitly, even when only the body is intended to change (workaround: pass the existing title).

Remediation:
- Add a tiny, deterministic "review runner" wrapper that:
  - probes gemini capabilities up front (plan mode availability), and
  - records the exact command lines + stderr to the review bundle,
  - enforces verdict-first output contract by re-prompting when violated.
- Add a board-sync helper that always supplies the current title when editing DraftIssue bodies and records the workaround in the evidence bundle.
