

I'll review this packet carefully, focusing on the physics, numerics, and normalization concerns flagged.

---

VERDICT: READY

---

## Assessment

### 1) Normalization Mapping Risk — Adequately Scoped

The `scale_factor` knob for IR matching is explicitly documented as a temporary assumption, and the failed-approach record (`failed_approach_v1.jsonl` with tag `failure:normalization_mismatch`) plus the evidence note at `idea-runs/.../evidence/neg_results/2026-02-16-d0-ir-absolute-matching-infeasible.txt` close the loop correctly. The negative result is machine-retrievable via the failure library hook (verified by the query-run evidence). This is the right way to handle a normalization mismatch: use scaled/relative constraints, document the absolute-matching failure, and move on.

### 2) Load-Bearing Assumptions — Stress-Tested Within Scope

The `s_max` robustness scan (v6 through v4, covering `s_max` = 16, 25, 36, 50) is the critical stress test for the elastic-sign-window assumption. The results show the expected monotonic behavior:

- Positive lower bound at `Q² = 10 m_π²` only emerges for `s_max ≳ 36` (v8: +0.0211) and strengthens at `s_max = 50` (v4: +0.0547)
- At `s_max = 16` the bound goes negative (-0.0718), confirming the positive-definite region depends materially on the elastic window

This is properly disclosed in the report and the runs are immutable. For a NOT_FOR_CITATION intermediate result, this level of robustness characterization is sufficient. The tail model dependence is the next obvious thing to probe, but that belongs to a future stage, not a blocker for W6-04.

### 3) Numerical Soundness — No Red Flags

The LP pipeline (spectral LP → eta envelope postprocess → Bochner/K0 LP) is config-driven with immutable output runs. The bounds move continuously with `s_max` (no jumps or sign flips that would suggest solver pathology). The positive lower bound region `Q² ≲ 13.9 m_π²` is a smooth interpolation from the scan grid, not an artifact. No discretization concerns are apparent from the results presented.

### 4) Novelty — Genuine and Worth Pursuing

Combining the latest GTB IR constraints (arXiv:2505.19332) with the transverse-density positivity framework (arXiv:2412.00848) is a genuinely new constraint pattern. The fact that IR matching alone tightens the spectral envelope enough to produce a **nontrivial positive lower bound** on `A^π(-Q²)` at low `Q²` is a concrete, quantitative result. The `s_max` scan maps out exactly where this positivity holds and where it breaks down — this is publishable information once the normalization is hardened.

### 5) Verification Gates — All Pass

All five verification commands pass with evidence files preserved:
- `make validate` (idea-generator): PASS
- `make validate` (idea-runs): PASS
- `make validate-project`: PASS
- `make build-failure-library-index`: PASS
- `make run-failure-library-query`: PASS

### DoD

All four DoD items are satisfied:
- New constraint wiring: code + configs + immutable runs present
- Bounds strictly tighter than v3: documented with preserved runs
- Negative result recorded and retrievable
- Gates pass

### Minor Notes (Non-Blocking)

- The next stage should probe tail-model sensitivity (e.g., varying the asymptotic falloff exponent) as a companion to the `s_max` scan. This is already implicit in the opportunity pool.
- The `scale_factor` approach should eventually be replaced by a proper convention-matching calculation (GTB vs. dispersive conventions), but this is correctly flagged as future work via the failed-approach record.
