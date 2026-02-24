# Ensuring Nontrivial Cross-Checks in Numerics-Heavy Projects

## 1. Short Diagnosis

**Core problem**: Current workflow permits *semantic triviality* despite syntactic compliance. Both agents execute the same algebraic formula using different arithmetic engines, which:

- ✅ Catches transcription errors, unit mismatches, order-of-magnitude mistakes
- ❌ Misses algorithmic bugs, stability issues, discretization errors, floating-point pathologies
- ❌ Provides no **implementation independence** (both derive from identical symbolic expression)
- ❌ Creates false confidence—gates pass but numerical correctness remains unaudited

**Root cause**: Headline number spec lacks *audit depth taxonomy*. A "headline number" currently means "any computable scalar," collapsing diverse validation strategies into arithmetic substitution.

---

## 2. Three Concrete Mechanisms

### **A. Stratified Headline Taxonomy with Mandatory Audit Tier**

**Spec**: Partition headlines into three tiers; require ≥1 from Tier 2/3 per milestone.

| Tier | Type | Example | Audit Value |
|------|------|---------|-------------|
| **1** | Direct output | `H2 = 0.4821` | Minimal (arithmetic only) |
| **2** | Diagnostic/residual | `||Ax - b|| = 3.2e-9` | Medium (correctness proxy) |
| **3** | Two-method delta | `|analytical - numerical| / analytical = 1.4e-6` | High (implementation independence) |

**Gating rule**:
```
PASS iff (count(Tier2) + count(Tier3) ≥ 1) AND all_headlines_agree
```

**Pros**:
- ✅ Minimal workflow disruption (add 1 diagnostic headline)
- ✅ Deterministic (no Monte Carlo, no parameter sweeps)
- ✅ Works across profiles (theory_only → residual of analytical identity; numerics_only → convergence metric)

**Cons**:
- ⚠️ Requires discipline: agents might "game" by computing `x - x` as a Tier-3 headline
- ⚠️ Residuals can be trivial if the equation is already solved symbolically
- ⚠️ Needs clear examples in prompt library

---

### **B. Mandatory Audit Proxy with Code-Path Divergence**

**Spec**: Each milestone must include ≥1 "audit proxy" where Member A and Member B use **different computation strategies** (not just different languages).

**Enforcement**:
```markdown
## Audit Proxy (REQUIRED)

**Quantity**: [Name + value]
**Member A strategy**: [e.g., "Analytic closed-form"]
**Member B strategy**: [e.g., "Numerical quadrature (Simpson's rule, 1000 pts)"]
**Divergence metric**: |A - B| / max(|A|, |B|, epsilon)
**Acceptance**: < 1e-5
**Code paths reviewed**: [Yes/No + reviewer initials]
```

**Strategy menu** (profile-aware):

| Profile | Primary Strategy | Fallback Strategy |
|---------|------------------|-------------------|
| `theory_only` | Symbolic (SymPy) | Series expansion (manual, 5 terms) |
| `numerics_only` | Production solver | Independent reimplementation (minimal solver) |
| `mixed` | Analytic | Numerical (quadrature/ODE/etc.) |
| `methodology_dev` | Reference impl | Alternative algorithm |

**Pros**:
- ✅ Forces true implementation independence
- ✅ Catches discretization/truncation/stability bugs
- ✅ Code-path review requirement surfaces hidden complexity

**Cons**:
- ❌ Higher runtime cost (2× computation minimum)
- ❌ May require significant extra work (implementing fallback solver)
- ❌ Hard to define "different strategy" rigorously (needs prompt engineering)

---

### **C. Parameterized Invariant Checks (Deterministic Slices)**

**Spec**: For each headline number `H`, require **one invariant check** that holds for any valid parameter instantiation.

**Template**:
```python
# Headline: H2 = f(α, β, γ)
# Invariant: H2 must satisfy g(H2, α, β, γ) ≈ 0

def audit_H2(alpha, beta, gamma):
    H2 = compute_headline(alpha, beta, gamma)
    residual = g(H2, alpha, beta, gamma)  # e.g., substitute into original PDE/ODE
    assert abs(residual) < tolerance, f"Invariant violated: {residual}"
    return H2

# Baseline
H2_baseline = audit_H2(α=1.0, β=0.5, γ=0.3)

# Deterministic perturbations (no randomness)
H2_perturb1 = audit_H2(α=1.1, β=0.5, γ=0.3)  # +10% α
H2_perturb2 = audit_H2(α=1.0, β=0.55, γ=0.3) # +10% β

# Monotonicity check (if theory predicts direction)
assert H2_perturb1 > H2_baseline  # if ∂H2/∂α > 0 known
```

**Audit value**:
- Exercises full algorithmic path (not just arithmetic)
- Checks consistency (invariant) rather than absolute value
- Deterministic parameter slices avoid flakiness

**Pros**:
- ✅ Cheap runtime overhead (2-3 extra evaluations)
- ✅ Exposes algorithmic bugs (boundary conditions, singularities)
- ✅ Deterministic (no random seeds)
- ✅ Applicable to theory (symbolic invariants) and numerics (residual checks)

**Cons**:
- ⚠️ Requires domain knowledge (what invariant? what direction?)
- ⚠️ Theory-only projects may lack natural perturbations
- ⚠️ Risk of "obvious" invariants (e.g., `H2 == H2`)

---

## 3. Minimal "Audit Proxy" Patterns (Cheap but Meaningful)

Below are **4+ audit proxy patterns** ranked by cost/benefit. Each is deterministic, profile-aware, and adds <10% runtime overhead.

### **Pattern 1: Residual-Based Validation**

**Cost**: 1 extra function evaluation  
**Applicability**: `numerics_only`, `mixed`

```python
# Headline: x_star (solution to f(x) = 0)
x_star = solve_nonlinear(f, x0=1.0)
residual = abs(f(x_star))
assert residual < 1e-8, f"Solver failed: residual={residual}"
```

**Audit value**: Validates solver succeeded, catches non-convergence.

---

### **Pattern 2: Dual-Method Reconciliation**

**Cost**: 1.5–2× original computation  
**Applicability**: `mixed`, `methodology_dev`

```python
# Headline: I (definite integral)
I_analytic = integrate_symbolic(expr, (x, a, b))  # SymPy
I_numeric = quad(lambda x: expr.subs(...), a, b)[0]  # SciPy
delta = abs(I_analytic - I_numeric) / abs(I_analytic)
assert delta < 1e-6, f"Methods disagree: {delta}"
```

**Audit value**: Implementation independence, catches symbolic/numeric bugs.

---

### **Pattern 3: Invariant Slice (Deterministic Perturbation)**

**Cost**: 2–3 extra evaluations  
**Applicability**: All profiles

```python
# Headline: H(θ) with known monotonicity
H_base = compute_H(theta=1.0)
H_up   = compute_H(theta=1.1)
H_down = compute_H(theta=0.9)

# Check monotonicity (if dH/dθ > 0 is theoretically known)
assert H_down < H_base < H_up, "Monotonicity violated"

# Check smoothness (finite difference approximation)
dH_dtheta_numeric = (H_up - H_down) / 0.2
dH_dtheta_analytic = compute_derivative(theta=1.0)
assert abs(dH_dtheta_numeric - dH_dtheta_analytic) / abs(dH_dtheta_analytic) < 0.05
```

**Audit value**: Exercises algorithmic path, validates theory-predicted behavior.

---

### **Pattern 4: Boundary/Limit Check**

**Cost**: 1–2 extra evaluations  
**Applicability**: All profiles

```python
# Headline: H(ε) where lim_{ε→0} H(ε) = H_0 (known analytically)
H_eps = compute_H(epsilon=1e-6)
H_0_analytic = 0.5  # from asymptotic analysis
assert abs(H_eps - H_0_analytic) < 1e-4, "Limit check failed"
```

**Audit value**: Validates asymptotic correctness, catches coefficient errors.

---

### **Pattern 5: Conservation Law / Symmetry Check**

**Cost**: 1 extra evaluation  
**Applicability**: `numerics_only`, `mixed` (especially PDEs, physics sims)

```python
# Headline: Energy E(t) at final time
E_final = simulate(T=10.0)

# Conservation: E(0) ≈ E(T) for conservative system
E_initial = 1.0  # known initial condition
assert abs(E_final - E_initial) / E_initial < 1e-5, "Energy not conserved"
```

**Audit value**: Validates numerical scheme (stability, dissipation).

---

### **Pattern 6: Dimensionality / Units Check**

**Cost**: Zero runtime (static analysis)  
**Applicability**: All profiles

```python
from pint import UnitRegistry
ureg = UnitRegistry()

# Headline: velocity v
distance = 100 * ureg.meter
time = 10 * ureg.second
v = distance / time
assert v.dimensionality == ureg.meter / ureg.second, "Dimension mismatch"
```

**Audit value**: Catches formula errors, unit inconsistencies.

---

### **Pattern 7: Comparison to Literature / Benchmark**

**Cost**: Zero (if benchmark value available)  
**Applicability**: All profiles

```python
# Headline: Critical exponent γ
gamma_computed = fit_critical_exponent(data)
gamma_literature = 1.237  # [Smith et al. 2015]
assert abs(gamma_computed - gamma_literature) / gamma_literature < 0.02, \
    "Disagrees with literature"
```

**Audit value**: External validation, catches conceptual errors.

---

### **Pattern 8: Cross-Profile Handoff (Theory ↔ Numerics)**

**Cost**: Depends on handoff complexity  
**Applicability**: `mixed` projects

```python
# Theory: Asymptotic formula H_asymptotic(N) ~ C * N^α
# Numerics: Compute H_numeric(N) for large N

N_large = 10000
H_numeric = compute_numerically(N_large)
C_fit, alpha_fit = fit_power_law([(N, compute_numerically(N)) for N in [1000, 5000, 10000]])

# Compare to theory
C_theory, alpha_theory = 0.5, 1.5
assert abs(alpha_fit - alpha_theory) < 0.05, "Exponent mismatch"
```

**Audit value**: Validates theory-numerics consistency, catches modeling errors.

---

## 4. Suggested Regression Tests for the Workflow

### **Test Suite A: Triviality Detection (Meta-Workflow Tests)**

**Purpose**: Ensure the workflow itself rejects trivial cross-checks.

```python
def test_reject_trivial_arithmetic():
    """Both agents compute H = a*b with same formula → should FAIL gate."""
    report_A = {
        "headlines": [{"name": "H", "value": 6.0, "tier": 1, "method": "2*3"}]
    }
    report_B = {
        "headlines": [{"name": "H", "value": 6.0, "tier": 1, "method": "2*3"}]
    }
    result = gate_check(report_A, report_B)
    assert result.status == "FAIL", "Should reject: no Tier 2/3 headline"
    assert "trivial" in result.message.lower()

def test_accept_dual_method():
    """Agent A analytic, Agent B numeric → should PASS."""
    report_A = {
        "headlines": [
            {"name": "I", "value": 0.5, "tier": 3, "method": "symbolic"},
            {"name": "delta", "value": 1.2e-7, "tier": 3, "method": "abs(analytic - numeric)"}
        ]
    }
    report_B = {
        "headlines": [
            {"name": "I", "value": 0.5000001, "tier": 3, "method": "quad()"},
            {"name": "delta", "value": 1.2e-7, "tier": 3, "method": "abs(analytic - numeric)"}
        ]
    }
    result = gate_check(report_A, report_B)
    assert result.status == "PASS"

def test_require_code_path_review():
    """If audit proxy used, code-path review must be logged."""
    report = {
        "audit_proxies": [{"reviewed": False}]
    }
    result = gate_check_final(report)
    assert result.status == "FAIL", "Code-path review required but missing"
```

---

### **Test Suite B: Audit Proxy Pattern Validation**

**Purpose**: Verify that audit proxy patterns themselves are correct.

```python
def test_residual_pattern():
    """Residual check should catch non-convergence."""
    def f(x):
        return x**2 - 2
    x_star = 1.4  # intentionally wrong (true root ~1.414)
    residual = abs(f(x_star))
    assert residual > 1e-8, "Should detect bad solution"

def test_invariant_slice_monotonicity():
    """Monotonicity check should catch sign error."""
    def H(theta):
        return -theta**2  # bug: should be +theta^2 (monotone increasing)
    
    H_base = H(1.0)
    H_up = H(1.1)
    
    # This should fail if H is supposed to be monotone increasing
    with pytest.raises(AssertionError):
        assert H_up > H_base, "Monotonicity violated"

def test_dual_method_detects_bug():
    """Dual-method should catch integration bug."""
    # Analytic: ∫₀¹ x dx = 0.5
    I_analytic = 0.5
    
    # Numeric (buggy: wrong limits)
    from scipy.integrate import quad
    I_numeric = quad(lambda x: x, 0, 2)[0]  # bug: upper limit should be 1
    
    delta = abs(I_analytic - I_numeric) / abs(I_analytic)
    assert delta > 1e-6, "Should detect integration bug"
```

---

### **Test Suite C: Profile-Specific Compliance**

**Purpose**: Each profile has appropriate audit requirements.

```python
def test_theory_only_profile():
    """theory_only: require symbolic residual or series check."""
    report = {
        "profile": "theory_only",
        "headlines": [
            {"name": "gamma", "value": "2/3", "tier": 2, "method": "substitute into PDE"}
        ]
    }
    result = validate_profile_compliance(report)
    assert result.status == "PASS"

def test_numerics_only_profile():
    """numerics_only: require convergence study or dual-solver."""
    report = {
        "profile": "numerics_only",
        "headlines": [
            {"name": "E", "value": 1.234, "tier": 1, "method": "RK45"},
            {"name": "convergence_rate", "value": 1.98, "tier": 2, "method": "Richardson extrapolation"}
        ]
    }
    result = validate_profile_compliance(report)
    assert result.status == "PASS"

def test_mixed_profile():
    """mixed: require theory-numerics reconciliation."""
    report = {
        "profile": "mixed",
        "audit_proxies": [
            {
                "quantity": "I",
                "method_A": "analytic",
                "method_B": "numeric",
                "delta": 1.2e-6
            }
        ]
    }
    result = validate_profile_compliance(report)
    assert result.status == "PASS"
```

---

### **Test Suite D: Determinism Checks**

**Purpose**: Ensure no non-determinism introduced.

```python
def test_deterministic_audit_proxy():
    """Run audit proxy 10 times, should get identical results."""
    results = [run_audit_proxy("H2", seed=None) for _ in range(10)]
    assert len(set(results)) == 1, "Non-determinism detected"

def test_no_random_sampling():
    """Audit proxies should not use random parameter sweeps."""
    code = inspect.getsource(audit_H2)
    assert "random" not in code.lower(), "Random sampling detected"
    assert "monte carlo" not in code.lower(), "Monte Carlo detected"
```

---

## 5. Recommended Path Forward

### **Phase 1: Immediate (Next Milestone)**

**Adopt Mechanism A (Stratified Headline Taxonomy)** with the following changes:

1. **Update headline spec**:
   ```markdown
   ## Headline Numbers (Reproducibility Capsule)
   
   Provide ≥2 headlines, including ≥1 from Tier 2 or 3:
   
   - **Tier 1** (Direct): Primary result values (e.g., H2 = 0.4821)
   - **Tier 2** (Diagnostic): Residuals, error estimates, convergence rates
   - **Tier 3** (Two-method): Dual-method deltas (e.g., |analytic - numeric|/|analytic|)
   ```

2. **Add to gate logic**:
   ```python
   def check_triviality(report_A, report_B):
       tier23_A = [h for h in report_A["headlines"] if h["tier"] >= 2]
       tier23_B = [h for h in report_B["headlines"] if h["tier"] >= 2]
       
       if len(tier23_A) == 0 or len(tier23_B) == 0:
           return FAIL("No Tier 2/3 headline found—cross-check is trivial")
       
       return PASS
   ```

3. **Update Member A/B prompts**:
   - Add explicit instruction: *"You MUST include at least one Tier 2 or Tier 3 headline. If the problem does not naturally admit one, propose a diagnostic (residual, invariant, or dual-method check) and implement it."*
   - Add triviality self-check: *"Before finalizing, review: would an independent implementation catch bugs in my code? If no, escalate."*

**Pros**: Minimal disruption, immediate impact, low risk.

**Cons**: Agents may still game the system with "fake" diagnostics.

---

### **Phase 2: Near-Term (Within 2 Milestones)**

**Add Mechanism C (Parameterized Invariant Checks)** as a **profile-specific requirement**:

| Profile | Required Audit Proxy Pattern |
|---------|------------------------------|
| `theory_only` | Symbolic residual or limit check (Pattern 4) |
| `numerics_only` | Convergence study or conservation law (Pattern 5) |
| `mixed` | Dual-method reconciliation (Pattern 2) |
| `methodology_dev` | Benchmark comparison (Pattern 7) |

**Implementation**:
- Add `audit_proxies` section to team packet template
- Require Member C (you) to review and sign off on nontriviality
- Include 2–3 example audit proxies in prompt library

---

### **Phase 3: Medium-Term (Future Workflow Iteration)**

**Selectively adopt Mechanism B (Code-Path Divergence)** for high-stakes milestones:

- Require for final submission or major claims
- Require code-path review by human (Member C or external reviewer)
- Build library of "fallback strategies" (minimal solvers, series expansions) to reduce implementation cost

---

## 6. Example Workflow Update (Concrete)

### **Before** (Current, Trivial):

**Member A Report (M0-r1)**:
```markdown
## Headline Numbers
- H2 = 0.4821 (computed via H2 = α·β·γ with α=1.2, β=0.8, γ=0.5)

## Validation
Step 5: Substituted values into H2 = α·β·γ, obtained 0.4821. ✓
```

**Member B Report (M0-r1)**:
```markdown
## Computation Replication
- H2 = 0.4821 (recomputed via H2 = α·β·γ with α=1.2, β=0.8, γ=0.5)
- Agreement: exact match. ✓
```

**Gate**: ✅ PASS (but trivial!)

---

### **After** (Mechanism A + C):

**Member A Report (M1-r1)**:
```markdown
## Headline Numbers

### Tier 1 (Direct)
- H2 = 0.4821 (analytic: H2 = α·β·γ with α=1.2, β=0.8, γ=0.5)

### Tier 2 (Diagnostic)
- H2_residual = 3.2e-12 (substituted H2 into originating PDE: |∂²H/∂α² + f(α,β,γ)| < tol)

### Tier 3 (Two-Method)
- H2_numeric = 0.48210014 (numerical: integrated ODE for H(t) from t=0 to t_final)
- delta = |H2_analytic - H2_numeric| / |H2_analytic| = 2.9e-6 ✓

## Audit Proxy (Invariant Slice)
Checked monotonicity: H2(α) should increase with α (theory predicts ∂H2/∂α > 0).
- H2(α=1.1) = 0.4403 < H2(α=1.2) = 0.4821 ✓
- Finite-difference ∂H2/∂α ≈ 0.418 matches analytic derivative 0.417 (0.2% error) ✓
```

**Member B Report (M1-r1)**:
```markdown
## Computation Replication

### Tier 1 (Direct)
- H2 = 0.4821 (symbolic: SymPy integration of governing PDE)

### Tier 3 (Two-Method)
- H2_quadrature = 0.48210022 (scipy.integrate.quad with 10^4 points)
- delta = 4.6e-7 (agrees with Member A's numeric method) ✓

## Audit Proxy (Boundary Check)
Verified lim_{γ→0} H2(γ) = 0 (analytical).
- H2(γ=10^-6) = 6.0e-7 (numerical) ✓
```

**Gate**:
- ✅ Both reports include Tier 3 headlines
- ✅ Audit proxies present (invariant slice + boundary check)
- ✅ Headlines agree within tolerance
- ✅ **Member C review**: Code paths diverge (analytic vs. ODE vs. quadrature); invariants meaningful.

**Result**: ✅ PASS (nontrivial!)

---

## 7. Summary Table

| Mechanism | Cost | Triviality Resistance | Determinism | Profile Coverage | Recommendation |
|-----------|------|----------------------|-------------|------------------|----------------|
| **A. Stratified Headlines** | Low | Medium | ✓ | All | ✅ **Adopt immediately** |
| **B. Code-Path Divergence** | High | Very High | ✓ | All | Phase 3 (selective) |
| **C. Invariant Slices** | Low | High | ✓ | All | ✅ **Adopt Phase 2** |

**Audit Proxy Patterns** (use ≥1 per milestone):

1. ✅ **Residual validation** (cheap, universal)
2. ✅ **Dual-method reconciliation** (medium cost, high value)
3. ✅ **Invariant slice** (cheap, catches algorithmic bugs)
4. ✅ **Boundary/limit checks** (cheap, validates asymptotics)
5. Conservation laws (domain-specific)
6. Dimensionality checks (zero cost)
7. Literature benchmarks (if available)
8. Cross-profile handoff (theory ↔ numerics)

---

## Final Recommendation

**Immediate action** (for next milestone):

1. ✅ Implement **Mechanism A** (Stratified Headlines): require ≥1 Tier 2/3 headline per report
2. ✅ Add **Audit Proxy Pattern 1 or 3** (residual or invariant slice) as lightweight requirement
3. ✅ Update Member A/B prompts with triviality self-check
4. ✅ Gate enforces: `count(Tier2+Tier3) ≥ 1` and `audit_proxy_present == True`

**Within 2 milestones**:

5. ✅ Add profile-specific audit proxy menu (Mechanism C)
6. ✅ Member C reviews audit proxy nontriviality (sign-off required)

**Future** (high-stakes milestones only):

7. Require code-path divergence (Mechanism B) for major claims

This approach balances **rigor** (nontrivial audits), **pragmatism** (low overhead), and **determinism** (no flakiness), while scaling gracefully across all research profiles.
