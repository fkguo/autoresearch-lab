VERDICT: NOT_READY

## Blockers

1. **Slope sum-rule normalization factor of $\pi$ may be missing or doubled.**
   The dispersion relation for the slope is
   $$A'(0) = \frac{1}{\pi}\int_{4m_\pi^2}^{\infty} ds\,\frac{\mathrm{Im}\,A(s)}{s^2}.$$
   The review packet states the constraint is implemented as this integral equals $f_1 = m_\pi^2/m_{f_2}^2$. However, the TMD estimate from arXiv:2507.05375 gives $A'(0)$ directly (i.e., the full derivative, not $\pi \times$ the derivative). The code in `idea-runs/.../compute/julia/bochner_k0_socp_dispersion_bounds.jl` must include the $1/\pi$ prefactor on the discretized integral. Without access to run the code, the review packet does not quote the actual numerical coefficient used in the SOCP row. **A unit-test or print-audit showing the exact row coefficients and the explicit $1/\pi$ prefactor is needed before the INFEASIBLE verdict can be trusted.** If the $1/\pi$ is omitted, the RHS target is effectively $\pi\times$ too large, which would trivially cause infeasibility.

   - File: `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/compute/julia/bochner_k0_socp_dispersion_bounds.jl` — need to see the slope constraint row construction and confirm `1/π` prefactor.

2. **Tail integral `I_slope_tail` sign and magnitude not independently verified.**
   The packet says the code "computes tail integral $I_{\text{slope\_tail}} = \int_{s_0}^{\infty} ds\,\mathrm{Im}_{\text{tail}}(s)/s^2$" and subtracts it. The tail model (power-law or pQCD-inspired) feeds directly into the effective RHS of the slope equality. If the tail model's $\mathrm{Im}\,A(s)$ normalization is inconsistent with the spectral-function normalization used in the grid region $[4, s_0]$, the equality will be internally contradictory regardless of physics. **The numerical value of `I_slope_tail` for the v36 and v37 runs must be quoted and cross-checked against an independent estimate** (e.g., using the fitted spectral function from the baseline feasible run, extrapolated above $s_0$). This is not present in the review packet.

   - File: `idea-runs/.../runs/2026-02-18-a-bochner-k0-socp-v36-.../results.json` — need `slope_eq` residuals and `I_slope_tail` value.

3. **No relaxation / diagnostic sweep to distinguish solver-level vs. physics-level infeasibility.**
   The packet claims "this is a physics-level incompatibility (not solver noise)." However, the only evidence is ECOS returning INFEASIBLE for two configurations. ECOS can return INFEASIBLE due to (a) genuine primal infeasibility, (b) near-infeasibility + numerical conditioning, or (c) poor scaling. **At minimum, the following single-knob diagnostic must be performed before the negative result can be declared READY:**
   - Relax the slope equality to an inequality band: set `f1_absolute_tolerance` to progressively larger values (e.g., 0.5×, 1×, 2×, 5× the TMD central value) and report at which tolerance the model first becomes feasible. This localizes whether the tension is a 1% or 100% effect.
   - Without this, the recorded negative result is not actionable and the failure library entry is incomplete (it cannot answer "how infeasible?").

   - Files: config JSONs `..._v3aa_...slope_tmd.json` and `..._v3ab_...slope_tmd.json` — need `f1_absolute_tolerance` values and a sweep.

4. **TMD estimate uncertainty band not propagated.**
   The packet says tolerance is "derived from $m_{f_2} = (1.275 \pm 0.020)\,\text{GeV}$." This gives $\delta f_1/f_1 \approx 2 \times 0.020/1.275 \approx 3\%$. But the TMD estimate itself carries an $\mathcal{O}(30\text{–}50\%)$ model uncertainty (tensor-meson dominance is a leading-order saturation ansatz). Using a 3% band for a quantity known only to ~30–50% is a methodological error that could trivially cause infeasibility. **The tolerance must be widened to reflect the intrinsic TMD model uncertainty, and the run re-executed, before concluding infeasibility is physical.**

   - File: `idea-runs/.../evidence/neg_results/2026-02-18-chpt-slope-sum-rule-infeasible-v1.txt` — must discuss TMD model uncertainty.

## Non-blocking

1. **Negative-result note formatting.** The note references "Eq. `Aslope`" and "Eq. `TMD`" — these should be specific equation numbers from arXiv:2507.05375 (e.g., Eq. (3.12), Eq. (4.7)) for reproducibility by a third party. Currently ambiguous.

2. **Failure library schema completeness.** The two JSONL records in `failed_approach_v1.jsonl` should include fields for: (a) the numerical value of `f1` used, (b) the tolerance, (c) `I_slope_tail`, and (d) the ECOS exit code and dual infeasibility certificate (if available). Currently the packet does not confirm these fields are present.

3. **Draft report limitation bullet.** The added limitation in `reports/draft.md` should explicitly state that the TMD model uncertainty was not fully propagated, pending the blocker resolution above. As written, a reader could incorrectly conclude the slope sum rule is generically incompatible with the bootstrap, when the issue may be a too-tight tolerance.

4. **SCS cross-check.** Running the same configs with SCS (which returns certificates differently from ECOS) would strengthen confidence. This is non-blocking because ECOS infeasibility is usually reliable for well-scaled problems, but given the normalization concerns above it would be a useful check.

5. **Dashboard entries.** The islands dashboard (`islands_dashboard_v1.md`) and opportunities dashboard (`opportunities_dashboard_v1.md`) should link to the specific run directories, not just the note. Confirm hyperlinks are relative and resolve correctly.

## Real-research fit

The underlying physics question — whether NLO ChPT / TMD slope information can tighten gravitational form factor bounds — is well-motivated and timely given the lattice + GPD extraction landscape. The negative-result discipline (failure library, dashboards, gates) is a strong methodological feature rarely seen in HEP phenomenology work. However, the scientific value of a negative result depends critically on whether the infeasibility is genuine or an artifact of (a) normalization errors or (b) unreasonably tight tolerances. Without resolving blockers 1–4, the negative result is not trustworthy enough to guide the next research phase.

The connection to arXiv:2507.05375 is appropriate; the slope sum rule is a standard consequence of the unsubtracted dispersion relation for $A(t)$ in the $t < 4m_\pi^2$ region. The TMD saturation ansatz for the slope is a reasonable first target, though its large intrinsic uncertainty must be acknowledged.

## Robustness & safety

- **Load-bearing assumption: tail model.** The pQCD/OPE-inspired tail above $s_0$ is the single most dangerous assumption for the slope constraint, because $\int ds\,\mathrm{Im}\,A/s^2$ converges slowly (only $1/s^2$ suppression). If the tail model is too large, it eats the entire slope budget and the grid spectral function has no room. This must be quantified (blocker 2).

- **Normalization/units.** The campaign uses $m_\pi = 1$ units throughout. The TMD slope $f_1 = m_\pi^2/m_{f_2}^2$ in these units is dimensionless and $\approx (0.140/1.275)^2 \approx 0.012$. This is a small number; if the integral kernel discretization has $\mathcal{O}(0.01)$ numerical errors from the trapezoidal rule on 200 grid points, the equality constraint could be unsatisfiable for numerical rather than physical reasons. A convergence check (grid 400, 800) for the slope integral alone would be prudent.

- **Solver certification.** ECOS provides a primal infeasibility certificate (dual ray). Extracting and inspecting this certificate would immediately reveal which constraints are in tension. This is the sharpest possible diagnostic and should be the first action item.

## Specific patch suggestions

1. **`bochner_k0_socp_dispersion_bounds.jl`:** Add a unit-test block (or a `--slope-audit` flag) that:
   ```julia
   # After constructing slope row coefficients c_slope[i]:
   # Verify: sum(c_slope .* rho_test) ≈ (1/π) * quadgk(s -> rho_test_func(s)/s^2, 4, s0)
   # for a known test spectral function (e.g., single Breit-Wigner at m_f2)
   ```
   This would catch any missing $1/\pi$, wrong grid spacing, or sign error.

2. **Config JSONs (`_v3aa_`, `_v3ab_`):** Add a tolerance sweep parameter:
   ```json
   "sum_rules": {
     "f1": 0.012,
     "f1_absolute_tolerance": [0.001, 0.006, 0.012, 0.024, 0.060],
     "f1_sweep_mode": true
   }
   ```
   Run the sweep and record the critical tolerance at which feasibility is restored. Include this in `results.json`.

3. **Negative-result note (`2026-02-18-chpt-slope-sum-rule-infeasible-v1.txt`):** Add a section:
   ```
   ## TMD model uncertainty
   The tensor-meson-dominance estimate f1 = m_pi^2/m_{f2}^2 carries an intrinsic
   model uncertainty of O(30-50%), not captured by the m_{f2} PDG error bar alone.
   The tolerance used in this run (±3%) reflects only parametric uncertainty.
   A rerun with ±50% tolerance is required before concluding physics-level
   incompatibility.
   ```

4. **`failed_approach_v1.jsonl`:** Ensure each record includes:
   ```json
   {
     "f1_value": 0.012,
     "f1_tolerance": 0.0004,
     "I_slope_tail": <value>,
     "ecos_exit_code": <int>,
     "dual_infeasibility_certificate": "<summary or path>"
   }
   ```

5. **`reports/draft.md`:** Change the limitation bullet from (paraphrasing) "slope sum rule is infeasible" to "slope sum rule with TMD-saturated target and ±3% tolerance is infeasible; broader tolerance and normalization audit pending."

---

**Minimal next actions to reach READY:**

1. Audit and confirm the $1/\pi$ prefactor in the slope constraint row (print coefficients, compare to analytic test case).
2. Quote `I_slope_tail` numerical values from both runs.
3. Run a tolerance sweep (5 points from 3% to 100% of $f_1$) and report the feasibility transition point.
4. Update the negative-result note and failure library entries with TMD model uncertainty discussion and sweep results.
