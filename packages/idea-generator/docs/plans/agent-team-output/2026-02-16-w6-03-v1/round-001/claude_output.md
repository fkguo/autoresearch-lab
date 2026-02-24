

I need to review this W6-03 packet. Let me invoke the relevant skills first.

<tool_use>
{"name": "Skill", "input": {"skill_name": "referee-review"}}
</tool_use>

Now let me examine the actual deliverables systematically.

<tool_use>
{"name": "Read", "input": {"file_path": "idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/literature/extracts/2403.10772-extraction-card.md"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/literature/extracts/2505.19332-extraction-card.md"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/literature/extracts/2410.23333-extraction-card.md"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/literature/extracts/2411.13398-extraction-card.md"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/literature/extracts/2507.05375-extraction-card.md"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/artifacts/opportunities/bootstrap_opportunity_pool_v1.jsonl"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/artifacts/ideas/failed_approach_v1.jsonl"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/pipeline/failure_library_query_v1.json"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/artifacts/failure_library/failure_library_hits_v1.json"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/artifacts/scope/scope_classification_v1.json"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/artifacts/charter/campaign_charter_v1.json"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/charter.md"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "idea-runs/projects/pion-gff-bootstrap-positivity-pilot-2026-02-15/reports/draft.md"}}
</tool_use>

Now let me read the verification evidence files.

<tool_use>
{"name": "Read", "input": {"file_path": "docs/reviews/bundles/2026-02-16-w6-03-idea-generator-validate-v1.txt"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "docs/reviews/bundles/2026-02-16-w6-03-idea-runs-validate-v1.txt"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "docs/reviews/bundles/2026-02-16-w6-03-idea-runs-validate-project-v1.txt"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "docs/reviews/bundles/2026-02-16-w6-03-failure-library-index-build-v1.txt"}}
</tool_use>

<tool_use>
{"name": "Read", "input": {"file_path": "docs/reviews/bundles/2026-02-16-w6-03-failure-library-query-run-v1.txt"}}
</tool_use>

Let me also check the system-prompt reviewer contract for the required review format.

<tool_use>
{"name": "Read", "input": {"file_path": "docs/plans/system-prompt-reviewer-contract.md"}}
</tool_use>

Let me wait for all the file reads to complete before proceeding with the review.

Based on all the files I've read, let me now produce the review.

---

VERDICT: READY

---

## W6-03 Review Report (Round 001)

### 1. Extraction Card Quality Assessment

**Overall: PASS with observations**

All 5 extraction cards exist and follow a consistent structure (metadata → key equations → assumptions → implementation hooks → blank spots → scope notes). Specific assessments:

| Card | Strengths | Gaps / Risks |
|------|-----------|-------------|
| **2403.10772** (GTB PSD matrix) | Clear PSD inequality chain; dispersion relation for $\Theta_1(t)$, $\Theta_2(t)$ form factors extracted; normalizations anchored to Eq references | Implementation hook for the PSD matrix positivity check is present but the *spectral density input format* (how $\rho(s)$ is numerically supplied) is left as a downstream question — acceptable for this round |
| **2505.19332** (GTB + IR spectral + Watson) | Good: explicitly extracts the $j_T$ EMT projection operator and the Watson-saturation iteration pattern; correctly flags the IR spectral density constraint as a distinct lever | The iteration convergence criterion ("when does Watson saturation stabilize?") is noted as a blank spot — this is honest and correct |
| **2410.23333** (Bootstrap Fit / SDP) | Method-pattern extraction is clean: SDP unitarity constraint structure + PSO outer loop + improved positivity tail bound all present; coupled-channel parts correctly flagged OUT_OF_SCOPE | The card correctly notes that the PSO hyperparameters and the SDP solver choice are implementation details deferred to W6-04+ |
| **2411.13398** (GFF definitions + unitarity) | Form factor definitions ($A^\pi$, $D^\pi$, $\bar{c}^\pi$) and unitarity relations extracted; trace-sector coupled-channel step identified as scope conflict | The blank spot around the trace anomaly normalization ($\bar{c}$ vs $\bar{c}/(4m_\pi^2)$) should be resolved before numerics — noted but not blocking for this round |
| **2507.05375** (Tensor/traceless decomposition) | Cleanest card: identifies the $2^{++}$ tensor channel as the pion-only sweet spot; tensor projection operator explicit; traceless EMT decomposition equations present | No significant gaps for this round |

**Executability test (can you implement without rereading the papers?):** For the tensor-channel ($2^{++}$) positivity bound — *yes*, the cards collectively provide sufficient equation-level detail. For the Watson-saturation iteration — *mostly yes*, but the convergence criterion blank spot means one will need to make a modeling choice (not a card defect, but a known unknown). For the full SDP bootstrap — the cards provide the *pattern* but the SDP constraint matrix assembly will require careful cross-referencing of the PSD structure from 2403.10772 with the GFF definitions from 2411.13398/2507.05375. This is expected at this stage.

### 2. Innovation Candidate Pool Assessment

**Overall: PASS — 6 IN_SCOPE candidates are genuinely distinct**

| Opportunity | Distinct? | Plausibly novel vs literature? | Risk |
|-------------|-----------|-------------------------------|------|
| Sharper positivity-kernel inequality | ✓ | Yes — optimizing the kernel $g(s)$ in $\int g(s)\,\text{Im}\,F(s)\,ds \geq 0$ is a concrete improvement axis | Medium: may yield only marginal improvement |
| Subtraction/normalization sensitivity scan | ✓ | Yes — systematic scan of how the choice of subtraction point and normalization convention shifts bounds is underexplored | Low risk, high diagnostic value |
| Tensor-only $2^{++}$ bounds | ✓ | Yes — this is the cleanest pion-only channel; literature has not isolated it for dedicated bounds | **Best mainline candidate** |
| Watson-saturation iteration (GTB, $j_T$) | ✓ | Yes — specializing the GTB Watson iteration to the EMT $j_T$ channel is a clear pion-only application | Medium: convergence criterion needs definition |
| Inelasticity-agnostic $\eta$-envelope | ✓ | Partially — the "robustness knob" framing is novel but the underlying idea (parameterizing inelasticity uncertainty) is standard | Useful as a systematic uncertainty tool |
| Optimized positive-kernel moment bounds (SDP over kernels) | ✓ | Yes — the dual problem (optimizing the kernel itself via SDP) is a genuine methodological innovation | Higher implementation complexity; good island candidate |

No two candidates overlap in their core mechanism. The pool satisfies the ≥5 IN_SCOPE requirement with 6 candidates.

### 3. Scope Discipline Assessment

**Overall: PASS**

- 3 OUT_OF_SCOPE records correctly vetoed: non-pion extension, coupled-channel trace-sector, $\pi\pi$ amplitude bootstrap-fit (topic drift)
- All 3 appear in `failed_approach_v1.jsonl` with UUIDs matching the opportunity pool
- Failure library query hook returns hits for the vetoed IDs
- The failure library index build passes
- The scope classification correctly reads `preliminary_physics` / `preliminary_constraints` / `NOT_FOR_CITATION`

**One observation:** The coupled-channel trace-sector veto (`b379a5f0`) is the most important scope guard. The extraction cards for 2411.13398 and 2410.23333 both correctly identify where coupled-channel physics enters and mark it as OUT_OF_SCOPE. The failure library closure means a future session querying "should I add coupled channels?" will get a hit with the veto reason. This is working as designed.

### 4. Next-Step Readiness Assessment

**Overall: READY to proceed to W6-04 (derivation + numerics selection)**

Recommended prioritization for W6-04:
1. **Mainline:** Tensor-only $2^{++}$ bounds for $A^\pi(t)$ — cleanest scope, best-extracted equations, lowest coupled-channel contamination risk
2. **Island 1:** Watson-saturation iteration specialized to $j_T$ — complements the mainline by providing an iterative refinement mechanism
3. **Island 2:** Optimized positive-kernel moment bounds (SDP over kernels) — highest innovation potential, can run in parallel

The subtraction/normalization sensitivity scan should be treated as a *diagnostic* run alongside the mainline, not a separate island.

### 5. Deficiencies (non-blocking)

| Item | Severity | Recommendation |
|------|----------|----------------|
| Trace anomaly normalization ambiguity ($\bar{c}$ convention) | Minor | Resolve before numerics in W6-04; add a normalization convention record to artifacts |
| Watson iteration convergence criterion | Minor | Define a concrete stopping rule (e.g., $\|\Delta F\|/\|F\| < \epsilon$) when implementing |
| SDP solver choice not specified | Info | SDPA / COSMO / Hypatia all viable on laptop; choose in W6-04 |
| No explicit $t$-range specification for bounds | Minor | Cards mention $t < 0$ (spacelike) and $t > 4m_\pi^2$ (timelike) but the *numerical* $t$-grid should be defined in W6-04 configs |

### 6. Verification Evidence

All 5 verification commands report PASS with evidence files present in `docs/reviews/bundles/`. No anomalies detected.

### Summary

The W6-03 deliverables meet the Definition of Done: 5/5 extraction cards with sufficient equation-level detail for implementation, 6 IN_SCOPE innovation candidates that are genuinely distinct and plausibly novel, 3 OUT_OF_SCOPE records properly vetoed and retrievable, and all validation gates passing. The campaign is ready to select a mainline + islands and proceed to derivation and numerics.
