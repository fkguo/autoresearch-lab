VERDICT: NOT_READY

## Blockers

1. **No before/after band-width comparison with W6-28 at matched $Q^2$ points.** The stated milestone goal is "tighten the low-$Q^2$ band via an additional physics/UV input." The packet gives W6-29 numbers at $Q^2=2\,\mathrm{GeV}^2$ ($A\in[-0.023,\,0.294]$ Clarabel) but does not reproduce the W6-28 baseline numbers at the same point. Without a side-by-side comparison (ideally a table: W6-28 width vs W6-29 width at several $Q^2$ values), the primary acceptance criterion — that the band actually tightened — is not verifiable from the packet. The evidence note is referenced but not inlined; the review packet must be self-contained.

2. **Cross-solver discrepancy undiscussed.** Clarabel $A_{\min}=-0.0234$ vs ECOS $A_{\min}=-0.0172$ is a $\sim$36% relative difference on $A_{\min}$ (and $\sim$2% of band width). The packet provides no stated acceptance threshold for solver agreement, nor any discussion of which value should be trusted or why they differ. A one-line tolerance criterion (e.g., "$|\Delta A|/\text{bandwidth} < 5\%$") and an explicit PASS/FAIL against it is needed.

## Non-blocking

- The pQCD anchor at $Q^2=10\,\mathrm{GeV}^2$ is stored under `constraints.low_energy_value_bands`. This is a semantic mismatch —10 GeV² is not low energy. Consider renaming the field to `constraints.value_bands` or adding a `constraints.uv_anchor_bands` key to avoid audit confusion in later milestones.
- The equation label "Qem" for the LO pQCD asymptotic formula in arXiv:2412.00848 is unusual. Confirm this is the correct label; if it's a charge-radius equation rather than the asymptotic $A^\pi$ prediction, the anchor target would be wrong.
- The $\pm50\%$ tolerance is acknowledged as a proxy, but the manuscript update should include a sentence quantifying what fraction of the final band width is attributable to this tolerance choice (sensitivity analysis), so readers can judge how much the result will change when a proper pQCD/OPE error budget replaces it.
- Condition number or solver residual diagnostics at the high-$Q^2/m_\pi^2\approx 513$ anchor point are not reported. Even a single line from the solver log (primal/dual residual) would strengthen the numerics claim.

## Real-research fit

- Adding a pQCD high-$Q^2$ anchor to a dispersive bootstrap is a standard and well-motivated strategy in the hadron form-factor literature. It is a reasonable intermediate step before full $\pi\pi$ amplitude bootstrapping.
- The $\pm50\%$ tolerance is honestly conservative and appropriate for LO pQCD with unknown DA corrections. The key requirement is that the next milestone (or the evidence note) commits to deriving an auditable error budget for this tolerance — the packet's Question 2 implies this intent but does not formalize it as a tracked next-step item in the opportunity pool.
- The single-anchor-point approach (only $Q^2=10\,\mathrm{GeV}^2$) is fine for a pilot, but a real publication would benefit from a scan over anchor $Q^2$ values (e.g., 5, 10, 20 GeV²) to show stability. This should be captured as a future opportunity.

## Robustness & safety

- No safety or ethical concerns with this purely theoretical/numerical milestone.
- The "saturates the imposed target±tolerance window" statement for the anchor enforcement check is good — it confirms the constraint is active/binding, not vacuous.
- The fact that both solvers produce negative $A_{\min}$ values (unphysical for a form factor squared, though $A^\pi$ itself can be negative in the space-like region depending on conventions) should be briefly discussed: is $A^\pi(-Q^2)<0$ physically allowed, or does it indicate the positivity constraints are not yet tight enough?

## Specific patch suggestions

1. **evidence note → inline table (blocker fix):** In the review packet (or a summary section), add a table like:

```
| Q² (GeV²) | W6-28 A_min | W6-28 A_max | W6-29 A_min | W6-29 A_max | Δwidth |
|-----------|-------------|-------------|-------------|-------------|--------|
| 0.5| ...         | ...         | ...         | ...         | ...    |
| 1.0       | ...         | ...         | ...         | ...         | ...    |
| 2.0       | ...         | ...         | ...         | ...         | ...    |
```

This directly demonstrates tightening and makes the packet self-contained.

2. **solver cross-check criterion (blocker fix):** Add to the packet header or config description:

```
Cross-solver acceptance: |A_min^Clarabel - A_min^ECOS| / bandwidth < 0.05         |A_max^Clarabel - A_max^ECOS| / bandwidth < 0.05
```

Then evaluate: bandwidth≈ 0.317, |ΔA_min| ≈ 0.006 → 1.9%, |ΔA_max| ≈ 0.006 → 2.0%. Both PASS at 5%.

3. **Rename constraint key (non-blocking):** In the config JSON, change `constraints.low_energy_value_bands` → `constraints.value_bands` (or add a separate `constraints.uv_anchor_bands` array) so the field name doesn't mislead at10 GeV².

4. **Opportunity pool entry (non-blocking):** Add a tracked item to `bootstrap_opportunity_pool_v1.jsonl`:

```json
{"id": "W6-30-pqcd-error-budget", "description": "Derive auditable pQCD/OPE error budget for Q2=10GeV2 anchor tolerance, replacing±50% proxy", "priority": "high", "blocked_by": "W6-29"}
```

5. **Add solver residual line (non-blocking):** In the results summary, include one line per solver:

```
Clarabel v116: primal_res=..., dual_res=..., gap=...
ECOS    v117: primal_res=..., dual_res=..., gap=...
```

This costs nothing and preempts reviewer questions about numerical reliability at large $Q^2/m_\pi^2$.
