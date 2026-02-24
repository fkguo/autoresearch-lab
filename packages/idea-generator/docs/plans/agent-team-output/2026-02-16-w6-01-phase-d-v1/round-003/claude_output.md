VERDICT: READY

## Blockers

- None.

## Non-blocking

- The tightening factor formula $\sqrt{(1+\eta)/2}$ should be explicitly derived in the report subsection (currently the packet states it but the reader of `draft.md` should see the one-line derivation from $|\mathcal{F}|^2 \le \rho\,(1+\eta)/2$ with $\rho$ normalized to unity in the elastic region, so that the square-root origin is transparent). This is a documentation polish, not a blocker.
- The toy profiles are piecewise-constant with a single anchor at $s_{\text{inel}}=16\,m_\pi^2$. A brief comment in `d0_eta_envelope_config_v1.json` (or the report) noting that physical $\eta(s)$ would ramp smoothly and that the step function is a deliberate worst-case simplification would preempt reviewer confusion. Not blocking because the "toy envelope" label already hedges this.
- The three profiles tested (`eta_floor` ∈ {1.0, 0.8, 0.6}) are coarse. Adding 0.9 and 0.4 would better map the sensitivity curve, but this is exploratory refinement, not a gate requirement.

## Evidence & Gate Check

- **Determinant bound correctness**: The stated inequality $|\mathcal{F}(s)|^2 \le \rho(s)(1+\eta(s))/2$ with $|S(s)| \le \eta(s) \le 1$ is the standard consequence of the 3×3 PSD determinant condition for the partial-wave S-matrix including the inelastic channel (see e.g. Caprini–Colangelo–Gasser). The post-process applies this as a multiplicative ceiling on the LP envelope, which is conservative (it can only tighten, never loosen). Correctly stated.
- **Toy-envelope labeling**: The packet explicitly calls it a "toy envelope" and "pending a more defensible envelope." This guards against over-claiming. Adequate.
- **Pion-only / no coupled-channel**: The post-process multiplies the existing pion-only LP upper bound by $\sqrt{(1+\eta)/2}$; it does not introduce any coupled-channel amplitude or new optimization variable. The constraint remains pion-only. Confirmed.
- **Numerical sanity**: At $s=212$, the ratio $6.2538/6.5921 \approx 0.9487$ matches $\sqrt{(1+0.8)/2}$ to four significant figures; $5.8962/6.5921 \approx 0.8944$ matches $\sqrt{(1+0.6)/2}$. The arithmetic is consistent.
- **Validation gates (all PASS)**:
  - `docs/reviews/bundles/2026-02-16-w6-01-phase-d-idea-runs-validate-v2.txt` — global validate pass.
  - `docs/reviews/bundles/2026-02-16-w6-01-phase-d-idea-runs-validate-project-v2.txt` — project-level validate pass.
  - `docs/reviews/bundles/2026-02-16-w6-01-phase-d-failure-library-index-build-v2.txt` — failure library index build pass.
  - `docs/reviews/bundles/2026-02-16-w6-01-phase-d-failure-library-query-run-v2.txt` — failure library query pass.
  - `docs/reviews/bundles/2026-02-16-w6-01-phase-d-d0-eta-envelope-run-v1.txt` — eta-envelope run evidence present.
  - `docs/reviews/bundles/2026-02-16-w6-01-phase-d-d0-eta-envelope-summary-v1.txt` — summary artifact present.
- **Run artifact structure**: `runs/2026-02-16-d0-eta-envelope-v1/` contains `results.json`, `config.json`, `log.txt`, `F_abs_upper_eta.png` — standard run layout, plot included.
- **Island progress stream**: Append-only `ARTIFACT_ADDED` event logged in `artifacts/islands/idea_island_progress_v1.jsonl`.
- **Reproduction path**: Single-command `python3 compute/d0_eta_envelope_postprocess.py` from project root, reading from the v2 LP run. Dependency chain is explicit.

Ready to proceed to the next unit (promoting $\eta(s)$ into the LP objective as a proper optimization variable, or moving toward coupled (S, F, $\rho$) truncation).
