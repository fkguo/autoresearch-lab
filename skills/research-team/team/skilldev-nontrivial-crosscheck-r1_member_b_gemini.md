Error executing tool write_file: Tool "write_file" not found in registry. Tools must use the exact names that are registered. Did you mean one of: "read_file", "activate_skill", "zotero_add"?
Error executing tool run_shell_command: Tool "run_shell_command" not found in registry. Tools must use the exact names that are registered. Did you mean one of: "search_file_content", "hep_run_create", "zotero_local"?
Error executing tool activate_skill: Tool execution for "Activate Skill" denied by policy.
The tool environment prevents me from writing files directly. I have generated the content for `skilldev-nontrivial-crosscheck-r1_member_b_gemini.md` below, strictly following your output contract.

***

# Nontrivial Cross-Check Proposals

**Member:** Member B (Gemini 3 Pro)
**Date:** 2026-01-22

## 1. Diagnosis: The Calculator Fallacy

Current cross-check workflows often suffer from the "Calculator Fallacy": we verify that the arithmetic is correct, but not that the logic is sound. If a derivation has a fundamental error (e.g., wrong sign, missing term, incorrect physical model), a trivial cross-check that simply re-plugs numbers into the *same* final formula will pass. We are effectively verifying the Python interpreter or the CPU, not the research.

To increase confidence, we must enforce **orthogonality**. The check must traverse a different logical or computational path than the primary result. A trivial check asks "Is 2+2=4?". A nontrivial check asks "Does this result conserve energy?" or "Does it match the analytical limit at infinity?".

## 2. Options for Nontrivial Workflows

### Option A: The Invariant/Residual Audit
Define a physical or mathematical invariant $I$ (where $I=0$ or $I=1$ analytically) and compute the residual $\delta = |I_{computed} - I_{expected}|$.

*   **Workflow:**
    1. Identify a conservation law (probability, energy, momentum) or symmetry (parity, gauge invariance) relevant to the calculation.
    2. Compute the primary result.
    3. Simultaneously compute the invariant sum or relation using the intermediate states.
    4. Pass only if residual $<\epsilon$.
*   **Pros:**
    *   **Deterministic:** Mathematical identities are exact (within floating point precision).
    *   **Low Overhead:** Often reuses existing computed terms.
    *   **High Value:** Catches deep logic errors (e.g., dropped terms) that arithmetic checks miss.
*   **Cons:**
    *   Requires domain insight to find a suitable invariant.
    *   May not exist for all partial results.
*   **Failure Mode:** False positives if the invariant is too "loose" (e.g., dimensional correctness is necessary but not sufficient).

### Option B: The Asymptotic Boundary Check
Evaluate the complex model at a boundary condition (e.g., $x \to 0$, $x \to \infty$, $m \to 0$) where the solution simplifies to a known closed form.

*   **Workflow:**
    1. Implement the "Simple Model" (often a textbook formula) for the limit case.
    2. Evaluate the "Complex Model" (the research code) with parameters set to the limit (or very close).
    3. Assert agreement within tolerance.
*   **Pros:**
    *   **Validates Logic:** Proves the general theory recovers the known physics/math in the limit.
    *   **Independent:** The simple model implementation is distinct from the complex one.
*   **Cons:**
    *   **Numerical Instability:** "Hard" limits (div by zero) often require careful handling or series expansion in code.
    *   **Limited Scope:** Only checks the edges of the parameter space, not the center.
*   **Failure Mode:** The model works at the edges but is broken in the middle (interpolation error).

### Option C: Algorithmic Diversity (The "Two-Path" Check)
Calculate the *same* quantity using two fundamentally different numerical or analytical methods.

*   **Workflow:**
    1. Primary Path: e.g., Monte Carlo integration.
    2. Secondary Path: e.g., Deterministic Quadrature or Taylor Series expansion.
    3. Compare results.
*   **Pros:**
    *   **Gold Standard:** Very high confidence if two distinct algorithms agree.
    *   **Implementation Check:** Catches bugs in loops, indices, and library usage.
*   **Cons:**
    *   **High Effort:** Requires implementing the solution twice.
    *   **Performance:** The secondary method might be slow (but we only need a spot check).
*   **Failure Mode:** Both methods share a common bad assumption (e.g., same incorrect input data).

### Option D: The Inverse/Reciprocity Check
Check if the operation is reversible or respects reciprocity symmetries (e.g., $G(x,y) = G(y,x)$).

*   **Workflow:**
    1. Compute Output $Y = F(X)$.
    2. Compute Input $X' = F^{-1}(Y)$ (if invertible).
    3. Verify $X \approx X'$.
*   **Pros:**
    *   **Generic:** Often applies to matrix operations, transforms, and solvers without physics knowledge.
    *   **Brutal on Bugs:** Sign errors and index swaps usually break reciprocity immediately.
*   **Cons:**
    *   Inverse might be ill-conditioned or expensive.
*   **Failure Mode:** Numerical noise prevents exact inversion, leading to ambiguous pass/fail thresholds.

## 3. Recommendation

**Path Forward:** **Staged Rollout of Invariants and Asymptotics.**

We should avoid "Algorithmic Diversity" (Option C) as a default requirement because it doubles the coding load (violating "profile-aware" efficiency for smaller tasks). Instead, we prioritize methods that validate the *physics/math* structure.

**Staged Rollout Plan:**

1.  **Immediate (Stage 1): The "Unit Check" + "Invariant Audit" (Option A).**
    *   Mandate that every milestone report includes one **Conservation Check**.
    *   *Mechanism:* If computing probabilities, $\sum P = 1$. If computing dynamics, $E_{final} - E_{initial} = 0$.
    *   *Cost:* Near zero (summing existing arrays).

2.  **Intermediate (Stage 2): The "Zero Check" (Null Hypothesis).**
    *   Run the code with parameters where the effect *should* vanish (e.g., coupling $g=0$).
    *   Assert result is effectively zero (noise floor).
    *   *Cost:* One extra function call.

3.  **Advanced (Stage 3): The "Limit Check" (Option B) for Major Claims.**
    *   For the final "Headline Number", require agreement with a known asymptotic limit.
    *   *Cost:* Moderate (writing the simple limit formula).

This approach is **deterministic** (exact math relations), **avoids brute force** (spot checks at specific points/sums), and is **profile-aware** (scaling from simple sums to asymptotic limits).

## 4. Examples of Nontrivial Headline Numbers

These are examples of "Success Criteria" for a cross-check report. They are not just "Output = 5.2", but "Validation Metric = X".

1.  **Unitarity Residual:** "Sum of branching fractions deviates from 1.0 by only **1.2e-14** (machine precision)."
2.  **Null-Test:** "Asymmetry parameter at zero-coupling returns **2.3e-16** (effectively zero), confirming no bias in the pipeline."
3.  **Asymptotic Agreement:** "Numerical cross-section matches the Analytic Soft-Photon Theorem within **0.05%** in the $k \to 0$ limit."
4.  **Symmetry Preservation:** "Forward-Backward asymmetry is **exactly 0.0** (to float precision) for the parity-conserving background channel."
5.  **Conservation Law:** "Total energy drift over 10,000 integration steps is **< 1e-5%**, confirming symplectic integrator stability."
