VERDICT: READY

## Blockers

- None.

## Non-blocking

- The sweep summary artifact (`2026-02-17-w6-16-clarabel-eta0p8-reg-sweep-summary-v1.txt`) should explicitly tabulate the objective values for v32 ($\eta_{\rm floor}=0.8$, reg 1e-7, dyn off) and v33 ($\eta_{\rm floor}=0.6$, reg 1e-7, dyn off) side-by-side with the original v21 ($\eta_{\rm floor}=0.6$, default Clarabel settings) baseline objective, including the absolute and relative shift. If it already does, great; if not, adding this makes the "materially shifts" claim in (2) immediately auditable without opening a separate neg-results note.

- The neg-results note for v33 should quantify what "materially shifts" means: give the numerical shift $\Delta A_{\min}$ and the percentage relative to the v21 baseline. Without a number, a future reader cannot judge whether a proposed tolerance (e.g., 1% or 5%) is reasonable.

- Minor: the proposed "acceptance criterion" in claim (3) is left open-ended. Before running the ladder, consider pre-registering a concrete tolerance—e.g., $|\Delta A_{\min}/A_{\min}^{\rm baseline}| < X\%$—so the ladder is a pass/fail exercise rather than a post-hoc judgment call. This can be a simple one-liner in the sweep config or a separate evidence note.

- Consider testing `Clarabel.Settings(equilibrate_enable=false)` or reducing `equilibrate_max_iter` as a separate axis in the ladder; equilibration can interact with regularization in ways that shift the objective without affecting feasibility.

## Real-research fit

The workflow is well-structured for a solver-robustness study that is a necessary prerequisite to the physics scan. The discipline of (a) checking feasibility recovery, (b) cross-checking against an unperturbed baseline for objective bias, and (c) proposing a pre-registered acceptance criterion before promoting any number as evidence is exemplary. This is exactly the kind of systematic solver-validation step that is often skipped in bootstrap/optimization-based phenomenology and that reviewers of the eventual paper will want to see documented.

The separation of "feasibility restored" from "objective trustworthy" is the right conceptual distinction. Recording reg-tuned values as diagnostic-only until the bias is controlled is the correct conservative posture.

## Robustness & safety

- The four-run sweep (v31–v34) provides minimal but sufficient coverage of the two axes (reg magnitude × dynamic on/off) to locate the feasibility boundary and detect the bias. The design is efficient.
- All validation hooks pass. Commit hash is recorded. Neg-results notes are filed. The evidence chain is intact.
- One latent risk: if the acceptance-criterion ladder identifies a narrow "Goldilocks" window of regularization that simultaneously satisfies feasibility and objective tolerance, that window's width itself becomes a systematic uncertainty. Plan to report the width of the acceptable regularization range, not just the single best point.
- No safety concerns specific to this packet.

## Specific patch suggestions

1. **Pre-register tolerance before the ladder run.** Add a one-line entry to the next config or a dedicated evidence note:
   ```
   acceptance_criterion:
     baseline_run: v21
     metric: |A_min(reg) - A_min(v21)| / |A_min(v21)|
     tolerance: 0.01   # 1%, or justify another value
   ```
   This converts the ladder from exploratory to confirmatory.

2. **Add a column to the sweep summary** with the v21 baseline objective for immediate comparison:
   ```
   | run | eta_floor | static_reg | dyn | status          | A_min    | delta_vs_v21 | rel_shift |
   | v21 | 0.6       | default    | def | OPTIMAL         | <val>    | 0            | 0%        |
   | v33 | 0.6       | 1e-7       | off | OPTIMAL         | <val>    | <val>        | <val>%    |
   | v32 | 0.8       | 1e-7       | off | OPTIMAL         | <val>    | N/A (diff η) | N/A       |
   | v31 | 0.8       | 1e-8       | off | NUMERICAL_ERROR | —        | —            | —         |
   | v34 | 0.8       | 1e-8       | on  | NUMERICAL_ERROR | —        | —            | —         |
   ```

3. **In the ladder sweep, include `equilibrate_enable=false` as a separate axis** (or at least one test point). This is a common source of objective perturbation in Clarabel and is cheap to test.

4. **Report the width of any acceptable regularization window** found by the ladder, as a systematic uncertainty estimate on $A_{\min}$.
