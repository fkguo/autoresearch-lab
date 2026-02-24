# W6-05 Tooling Usage & Gaps (Autoresearch) — 2026-02-16

NOT_FOR_CITATION. Internal workflow notes.

SSOT tracker: `docs/plans/2026-02-12-implementation-plan-tracker.md` (Update Log records the auditable evidence bundle pointers).

## What we used (effective)

- `idea-runs` gates:
  - `make validate`
  - `PROJECT=... make validate-project`
  - failure library hook: `make build-failure-library-index` + `PROJECT=... make run-failure-library-query`
- Bootstrap numerics (laptop-feasible):
  - SciPy `linprog(method="highs")` for LP envelopes and Bochner/K0 bounds.
  - Julia JuMP conic pipeline (Clarabel/ECOS) for joint-rho/ImF SOCP and dispersion-coupled modulus tightening (mainline after W6-06).
  - Immutable run directories under `idea-runs/projects/.../runs/` with `config.json` + `results.json`.
- Dual-model review convergence:
  - `review-swarm` harness (Claude Opus + `gemini-3-pro-preview`) with strict `VERDICT` contract and `--fallback-mode ask`.
- Literature intake (LaTeX-first):
  - `research-team`’s `literature_fetch.py arxiv-source` pattern (used as a fetcher; no scaffold kept in `idea-generator`).

## What we did not use (and why)

- Full `research-team` scaffold (team/runs/notebook SSOT):
  - Reason: current execution repo (`idea-runs`) already has a pilot structure + gates; scaffolding a second workflow inside the same project would add friction and duplicate SSOT concepts.
  - Gap: `research-team` has claim-graph / debt dashboard utilities, but they assume the scaffold layout.
- `hepar` orchestration:
  - Reason: this campaign is a decoupled pilot with local scripts; `hepar` is better when running evidence-first multi-stage pipelines across tools/runs.
  - Gap: could be used later to standardize long-running sweeps and pause/resume semantics.
- `julia-perf` skill:
  - Reason: current Julia workloads are solver-bound (Clarabel/ECOS) rather than raw-kernel heavy; we have not yet done performance-sensitive custom kernels that would benefit from the full `julia-perf` benchmark gate.
  - Note: we *did* switch the mainline optimization from Python/HiGHS to a pinned Julia JuMP environment under the pilot project (`compute/julia/Project.toml` + `compute/julia/Manifest.toml`) after observing a SciPy/HiGHS LP defect (see below).
- SDP tooling (e.g. CVXPY / SDPB):
  - Reason: not installed/configured; the current bounds pipeline is LP-only.
  - Gap: if we pursue Gram/Bochner PSD constraints as an SDP, we need a solver plan (Julia COSMO/SCS or Python CVXPY+SCS) and a pinned env.

## Tooling defects / friction discovered (recorded for backlog)

- Gemini CLI quirks:
  - `--approval-mode plan` requires `experimental.plan` (a previous round failed; we avoided plan mode and enforced strict output contract instead).
  - Mitigation: always run reviews with `--fallback-mode ask` and contract checks; keep review packets small and deterministic.
- GitHub Project (`gh`) DraftIssue editing:
  - `gh project item-edit` for DraftIssue body updates requires passing `--title` as well; otherwise GraphQL errors.
  - Mitigation: treat board sync as its own auditable step with saved JSON snapshots (project/fields/items + item-edit response).
- “State visibility” gap for islands/opportunities:
  - Machine-checkable JSON/JSONL existed, but no scannable summary.
  - Fix (W6-05): added deterministic dashboards and validate-project enforcement via `idea-runs/scripts/render_project_dashboards.py`.
- Conic solver quirks (Julia):
  - SCS: for the dispersion-coupled feasibility check on the v17 grid200 full-interior configuration, SCS can hit `ITERATION_LIMIT` (feasible but not certified within iteration budget). We treat this as a cross-check *attempt* rather than a required baseline solver.
  - ECOS: overly strict tolerances (`eps=1e-10`) can lead to multi-minute runtimes on the same conic program; use pragmatic tolerances (`1e-8`) and rely on residual audits + cross-solver spread as the robustness envelope.
  - Mitigation (W6-07): added explicit per-solve constraint residual auditing into `results.json` so solver feasibility differences are visible and reviewable.

## Actionable next improvements (not a tracker; link-only)

- If we decide to pursue SDP constraints:
  - Create a pinned Julia env under the pilot project (or a shared `idea-runs/compute/julia/` env) and implement a minimal PSD constraint prototype.
- Add a small “scan aggregator” artifact:
  - A script that reads run directories and produces a single JSON/Markdown table for key bounds vs knobs (regulator, `s_max`, tail params).
  - This would reduce manual glue in review packets and make long sweeps easier to audit.
