VERDICT: NOT_READY

## Blockers

1. **No solver cross-check at interior $Q^2$ points.**
W6-22 established Clarabel-vs-ECOS agreement at the single endpoint $Q^*$. W6-23 extends the scan to 50 $Q^2$ points but runs Clarabel only. Without at least a sparse ECOS (or SCS) cross-check at a handful of interior points (e.g. $Q^2 \in \{1, 5, 10, Q^*\}$), solver-specific numerics cannot be ruled out as the source of the tight band. This is the single most important missing piece.- Affected artifact: `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/runs/2026-02-18-a-bochner-k0-socp-v100-dispersion-grid200-enf200-multiq-audit8-clarabel-asrband-slope-tmd-asrtol62p0/results.json`

2. **Tail/ansatz systematic not propagated across $Q^2$.**
The fixed pQCD tail (`tail.scale_factor=1.0`) is a load-bearing assumption. W6-22 quoted a tail systematic only at $Q^*$. W6-23 claims the band "propagates" but does not show how the width changes when `tail.scale_factor` is varied (e.g. 0.8–1.2) at multiple $Q^2$. Without this, the reported widths are conditional on a single tail choice and the "tight throughout" claim is not robust.
   - Affected config: `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/compute/a_bochner_k0_socp_config_v4cay_dispersion_grid200_enf200_multiq_audit8_clarabel_asrband_slope_tmd_asrtol62p0.json` (only `scale_factor=1.0`)

3. **ASR tolerance sensitivity not scanned across $Q^2$.**
`asr_absolute_tolerance=62` is itself a discretization/normalization choice. The evidence note and manuscript should show at least one alternative tolerance (e.g. 50 or 80) at a few $Q^2$ values to confirm the band shape is not an artifact of this single tolerance setting.
   - Affected artifact: `idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/evidence/2026-02-18-w6-23-multiq-asrband-slope-summary-v1.md`

## Non-blocking

- The 50-point grid is fine for a plot but the evidence note should state the Clarabel convergence status (primal/dual feasibility residuals) for all 50 points, or at minimum flag any points where the solver did not reach optimal status. Currently not visible from the review packet.
- The slope input $f_1 = 0.01198 \pm 0.001$ is treated symmetrically (center ± band), but the evidence note does not state whether both edges of the slope band were scanned or only the central value. If only central, the reported widths undercount uncertainty.
- Manuscript bullet for W6-23 should explicitly state "single tail model, single ASR tolerance" as a caveat until blockers 2–3 are resolved.

## Real-research fit

The physics question — whether soft-ASR + slope input tightens the form factor across spacelike $Q^2$, not just at $Q^*$ — is well-motivated and the right next step after W6-22. The constraint stack is clearly documented and the scope (pion-only, no coupled-channel) is appropriate. The increment is scientifically sound in intent; the gap is purely in robustness evidence.

## Robustness & safety

- **Solver dependence:** Single-solver (Clarabel) results at 50 points with no cross-check is the primary robustness gap.
- **Discretization:** `grid200` and `enf200` settings are inherited from W6-22 and presumably validated there, but the review packet does not re-confirm grid-convergence at the new $Q^2$ values (especially $Q^2=1$ where the integrand structure differs from $Q^*$).
- **Normalization of ASR integral:** The $(1/\pi)\int ds\,\mathrm{Im}\,A$ normalization convention must match between the ASR tolerance and the tail model. This was presumably checked in W6-22 but is not re-stated.

## Specific patch suggestions

1. **Minimal ECOS cross-check run** (resolves Blocker 1):
   Run the existing config at 4 points ($Q^2 \in \{1, 5, 10, 15.438\}$) with `solver: ecos`. Compare $A_{\min}, A_{\max}$ to Clarabel. Agreement to $\lesssim 10^{-4}$ suffices.

2. **Tail scale scan** (resolves Blocker 2):
   Duplicate the v100 config with `tail.scale_factor` ∈ {0.8, 1.0, 1.2} at the same 4 representative $Q^2$ points. Report the outer envelope as the systematic.

3. **ASR tolerance spot-check** (resolves Blocker 3):
   Run `asr_absolute_tolerance` ∈ {50, 62, 80} at $Q^2 \in \{1, Q^*\}$ only. Two extra runs per tolerance value (min/max), so 4 additional solves per tolerance.

4. **Evidence note update** (resolves non-blocking items):
   Add a table of Clarabel solver status flags for all 50 points, and clarify whether both edges of the $f_1$ band were used in the optimization or only the central value.

These three blocker patches together require ~20 additional SOCP solves (well within a single compute session) and would make the increment fully auditable.
