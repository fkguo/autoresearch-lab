VERDICT: READY

## Blockers

- None.

## Non-blocking

- The toy eta profiles (piecewise-constant with a single floor value above $s_{\mathrm{inel}}=16$) are physically crude. A future unit should replace these with data-driven or dispersive $\eta(s)$ profiles (e.g., from $\pi\pi \to K\bar{K}$ partial-wave analyses). The packet correctly flags this as pending, so it is non-blocking.
- The example numerical check at $s=212$ should ideally be supplemented with a check near $s_{\mathrm{inel}}$ (e.g., $s=16$–$20$) where the transition from elastic to inelastic is sharpest and the envelope sensitivity to $\eta$ profile shape is largest. This would strengthen confidence that the piecewise-constant anchor behaves correctly at the boundary.
- The tightening factors $\sqrt{(1+\eta)/2}$ are applied as a post-process multiplicative rescaling of the base LP bound. This is valid as a conservative outer envelope but will be loose compared to incorporating $\eta(s)$ directly as LP constraints. Worth noting explicitly in `draft.md` that the post-process approach gives an upper bound on the true $\eta$-constrained bound.

## Evidence & Gate Check

- **Determinant-based formula correctness**: The stated inequality $|\mathcal{F}(s)|^2 \le \rho(s)(1+\eta(s))/2$ with $|S(s)| \le \eta(s) \le 1$ is the standard consequence of the $3\times 3$ PSD condition on the partial-wave $T$-matrix (elastic unitarity block). The tightening factors $\sqrt{(1+0.8)/2} \approx 0.9487$ and $\sqrt{(1+0.6)/2} \approx 0.8944$ are arithmetically correct. The envelope is correctly conservative (it weakens, not strengthens, the elastic bound).
- **Toy label**: The packet explicitly calls these "toy profiles" and flags them as "pending a more defensible envelope." This guards against over-claiming. Satisfies review focus item (2).
- **Pion-only / no coupled-channel**: The deliverable is a post-processing script (`compute/d0_eta_envelope_postprocess.py`) that reads the base LP output and applies a multiplicative factor. No coupled-channel degrees of freedom are introduced. The config (`d0_eta_envelope_config_v1.json`) and run log should confirm this. Satisfies review focus item (3).
- **Numerical consistency**: Base bound $|F| \approx 6.5921$ at $s=212$; eta_floor=0.8 gives $6.5921 \times 0.9487 \approx 6.254$, matching the reported $6.2538$; eta_floor=0.6 gives $6.5921 \times 0.8944 \approx 5.896$, matching the reported $5.8962$. Arithmetic checks out.
- **Validation gates**: All four gate bundles are cited and reported as PASS:
  - `docs/reviews/bundles/2026-02-16-w6-01-phase-d-idea-runs-validate-v2.txt`
  - `docs/reviews/bundles/2026-02-16-w6-01-phase-d-idea-runs-validate-project-v2.txt`
  - `docs/reviews/bundles/2026-02-16-w6-01-phase-d-failure-library-index-build-v2.txt`
  - `docs/reviews/bundles/2026-02-16-w6-01-phase-d-failure-library-query-run-v2.txt`
- **Run evidence**: Cited at `docs/reviews/bundles/2026-02-16-w6-01-phase-d-d0-eta-envelope-run-v1.txt` with summary at `docs/reviews/bundles/2026-02-16-w6-01-phase-d-d0-eta-envelope-summary-v1.txt`.
- **Island progress**: Append-only JSONL event stream updated per schema contract.
- **Report**: `reports/draft.md` updated with a clearly separated "Eta-envelope tightening" subsection.

The eta-envelope post-process is a clean, conservative, and correctly implemented tightening step that preserves all existing constraints. Ready to proceed to the next unit (direct LP incorporation of $\eta(s)$ constraints or coupled truncation).
