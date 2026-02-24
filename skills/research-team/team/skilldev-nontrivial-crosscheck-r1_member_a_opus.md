# Nontrivial Cross-Check Design for Research-Team Workflow

## 1) Problem Diagnosis: Why Current Checks Become Trivial

### Root Cause Analysis

The current cross-check mechanism fails to enforce nontriviality because it conflates **reproducibility** (can another agent re-derive the same result?) with **validation** (does the result actually probe the correctness of the underlying computation/algorithm?).

**Structural Failure Modes:**

1. **Closed-Form Collapse**: When a result has a closed-form expression, "cross-checking" reduces to:
   - Member A: Evaluates `f(params) = value`
   - Member B: Evaluates `f(params) = value` ✓
   - This exercises only the formula, not the derivation, numerical stability, or algorithmic correctness.

2. **Symbolic Pass-Through**: Both members can symbolically verify a derivation step-by-step, but this doesn't catch:
   - Errors in the *original* symbolic manipulation
   - Numerical instabilities that emerge only at evaluation time
   - Edge cases in parameter regimes

3. **Gate Satisfaction vs. Audit Depth**: Current gates check for *presence* of headline numbers, not their *diagnostic power*. A headline like "H2 = 1.5" passes the gate but provides zero information about:
   - Residual error bounds
   - Sensitivity to perturbations
   - Agreement between independent computational paths

4. **Profile Blindness**: The same headline requirements apply across profiles, but what constitutes "nontrivial" differs:
   - `theory_only`: Nontrivial = checking limiting behavior, asymptotic consistency, special-case reductions
   - `numerics_only`: Nontrivial = residual/error norms, convergence rates, condition numbers
   - `mixed`: Nontrivial = analytic-vs-numeric agreement metrics
   - `methodology_dev`: Nontrivial = invariant preservation, self-consistency checks
   - `toolkit_extraction`: Nontrivial = test coverage metrics, boundary condition handling

5. **No Disagreement Forcing**: The workflow optimizes for agreement. But meaningful validation often comes from *controlled disagreement*—comparing methods that should agree to precision ε and verifying they do.

### Evidence from Current Reports

From `M0-r1_member_a.md` and `M0-r1_member_b.md`:
- Step 5 validation = direct substitution into closed-form → trivial for LLM
- Computation replication = same formula, same inputs → no independence
- No residual checks, no perturbation analysis, no two-method comparison

**The fundamental issue**: Current checks verify *formula application*, not *algorithmic/methodological soundness*.

---

## 2) Options for Nontrivial Cross-Check Enforcement

### Option 1: Tiered Headline Number Categories with Mandatory Diagnostics

**Mechanism**: Redefine headline numbers into three tiers, requiring at least one from Tier 2 or Tier 3 per milestone.

| Tier | Name | Examples | Diagnostic Power |
|------|------|----------|------------------|
| T1 | Primary Results | Final values, coefficients, predictions | Low (outputs only) |
| T2 | Diagnostic Metrics | Residuals, error bounds, condition numbers, convergence rates | Medium (probes numerics) |
| T3 | Cross-Validation Metrics | Analytic-vs-numeric Δ, two-implementation agreement, invariant drift | High (probes methods) |

**Implementation Changes**:
```yaml
# In reproducibility_capsule.md template
headline_numbers:
  - id: H1
    tier: T1  # Required field
    value: ...
  - id: H2
    tier: T2  # At least one T2 or T3 required
    description: "Residual norm after iteration"
    value: ...
```

**Gate Logic**:
```python
def validate_headlines(capsule, profile):
    tiers = [h['tier'] for h in capsule['headline_numbers']]
    if profile in ['numerics_only', 'mixed']:
        assert any(t in ['T2', 'T3'] for t in tiers), "Numerics profiles require T2+ headline"
    elif profile == 'theory_only':
        # T2 can be asymptotic consistency check, limit verification
        assert any(t in ['T2', 'T3'] for t in tiers) or has_limit_check(capsule)
```

**Pros**:
- Minimal template change (add one field)
- Clear, auditable requirement
- Profile-adaptable tier requirements
- Deterministic: tier classification is unambiguous

**Cons**:
- Doesn't *force* nontrivial computation—agent could misclassify
- Requires tier definitions per profile (documentation overhead)
- Tier boundary disputes possible

**Risk**: Medium. Agents could game by labeling trivial checks as T2.

**Effort**: Low (template + gate change)

**Profile Compatibility**:
| Profile | T2 Example | T3 Example |
|---------|------------|------------|
| theory_only | Limiting case match | Asymptotic vs exact agreement |
| mixed | Truncation error bound | Analytic vs numeric Δ |
| numerics_only | Residual norm | Two-solver agreement |
| methodology_dev | Invariant preservation | Pre/post-transform consistency |
| toolkit_extraction | Unit test pass rate | Boundary case coverage |

---

### Option 2: Mandatory Two-Method Check with Disagreement Metric as Headline

**Mechanism**: Require that at least one headline number is a *disagreement metric* between two independent computational paths.

**Definition of Independence**:
- Different algorithms (e.g., direct solve vs iterative)
- Different representations (e.g., symbolic vs floating-point)
- Different parameter regimes extrapolated to same point
- Different approximation orders compared

**Implementation Changes**:

```yaml
# In reproducibility_capsule.md
two_method_check:
  method_A: "Symbolic integration via residue theorem"
  method_B: "Numerical quadrature (scipy.quad, tol=1e-12)"
  target_quantity: "Integral I_3"
  method_A_result: 2.4674011002723395
  method_B_result: 2.4674011002723391
  disagreement: 4e-16
  expected_tolerance: 1e-14
  status: PASS  # |Δ| < tolerance
```

**Headline Number**:
```yaml
- id: H_cross
  type: two_method_disagreement
  value: 4e-16
  tolerance: 1e-14
  methods: [symbolic_residue, numerical_quad]
```

**Gate Logic**:
```python
def validate_two_method(capsule, profile):
    if profile == 'theory_only':
        # Allow analytic limiting checks as "two-method"
        return has_two_method_check(capsule) or has_analytic_limit_check(capsule)
    else:
        assert has_two_method_check(capsule), "Two-method check required"
        check = capsule['two_method_check']
        assert check['disagreement'] <= check['expected_tolerance'], "Methods disagree beyond tolerance"
```

**Pros**:
- Forces genuine algorithmic independence
- Disagreement metric is inherently diagnostic
- Failure is informative (which method is wrong?)
- Works across all profiles with profile-specific method pairs

**Cons**:
- Higher implementation burden per milestone
- Some theory results may lack natural second method
- Could incentivize artificial method splitting

**Risk**: Low-Medium. The disagreement metric is hard to game—it requires actually running two methods.

**Effort**: Medium (template + gate + guidance for method pairs per profile)

**Profile Compatibility**:
| Profile | Method A | Method B |
|---------|----------|----------|
| theory_only | Exact closed-form | Asymptotic expansion (matching at overlap) |
| mixed | Analytic formula | Numerical evaluation |
| numerics_only | Solver A | Solver B (or same solver, different params) |
| methodology_dev | Forward transform | Inverse transform (round-trip) |
| toolkit_extraction | Reference implementation | Extracted code |

---

### Option 3: Mandatory Audit Slice with Structural Requirements

**Mechanism**: Elevate "Audit slices" from optional to mandatory, with a required *structure* that ensures nontriviality.

**Audit Slice Structure**:
```yaml
audit_slice:
  name: "Convergence audit for iterative refinement"
  type: convergence | residual | perturbation | invariant | boundary
  setup:
    parameter: "iteration_count"
    values: [10, 100, 1000, 10000]
  expected_behavior: "Residual decreases as O(1/n)"
  observed:
    - {n: 10, residual: 0.1}
    - {n: 100, residual: 0.01}
    - {n: 1000, residual: 0.001}
    - {n: 10000, residual: 0.0001}
  fitted_rate: -1.0003  # log-log slope
  pass_criterion: "fitted_rate in [-1.1, -0.9]"
  status: PASS
```

**Audit Slice Types**:
1. **Convergence**: Parameter sweep showing expected convergence rate
2. **Residual**: Compute residual of solution in original equation
3. **Perturbation**: Sensitivity to input perturbation (stability check)
4. **Invariant**: Quantity that should be preserved (energy, norm, etc.)
5. **Boundary**: Behavior at limiting parameter values

**Gate Logic**:
```python
REQUIRED_AUDIT_TYPES = {
    'theory_only': ['boundary', 'invariant'],
    'mixed': ['convergence', 'residual'],
    'numerics_only': ['convergence', 'residual', 'perturbation'],
    'methodology_dev': ['invariant', 'boundary'],
    'toolkit_extraction': ['boundary', 'perturbation']
}

def validate_audit_slice(capsule, profile):
    required = REQUIRED_AUDIT_TYPES[profile]
    present = [a['type'] for a in capsule.get('audit_slices', [])]
    assert any(r in present for r in required), f"Profile {profile} requires audit type from {required}"
```

**Pros**:
- Highly structured—hard to game
- Audit type taxonomy guides meaningful checks
- Profile-specific requirements built in
- Produces rich diagnostic data

**Cons**:
- Significant template complexity increase
- May be overkill for simple milestones
- Requires careful type definitions to avoid loopholes

**Risk**: Medium. Complexity could lead to resistance or boilerplate filling.

**Effort**: Medium-High (template + gate + audit type library + examples)

**Profile Compatibility**: Excellent (type requirements per profile).

---

### Option 4: Reviewer Prompt Contract with Triviality Detection and Escalation

**Mechanism**: Modify Member A/B prompt contracts to include explicit triviality detection, with escalation when all checks are trivial.

**Prompt Addition for Member A/B**:
```markdown
## Triviality Audit (REQUIRED)

Before completing your review, classify each headline number:

| Headline | Triviality Class | Justification |
|----------|------------------|---------------|
| H1 | TRIVIAL / NONTRIVIAL | ... |
| H2 | TRIVIAL / NONTRIVIAL | ... |

**Triviality Criteria**:
- TRIVIAL: Direct substitution into closed-form, single formula evaluation, no algorithmic path exercised
- NONTRIVIAL: Requires iteration, comparison of methods, residual computation, or parameter variation

**Escalation Rule**: If ALL headlines are TRIVIAL, you MUST either:
1. Propose and execute an additional nontrivial check, OR
2. Escalate to orchestrator with justification why no nontrivial check is possible

Escalation format:
```
ESCALATION: All headlines trivial
Reason: [why no nontrivial check is feasible]
Suggested resolution: [what would make this nontrivial]
```
```

**Gate Logic**:
```python
def validate_triviality_audit(member_report):
    audit = extract_triviality_audit(member_report)
    nontrivial_count = sum(1 for h in audit if h['class'] == 'NONTRIVIAL')
    if nontrivial_count == 0:
        escalation = extract_escalation(member_report)
        assert escalation is not None, "All trivial + no escalation = gate fail"
        return {'status': 'ESCALATED', 'reason': escalation['reason']}
    return {'status': 'PASS', 'nontrivial_count': nontrivial_count}
```

**Pros**:
- Leverages agent judgment (LLMs are good at meta-reasoning)
- Minimal template change—mostly prompt engineering
- Escalation creates audit trail
- Self-documenting (agents explain their triviality judgments)

**Cons**:
- Relies on agent honesty/competence
- "NONTRIVIAL" could be gamed via sophistry
- Escalation path needs orchestrator handling logic

**Risk**: Medium-High. Agents might rationalize triviality away.

**Effort**: Low (prompt change + escalation handling)

**Profile Compatibility**: Good (agents adapt judgment to profile context).

---

### Option 5: Code Path Inclusion with Execution Trace Requirement

**Mechanism**: Require that team packets include actual code snippets and execution traces for headline computations, making the algorithmic path visible and auditable.

**Implementation Changes**:

```yaml
# In team_packet.md
headline_computations:
  - id: H2
    code_pointer: "src/integrals.py::compute_I3"
    code_snippet: |
      def compute_I3(a, b, tol=1e-12):
          from scipy.integrate import quad
          integrand = lambda x: np.exp(-a*x) * np.sin(b*x) / x
          result, error = quad(integrand, 0, np.inf, limit=1000)
          return result, error
    execution_trace: |
      >>> compute_I3(1.0, 2.0)
      (0.7853981633974483, 1.2e-14)
    value: 0.7853981633974483
    error_bound: 1.2e-14
```

**Reviewer Task Addition**:
```markdown
## Code Path Audit

For each headline with code_pointer:
1. Verify code snippet matches pointer (or flag discrepancy)
2. Trace execution path for edge cases
3. Identify potential failure modes (overflow, division by zero, convergence failure)
4. Report any concerns
```

**Gate Logic**:
```python
def validate_code_paths(packet, profile):
    if profile == 'theory_only':
        return True  # No code paths expected
    headlines_with_code = [h for h in packet['headline_computations'] if 'code_pointer' in h]
    if profile in ['numerics_only', 'mixed', 'toolkit_extraction']:
        assert len(headlines_with_code) >= 1, "Numeric profiles require code path documentation"
        for h in headlines_with_code:
            assert 'execution_trace' in h, f"Headline {h['id']} missing execution trace"
```

**Pros**:
- Makes algorithmic path explicit and auditable
- Execution traces are ground truth
- Enables genuine code review by Member B
- Natural fit for toolkit_extraction profile

**Cons**:
- Requires code inclusion infrastructure
- Token overhead in packets
- Not applicable to theory_only profile
- Security/IP concerns if code is sensitive

**Risk**: Low (traces are hard to fake), but Medium for implementation complexity.

**Effort**: High (code extraction tooling, trace capture, template changes)

**Profile Compatibility**:
| Profile | Applicability |
|---------|---------------|
| theory_only | N/A (exempt) |
| mixed | Partial (numeric portions) |
| numerics_only | Full |
| methodology_dev | Partial |
| toolkit_extraction | Full (required) |

---

## 3) Recommendation: Ranked Implementation Plan

### Prioritization Matrix

| Option | Nontriviality Enforcement | Implementation Effort | Gaming Resistance | Profile Compatibility |
|--------|---------------------------|----------------------|-------------------|----------------------|
| 1. Tiered Headlines | Medium | Low | Low | High |
| 2. Two-Method Check | High | Medium | High | High |
| 3. Structured Audit Slice | High | Medium-High | High | High |
| 4. Triviality Escalation | Medium | Low | Medium | High |
| 5. Code Path Inclusion | High | High | High | Medium |

### Recommended Path: Layered Implementation

#### P0 (Immediate - Implement First)

**Combine Options 1 + 4: Tiered Headlines with Triviality Escalation**

**Rationale**: Low effort, immediately deployable, creates audit trail, sets foundation for stricter checks.

**Minimal Change Set**:

1. **Template Change** (`reproducibility_capsule.md`):
   ```yaml
   headline_numbers:
     - id: H1
       tier: T1 | T2 | T3  # NEW: Required field
       description: ...
       value: ...
   ```

2. **Gate Addition** (`research_team_integration/gates.py`):
   ```python
   def gate_headline_tiers(capsule, profile):
       tiers = [h['tier'] for h in capsule['headline_numbers']]
       required_tier = 'T2' if profile != 'theory_only' else 'T2'  # T2 for all
       if not any(t in ['T2', 'T3'] for t in tiers):
           return {'status': 'FAIL', 'reason': 'No diagnostic headline (T2/T3) present'}
       return {'status': 'PASS'}
   ```

3. **Member Prompt Addition** (append to member_a/member_b templates):
   ```markdown
   ## Triviality Self-Audit
   
   Classify each headline:
   - TRIVIAL: Formula substitution only
   - NONTRIVIAL: Exercises algorithm, compares methods, or checks diagnostics
   
   If all TRIVIAL, escalate with `ESCALATION: All headlines trivial` and propose remedy.
   ```

**Acceptance Criteria for P0**:
- [ ] All new reports include `tier` field on headlines
- [ ] Gate rejects capsules with only T1 headlines
- [ ] Member reports include triviality self-audit section
- [ ] At least one escalation is triggered and handled in pilot run

---

#### P1 (Short-term - Implement After P0 Validated)

**Option 2: Two-Method Check Requirement**

**Rationale**: Once tier infrastructure exists, two-method checks naturally produce T3 headlines.

**Change Set**:

1. **Template Addition** (`reproducibility_capsule.md`):
   ```yaml
   two_method_check:  # NEW: Required for mixed/numerics profiles
     method_A: ...
     method_B: ...
     disagreement: ...
     tolerance: ...
     status: PASS | FAIL
   ```

2. **Gate Addition**:
   ```python
   def gate_two_method(capsule, profile):
       if profile in ['theory_only']:
           return {'status': 'PASS'}  # Exempt, but can use limit checks
       if 'two_method_check' not in capsule:
           return {'status': 'FAIL', 'reason': 'Two-method check required'}
       check = capsule['two_method_check']
       if check['status'] != 'PASS':
           return {'status': 'FAIL', 'reason': f"Two-method disagreement: {check['disagreement']}"}
       return {'status': 'PASS'}
   ```

3. **Guidance Document**: Method pair suggestions per profile (see Option 2 table).

**Acceptance Criteria for P1**:
- [ ] All non-theory capsules include two_method_check
- [ ] Disagreement metric appears as headline
- [ ] At least one genuine disagreement caught and resolved via this mechanism

---

#### P2 (Medium-term - Implement for Numerics-Heavy Projects)

**Option 3: Structured Audit Slices (for numerics_only and toolkit_extraction)**

**Rationale**: These profiles benefit most from systematic convergence/residual checks. Lower priority because P0+P1 cover most cases.

**Change Set**:
- Full audit slice schema with type taxonomy
- Profile-specific required types
- Audit slice visualization tooling (optional)

**Acceptance Criteria for P2**:
- [ ] Audit slice schema documented
- [ ] At least 3 audit types implemented with examples
- [ ] numerics_only projects consistently produce convergence audits

---

#### P3 (Long-term / As Needed)

**Option 5: Code Path Inclusion**

**Rationale**: High value for toolkit_extraction, but significant infrastructure. Defer until toolkit extraction matures.

---

## 4) Concrete Examples of Nontrivial Headline Numbers

### Example 1: Two-Method Disagreement (Mixed Profile)

**Context**: Computing a definite integral arising in perturbation theory.

```yaml
- id: H_cross_1
  tier: T3
  type: two_method_disagreement
  description: "Analytic vs numeric evaluation of I₃ = ∫₀^∞ e^(-x) sin(2x)/x dx"
  method_A: "Closed-form via arctan: I₃ = arctan(2) = 1.1071487177940904"
  method_B: "scipy.quad with 1000 subdivisions"
  method_A_result: 1.1071487177940904
  method_B_result: 1.1071487177940906
  disagreement: 2e-16
  tolerance: 1e-14
  status: PASS
```

**Why Nontrivial**: Exercises both symbolic derivation correctness AND numerical integration accuracy. Disagreement beyond tolerance would indicate either symbolic error or numerical instability.

---

### Example 2: Residual Norm (Numerics Profile)

**Context**: Solving a nonlinear system F(x) = 0 via Newton iteration.

```yaml
- id: H_residual
  tier: T2
  type: residual
  description: "Residual norm ||F(x*)|| after Newton convergence"
  equation: "F(x) = [x₁² + x₂ - 11, x₁ + x₂² - 7]"
  solution: [3.0, 2.0]
  residual_vector: [1.2e-15, -8.9e-16]
  residual_norm: 1.5e-15
  expected_bound: 1e-12
  status: PASS
```

**Why Nontrivial**: The residual is *not* derivable from the solution alone—it requires evaluating F at x*. A wrong solution would produce large residual. This catches implementation bugs, transcription errors, and numerical issues.

---

### Example 3: Convergence Rate (Numerics Profile)

**Context**: Verifying second-order convergence of a numerical scheme.

```yaml
- id: H_convergence
  tier: T2
  type: convergence_rate
  description: "Spatial convergence rate for finite difference Laplacian"
  parameter: "grid_spacing_h"
  data:
    - {h: 0.1, error: 2.5e-3}
    - {h: 0.05, error: 6.3e-4}
    - {h: 0.025, error: 1.6e-4}
    - {h: 0.0125, error: 4.0e-5}
  fitted_order: 1.98  # log(error) vs log(h) slope
  expected_order: 2.0
  tolerance: 0.1
  status: PASS  # |1.98 - 2.0| < 0.1
```

**Why Nontrivial**: Exercises the numerical scheme at multiple resolutions. Order degradation would indicate bugs, boundary condition errors, or scheme incorrectness. Cannot be faked by formula substitution.

---

### Example 4: Asymptotic Matching (Theory Profile)

**Context**: Verifying a perturbation expansion matches the exact solution in appropriate limits.

```yaml
- id: H_asymptotic
  tier: T3
  type: asymptotic_match
  description: "3rd-order perturbation expansion vs exact in ε → 0 limit"
  exact_formula: "f(ε) = (1 - sqrt(1 - 4ε)) / (2ε)"
  expansion: "f(ε) ≈ 1 + ε + 2ε² + 5ε³ + O(ε⁴)"
  test_points:
    - {epsilon: 0.01, exact: 1.01020305, expansion: 1.01020305, relative_error: 5.1e-8}
    - {epsilon: 0.001, exact: 1.00100200, expansion: 1.00100200, relative_error: 5.0e-11}
  max_relative_error: 5.1e-8
  expected_scaling: "O(ε⁴)"
  observed_scaling_exponent: 3.97
  status: PASS
```

**Why Nontrivial**: Validates that the perturbation series is correct by checking against the exact result. Error scaling confirms the expansion is correct to the claimed order. This is strictly stronger than verifying individual coefficients.

---

### Example 5: Invariant Preservation (Methodology Profile)

**Context**: Symplectic integrator for Hamiltonian system.

```yaml
- id: H_invariant
  tier: T2
  type: invariant_preservation
  description: "Energy drift in symplectic Störmer-Verlet integration"
  system: "Harmonic oscillator H = (p² + q²)/2"
  initial_energy: 0.5
  integration_time: 1000.0
  timestep: 0.01
  final_energy: 0.5000000000127
  energy_drift: 1.27e-11
  drift_bound: 1e-8
  status: PASS
```

**Why Nontrivial**: Energy conservation is a structural property of the method. Drift beyond bounds indicates implementation error or method incorrectness. This cannot be verified by formula—requires actual integration.

---

### Example 6: Round-Trip Consistency (Methodology/Toolkit Profile)

**Context**: Verifying a transform and its inverse are correctly implemented.

```yaml
- id: H_roundtrip
  tier: T3
  type: round_trip
  description: "FFT → IFFT round-trip error"
  input: "Random complex vector, n=1024"
  operation: "ifft(fft(x))"
  max_elementwise_error: 2.3e-15
  expected_bound: "n * machine_epsilon ≈ 2.3e-13"
  status: PASS
```

**Why Nontrivial**: Exercises both forward and inverse transforms. Errors indicate implementation bugs, normalization errors, or precision loss. The random input ensures broad coverage.

---

### Example 7: Boundary/Limit Behavior (Theory Profile)

**Context**: Verifying a general formula reduces to known special case.

```yaml
- id: H_limit
  tier: T2
  type: boundary_limit
  description: "General hypergeometric reduces to exponential at a=b"
  general_formula: "₁F₁(a; b; z)"
  special_case: "When a = b: ₁F₁(a; a; z) = eᶻ"
  test_point: {a: 3, b: 3, z: 1}
  general_result: 2.718281828459045
  special_result: 2.718281828459045  # exp(1)
  agreement: 0.0
  status: PASS
```

**Why Nontrivial**: Validates the general implementation against a known special case. This catches errors in the general formula that would be invisible from direct evaluation alone.

---

## Summary

| Priority | What | Why | Acceptance Test |
|----------|------|-----|-----------------|
| **P0** | Tiered headlines + Triviality escalation | Low effort, immediate impact, creates audit infrastructure | Gate rejects T1-only capsules; escalation triggers on trivial-only runs |
| **P1** | Two-method check requirement | Forces genuine algorithmic independence | Disagreement metric headline in every non-theory capsule |
| **P2** | Structured audit slices | Systematic convergence/residual checking for numerics | Audit type taxonomy in use for numerics_only projects |
| **P3** | Code path inclusion | Full transparency for toolkit extraction | Deferred until toolkit workflow matures |

**Minimal Next Change Set (P0)**:
1. Add `tier: T1|T2|T3` field to headline schema
2. Add tier validation gate (require T2+ present)
3. Add triviality self-audit section to member prompts
4. Add escalation handling to orchestrator

This layered approach ensures immediate improvement while building toward comprehensive nontriviality enforcement.
