VERDICT: READY

## Blockers

- None. The increment is well-scoped, the physics input (LO pQCD value-band at $Q^2=10\,\text{GeV}^2$ with a named proxy budget) is clearly identified as such, and the binding-gate machinery ensures machine-checkable consistency between the budget artifact and the compute config. No hidden hand-tuning is evident.

## Non-blocking

- **Budget decomposition transparency.** The packet states the UV tolerance is "a named proxy budget (not yet a full OPE/pQCD error propagation)" but does not list the individual budget components (scale variation, $\alpha_s$ uncertainty, higher-twist/power corrections, continuum-threshold sensitivity). Even if the current budget is intentionally conservative, enumerating and rough-sizing each component now would (a) make the conservativeness auditable by a reader who cannot run the builder script, and (b) clarify which component dominates and therefore where tightening effort should go. Recommend adding a small table in the evidence note.

- **Anchor $Q^2$ choice.** $Q^2=10\,\text{GeV}^2$ is a natural "safe pQCD" scale, but for LO-only $\hat\Theta^\pi$ the $\alpha_s$ corrections are not negligible there (NLO Wilson coefficient corrections to the trace anomaly channel can be $\sim 20$–$30\%$ at that scale). A brief sentence quantifying the expected NLO shift relative to the adopted tolerance would strengthen the claim that the budget is conservative.

- **Sparse modulus enforcement ($n_{\rm enforce}=30$).** Previous increments already discussed this, but it is worth a one-line confirmation (or a gate check) that the optimum $\text{Im}\,\hat\Theta$ profile does satisfy the modulus cone inequality on the *full* 200-point grid a posteriori, not just on the 30 enforced points. If this is already checked, a pointer to the verification artifact would suffice.

- **$D$ envelope at small $Q^2$.** The exact identity has a $1/q^2$ prefactor, so the $D$ band blows up as $Q^2\to 0$; the plot range starts at $Q^2=0.015625\,\text{GeV}^2$. A brief remark on whether the $Q^2\to 0$ limit (related to the $D$-term itself, $D^\pi(0)$) is or is not extractable from the current band would be useful for readers.

- **Minor formatting.** The run directory names are heroically long. Consider adding short human-readable aliases (e.g., `theta-v3`, `D-v1d`) in the evidence note for easier cross-referencing.

## Real-research fit

This is a clean, incremental tightening step that follows the evidence-closed-loop methodology established in prior weeks. The key scientific content—anchoring $\hat\Theta^\pi$ at a UV point using pQCD asymptotics with an explicit, auditable uncertainty budget—is a standard and well-motivated move in dispersive bootstrap analyses. The resulting factor-of-$\sim4$ reduction in the $\hat\Theta$ band at $Q^2=2\,\text{GeV}^2$ (and the consequent factor-of-$\sim 3$–$5$ reduction in the $D$ band) is a genuine physics gain, not a numerics artifact, because it comes from a new physical constraint. The self-aware framing ("systematics-dominated," "named proxy budget") is appropriately cautious.

The work remains firmly within the stated hard scope (pion-only, no coupled-channel, laptop-feasible) and is well-positioned for a future publication-quality analysis once the budget is upgraded from LO-proxy to a proper OPE/pQCD error propagation.

## Robustness & safety

- **Overclaiming risk: low.** The packet is explicit that the UV budget is a proxy and that the band is systematics-dominated. Good.
- **Hidden knob risk: low.** The binding gate enforces that the compute config's UV anchor parameters match the budget artifact numerically, so the budget cannot be silently overridden. The budget builder script is the single source of truth.
- **Numerical robustness.** Clarabel SOCP is well-tested in prior increments; the only new numerical element is the additional linear constraint from the UV value-band, which is benign. The anchor check at $Q^2=10\,\text{GeV}^2$ shows the band saturates the budget interval, confirming the constraint is active and not vacuous.
- **Reproducibility.** Evidence note with repro commands is present. Good.

## Specific patch suggestions

1. **Add a budget component table** to the evidence note or the budget artifact itself:
   ```json
   "budget_components": {
     "alpha_s_uncertainty": {"delta": ..., "note": "..."},
     "scale_variation_mu": {"delta": ..., "note": "..."},
     "higher_twist_power_corr": {"delta": ..., "note": "conservative upper bound"},
     "continuum_threshold_s0": {"delta": ..., "note": "..."}
   }
   ```
   Even rough numbers (or "not yet estimated; absorbed into total tolerance") would improve auditability.

2. **Add a post-hoc full-grid modulus-cone check** to the run script (if not already present) and record the maximum violation (should be ≤ 0) in the run's audit JSON:
   ```python
   # after optimization
   viol = (re_theta**2 + im_theta**2) - c_fac * rho
   assert np.all(viol <= tol), f"max violation = {viol.max()}"
   audit["modulus_cone_full_grid_max_violation"] = float(viol.max())
   ```

3. **One-liner on NLO size** in the evidence note, e.g.:
   > "At $Q^2=10\,\text{GeV}^2$, NLO corrections to $\text{Im}\,\hat\Theta$ are estimated at $\sim 20\text{–}30\%$ of LO (see [ref]); the adopted tolerance of [X]% is conservative relative to this."

4. **Regarding reviewer question 4 (highest-leverage next step):** Within pion-only/no-coupled-channel, the most impactful tightening avenues are, in rough priority order:
   - **(a)** Incorporate lattice QCD data for $A^\pi(-Q^2)$ or $D^\pi(-Q^2)$ at moderate $Q^2$ (e.g., from recent extended-twist analyses) as additional value-band constraints—analogous to what was just done for $\hat\Theta$ at the UV end.
   - **(b)** Upgrade the UV budget from LO to NLO (or LO + explicit NLO uncertainty band) for both the $A$ and $\Theta$ channels. This is straightforward given existing pQCD expressions and would shrink the dominant systematic.
   - **(c)** Add a second UV anchor at a higher $Q^2$ (e.g., $Q^2=20$ or $50\,\text{GeV}^2$) where pQCD is more reliable, constraining the curvature of the band between the two anchor points.
   - **(d)** Increase `n_enforce` for the modulus cone (from 30 toward 200) to check whether the band tightens further from better nonlinear constraint coverage—this is a numerics gain, not physics, but is free.
