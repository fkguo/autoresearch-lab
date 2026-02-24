VERDICT: READY

## Blockers

None identified. The packet is internally consistent, the immutable runs exist for the claimed configurations, the regulator-scan logic is sound, and the key conditional assumptions are stated.

## Non-blocking

1. **Regulator-sensitivity monotonicity not explicitly tabulated in the review packet itself.**
   The packet states bounds should weaken as `c_abs_max` grows and asks the reviewer to check this, but the summary table is only in `docs/reviews/bundles/2026-02-16-w6-05-scale1-regulator-scan-summary-v1.txt`. It would be helpful to inline at least the three-row table (cmax=20k, 50k, 200k → lower bound value) directly into the review packet or the `draft.md` section so that monotonicity is immediately visible to any future reader. Currently one must cross-reference a bundle file.

2. **The "best" bound is quoted from `cmax=20000` — clarify why the tightest regulator is preferred.**
   Physically the tightest regulator that remains feasible gives the strongest bound, so highlighting the `cmax=20000` run is correct. But a one-sentence explanation in `draft.md` ("we report the bound at the smallest feasible `c_abs_max` because it maximally constrains the coefficient space") would prevent a reader from wondering why the smallest scan point is preferred.

3. **Dashboard gate enforcement is currently validate-time only.**
   `idea-runs/scripts/validate_project_artifacts.py` checks for dashboard files, but there is no pre-commit hook or CI step that regenerates them. If a new run is added but `render_project_dashboards.py` is not re-run, the dashboards become stale while still passing validation (they exist but are outdated). Consider either (a) embedding a freshness check (e.g., comparing dashboard mtime vs. latest run directory mtime) or (b) documenting the manual regeneration step prominently.

4. **Failure library record for the diagnostic correction.**
   The packet says the failed_approach_v1.jsonl was "appended" with a diagnostic correction. Confirm that the original infeasibility record (from W6-04) is preserved verbatim and the correction is a new record pointing back to it, not an in-place edit. The immutable-append contract should be stated explicitly in the JSONL header or a README.

5. **Elastic-window sign assumption conditionality.**
   The draft reportedly states the assumption $\mathrm{Im}\,A(s) \ge 0$ for $4m_\pi^2 \le s \le 4m_K^2$, but Reviewer Question 3 asks whether it is explicit *enough*. Recommendation: add the assumption as a boxed caveat at the top of the results section in `draft.md` (not just in the limitations), and tag every bound table/figure caption with "conditional on elastic-window positivity."

6. **NOT_FOR_CITATION hygiene.**
   Confirm that the string `NOT_FOR_CITATION` appears in the YAML front-matter or first 5 lines of `draft.md` and in every dashboard Markdown file. This prevents accidental external distribution.

## Real-research fit

- **Physics logic is sound.** The move from a floating `scale_factor` to `scale_factor=1` with a regulator scan is the correct way to remove a tuning knob: you enforce the exact LO normalization and instead discover what coefficient-space volume is needed for feasibility. This is a genuine improvement over W6-04.
- **The regulator scan introduces a new sensitivity axis (`c_abs_max`) but this is *transparent* sensitivity** — it parameterises truncation error in the polynomial expansion, not an ad-hoc rescaling. This is a more honest parameterisation of systematic uncertainty.
- **Bochner/K0 pipeline reuse is appropriate.** The transverse-positivity LP is unchanged; only the spectral-density envelope input differs. The claim of a "strictly stronger bound" is warranted if the `scale_factor=1, cmax=20000` envelope is pointwise tighter than the old `scale_factor≠1` envelope (which it should be by construction, since `scale_factor=1` is the physical normalisation and the old envelope had to accommodate the rescaling freedom).
- **Pion-only / no-coupled-channel constraint is respected.** No KK or coupled-channel code paths are exercised.

## Robustness & safety

- **Load-bearing assumption: elastic-window sign.** The entire Bochner/K0 bound chain depends on $\mathrm{Im}\,A(s)\ge 0$ below KK threshold. This is physically well-motivated (elastic unitarity + Watson's theorem for the $I=0,\,J=0$ partial wave with positive Omnès phase), but it is an *input*, not a derived result. The packet correctly flags this.
- **Normalization assumption: LO threshold shape.** Enforcing `scale_factor=1` assumes the LO two-pion phase-space threshold shape $\rho_2^0(s) \propto \sqrt{1-4m_\pi^2/s}$ is the correct absolute normalisation for the spectral density near threshold. This is exact at LO in ChPT and receives NLO corrections of order $m_\pi^2/\Lambda_\chi^2 \sim 5\%$. The regulator scan effectively absorbs this uncertainty, but nowhere in the packet is the NLO correction size estimated. **Recommend adding a one-line note** in `draft.md` that NLO threshold corrections are $\mathcal{O}(5\%)$ and are within the regulator envelope for `c_abs_max \ge 20000`.
- **LP solver numerics.** No mention of solver tolerances or dual-feasibility certificates. For a NOT_FOR_CITATION internal milestone this is acceptable, but before any publication the LP feasibility claims should be accompanied by solver exit codes and primal-dual gap values.
- **Immutability of runs.** The run directories use date-stamped names. No `.lock` or checksum files are mentioned. For auditability, consider adding a `sha256sums.txt` in each run directory.

## Specific patch suggestions

1. **`idea-runs/.../reports/draft.md`** — Add a boxed caveat at the start of the results section:

   ```markdown
   > **Caveat (all bounds below):** Results are conditional on
   > $\mathrm{Im}\,A(s)\ge 0$ for $4m_\pi^2 \le s \le 4m_K^2$
   > (elastic-window positivity) and on the LO threshold normalisation
   > $\rho_2^0(s)$ at `scale_factor=1`.  NLO corrections to the
   > threshold shape are $\mathcal{O}(m_\pi^2/\Lambda_\chi^2)\sim 5\%$.
   ```

2. **`idea-runs/.../reports/draft.md`** — In the new "enforce IR scale_factor=1" section, add a mini-table:

   ```markdown
   | `c_abs_max` | LP status | $A^\pi(-10m_\pi^2)$ lower bound |
   |-------------|-----------|----------------------------------|
   | 5 000       | infeasible | —                                |
   | 20 000      | optimal    | X.XXX                            |
   | 50 000      | optimal    | Y.YYY                            |
   | 200 000     | optimal    | Z.ZZZ                            |
   ```

   This makes monotonicity (weakening with increasing `c_abs_max`) immediately visible.

3. **`idea-runs/scripts/validate_project_artifacts.py`** — Add a freshness check for dashboards:

   ```python
   # After confirming dashboard files exist:
   latest_run_mtime = max(
       os.path.getmtime(r) for r in glob.glob(os.path.join(runs_dir, "*"))
   )
   dashboard_mtime = os.path.getmtime(dashboard_path)
   if dashboard_mtime < latest_run_mtime:
       warnings.append(f"Dashboard {dashboard_path} is older than latest run; re-render recommended.")
   ```

4. **`idea-runs/.../artifacts/ideas/failed_approach_v1.jsonl`** — Add a comment or field in the new record confirming the append-only contract:

   ```json
   {"id": "...", "supersedes": "W6-04-d0-ir-infeasible-001", "action": "diagnostic_correction", "note": "Original record preserved; this entry adds regulator-scan resolution."}
   ```

5. **`idea-runs/scripts/render_project_dashboards.py`** — Ensure the generated dashboards include `NOT_FOR_CITATION` in their first line:

   ```python
   header = "<!-- NOT_FOR_CITATION -->\n# Islands Dashboard v1\n"
   ```
