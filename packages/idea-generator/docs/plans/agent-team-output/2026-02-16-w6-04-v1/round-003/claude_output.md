VERDICT: READY

## Blockers

None. The round-002 submission addresses the two blockers raised in round 001 (scale-factor uncertainty unquantified; $s_{\max}$ treated as fixed rather than scanned) with concrete code, configs, immutable runs, and report sections.

## Non-blocking

1. **Tail-sensitivity knob not yet scanned.** The packet acknowledges this ("tail sensitivity can be postponed") and it is correctly scoped as future work, but the report (`reports/draft.md`) should contain an explicit forward-looking sentence flagging $s \to \infty$ truncation sensitivity as the next robustness axis. This prevents a future reviewer from reading the current text as implicitly claiming tail insensitivity.

2. **Relative path elision.** Throughout the packet, paths are abbreviated with `idea-runs/.../compute/` etc. For full auditability the review bundle or an accompanying manifest should list every artifact with its full relative path from repo root. This is cosmetic at this stage but will matter at any FOR_CITATION promotion.

3. **LP solver tolerance / dual feasibility not reported.** The Bochner/K0 LP runs (v4, v6–v8, scale-factor variants) should ideally log the solver's primal/dual gap and feasibility status in each `results.json`. If SciPy's `linprog` is used, the `fun`, `slack`, and `status` fields should be persisted. Without this, a downstream user cannot distinguish a genuine bound from a near-infeasible artefact. Low priority because the percent-level stability across the scale-factor scan is indirect evidence of solver health, but it should be closed before any publication-grade claim.

4. **Config naming convention drift.** Scale-factor scan configs use two slightly different slug patterns (`_scale5000` vs `_ir-scale5000-v1`). Standardising now avoids confusion when the number of runs grows.

5. **Negative-result evidence note format.** `2026-02-16-d0-ir-absolute-matching-infeasible.txt` is plain text. Promoting this to a structured YAML/JSON alongside the `.jsonl` entry would make it machine-queryable via the failure-library tooling without grep.

## Real-research fit

The work sits cleanly at the intersection of two recent papers:

- **arXiv:2505.19332 (latest GTB):** IR constraints on $\rho_2^0(s)$ near the two-pion threshold. The packet incorporates these as scaled pointwise lower/upper bounds on the D0 spectral density, propagated through the LP.
- **arXiv:2412.00848 (Bochner/transverse-density positivity):** The LP framework that converts spectral-density envelopes into spacelike bounds on $A^\pi(-Q^2)$.

The novelty claim—combining the IR-tightened GTB envelope with the transverse-positivity LP to obtain *strictly tighter* bounds—is credible and correctly scoped as a pion-only, no-coupled-channel, NOT_FOR_CITATION pilot. The conditional nature of the positive-lower-bound region ($s_{\max} \gtrsim 30$ needed) is now clearly stated, which is the scientifically honest framing.

The negative result (absolute IR normalization mismatch) is a genuinely useful datum: it rules out a seemingly natural matching strategy and is properly recorded for the failure library.

## Robustness & safety

| Knob | Scanned? | Evidence | Assessment |
|------|----------|----------|------------|
| `scale_factor` (IR matching) | ✅ {5000, 8000, 10000, 12000} | Per-scenario run dirs + report tables | Percent-level stability → adequate |
| $s_{\max}$ (elastic sign window) | ✅ {16, 25, 36, 50} | v6/v7/v8/v4 runs | Clear monotonic tightening; no unconditional claim |
| $b_{\min}$ (transverse cutoff) | Partially (fixed at 0.08 fm in v4) | Config `a_bochner_k0_lp_config_v4.json` | Acceptable for pilot; should be scanned next |
| Spectral-density tail ($s \to \infty$) | ❌ deferred | Acknowledged in review-focus §3 | Acceptable deferral for NOT_FOR_CITATION stage |
| LP solver tolerance | Not explicitly logged | Indirect evidence from scale-factor stability | See non-blocking item 3 |

**Normalization load-bearing assumption.** The IR matching uses a *relative* (scaled) approach after the absolute approach was shown infeasible. The scale_factor scan demonstrates that downstream observables are insensitive at the percent level, which is the correct way to handle a phenomenological knob whose "true" value is not fixed by first principles. No hidden normalization fragility detected.

**Safety (overstating claims).** The strongest claim—existence of a positive-lower-bound region for $A^\pi(-Q^2)$—is now explicitly conditional on $s_{\max} \gtrsim 36\,m_\pi^2$. For $s_{\max}=25$ the lower bound at $Q^2=10\,m_\pi^2$ is already negative ($-0.0163$). This is correctly reported and the report does not present the positivity region as unconditional.

## Specific patch suggestions

1. **`reports/draft.md`** — Add a sentence in the "Robustness" or "Outlook" section:
   ```markdown
   **Tail sensitivity.** The spectral-density truncation at finite $s$ has not yet been
   scanned as an explicit knob. This is the next robustness axis to close before any
   FOR_CITATION promotion.
   ```

2. **`compute/a_bochner_k0_lp.py`** (or equivalent LP driver) — After solving, persist solver diagnostics:
   ```python
   result_dict["solver_status"] = res.status
   result_dict["solver_message"] = res.message
   result_dict["primal_dual_gap"] = float(getattr(res, 'fun', None))
   ```
   This costs one line and makes every run self-auditing.

3. **`compute/d0_spectral_lp_config_v2_scale*.json`** — Standardise the `output.run_slug` pattern. Suggest:
   ```
   2026-02-16-d0-spectral-lp-v3-ir-scale{N}-v1
   ```
   uniformly (drop any `match` vs `scale` inconsistency).

4. **`artifacts/ideas/failed_approach_v1.jsonl`** — Consider adding a `"evidence_format": "txt"` field to the JSONL entry pointing at the `.txt` note, so tooling can auto-detect and parse it.
