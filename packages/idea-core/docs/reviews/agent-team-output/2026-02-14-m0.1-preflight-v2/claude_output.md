VERDICT: READY

## Blockers

None. All five M0.1 acceptance criteria are satisfied by the evidence in this packet:

1. **Problem restatement + success/failure criteria** — Target outputs are concrete and well-scoped: numeric bounds for $D^\pi(0)$ and the gravitational radius from $\Theta_2'(0)$. Success is clearly defined by producing these bounds with evidence traceability.

2. **Hard constraints captured** — All four hard constraints (no coupled-channel, pion-only, laptop-only ≤3 days, evidence-first) are explicitly stated and consistently referenced in risks and mitigations.

3. **Risks identified with concrete mitigations** — Four risks (R1–R4) are enumerated, each with an actionable mitigation or fail-fast check (Python fallback for solver, truncation study for single-channel, convention freeze + unit test for notation, calibration + error model for digitization).

4. **3-day executable breakdown** — M0.1–M0.5 milestones are defined with expected outputs at each stage.

5. **Sync wiring** — GitHub Project exists (private, user project #2) with five cards carrying distinct PVTI IDs and correct statuses (M0.1 In Progress, M0.2–M0.5 Todo). Append-only tracker records these IDs.

## Non-blocking

1. **Success/failure criteria could be sharper.** The packet says "numeric bounds" but does not specify a quantitative fail-fast gate, e.g., "if no finite two-sided bound on $D^\pi(0)$ is obtained by end of M0.3, abort or rescope." Adding an explicit go/no-go number or condition at M0.3 would reduce waste.

2. **Solver fallback is vague.** R1 says "keep small convex fallback only if wheels install" — it would be better to name the exact Python packages planned (e.g., `cvxpy` + `SCS`/`CLARABEL`) and record a 10-minute install-and-smoke-test as the first action in M0.2.

3. **Core-paper evidence index is incomplete.** Paper 2505.19332 and 2410.23333 (`FitPionsv2.tex`) are listed but only four of five papers have local paths recorded. Confirm 2505.19332 is downloaded or mark it as a known gap.

4. **Tracker schema not shown.** The packet states an append-only log exists but does not quote its schema (columns, timestamp format). Pinning a minimal schema now prevents drift.

5. **Convention freeze deferred to M0.2.** This is acceptable but carries minor risk: if the mapping is ambiguous, M0.2 scope could inflate. Consider locking the canonical form factor decomposition (e.g., Polyakov–Schweitzer convention) in the preflight doc now, even if the unit test lives in M0.2.

## Real-research fit

- **Scope is realistic for 3 days.** Single-channel elastic pion bootstrap with dispersive GFF constraints is a well-posed problem with existing literature formulae. The laptop-only constraint is credible given that the SDP sizes for single-channel pion problems are small.
- **Evidence-first discipline is well-matched.** Tracing every bound back to code output + paper equation is standard practice in dispersive analyses and aligns with the five-paper evidence base.
- **The choice of target observables ($D^\pi(0)$, gravitational radius) is timely.** These are actively debated quantities with forthcoming EIC/JLab relevance; reproducing or tightening bootstrap bounds has immediate publication value.
- **Single-channel truncation is the correct first step.** Coupled-channel effects (KK̄ threshold) are known to be sub-dominant for the low-$t$ gravitational form factors; the planned truncation-dependence study (R2 mitigation) is the standard robustness check.

## Robustness & safety

- **Provenance:** Local arXiv source paths are recorded; this enables equation-level traceability. Recommend adding SHA-256 hashes of downloaded `.tex` files to the tracker for tamper-evidence.
- **Hallucination mitigation:** The notation-freeze + unit-test plan (R3) directly addresses the most common failure mode in multi-paper GFF work (sign/normalization mismatches). The explicit mapping $\{A, D, \bar{c}\} \leftrightarrow \{\Theta_1, \Theta_2\}$ with a $t=0$ identity check is the right test.
- **Reproducibility:** Evidence-first + in-repo storage of all intermediate arrays and calibration data (R4) is strong. Ensure the tracker also records Python/package versions (a one-line `pip freeze > requirements.txt` at M0.2 start).
- **Fail-fast:** R1 (solver) has a clear fail-fast (wheels don't install → fallback). R2 (truncation) has a study but no explicit abort criterion. R3 and R4 have unit tests / calibration checks. Overall adequate for M0.1; recommend tightening R2 at M0.2 entry.

## Specific patch suggestions

### 1. Preflight doc — add explicit go/no-go gate at M0.3

**File:** `docs/preflight.md` (or wherever the milestone breakdown lives)

**Change:** Under the M0.3 entry, append:

```markdown
**Go/no-go gate (M0.3 exit):**
- PASS: at least one finite two-sided bound on D^π(0) is produced, with value
  and truncation parameters recorded in the tracker.
- FAIL: no finite bound → trigger rescope discussion before M0.4.
```

### 2. Preflight doc — pin solver stack for R1

**File:** `docs/preflight.md`, under Risk R1

**Change:** Replace "Python-first approach; keep small convex fallback only if wheels install" with:

```markdown
Primary: `cvxpy` (≥1.4) + `CLARABEL` (pure-Rust, pip-installable, no license).
Fallback: `cvxpy` + `SCS`.
Fail-fast: `pip install cvxpy clarabel && python -c "import cvxpy; print(cvxpy.installed_solvers())"` 
must succeed within 10 min at M0.2 start; if not, abort SDP route and fall back to 
direct dispersive integral bounds only.
```

### 3. Tracker — add schema header

**File:** `tracker.md` (or equivalent append-only log)

**Change:** If not already present, prepend:

```markdown
## Schema
| Column       | Type      | Description                                    |
|--------------|-----------|------------------------------------------------|
| timestamp    | ISO-8601  | UTC time of entry                              |
| milestone    | M0.x      | Milestone tag                                  |
| pvti_id      | string    | GitHub Project PVTI card ID                    |
| status       | enum      | Todo / In Progress / Done / Blocked / Aborted  |
| evidence     | path/URL  | Pointer to artifact or commit SHA              |
| note         | free text | Brief description of update                    |
```

### 4. Preflight doc — record missing paper path

**File:** `docs/preflight.md`, under "Local paper-source evidence"

**Change:** Add entry for 2505.19332 or mark gap:

```markdown
- 2505.19332: [TODO: download and record path; required before M0.2 start]
```

### 5. Preflight doc — add source file hashes

**File:** `docs/preflight.md`, under "Local paper-source evidence"

**Change:** Append a hash column:

```markdown
| arXiv ID    | Local path                          | SHA-256 (first 16 hex) |
|-------------|-------------------------------------|------------------------|
| 2507.05375  | .../sn-article.tex                  | `<compute at commit>`  |
| 2411.13398  | .../main_arxiv.tex                  | `<compute at commit>`  |
| 2403.10772  | .../arxiv_submission_3_v10.tex      | `<compute at commit>`  |
| 2410.23333  | .../FitPionsv2.tex                  | `<compute at commit>`  |
```

### 6. Preflight doc — lock canonical convention now

**File:** `docs/preflight.md`, under Notation risk (R3)

**Change:** Add a provisional convention lock (can be refined in M0.2 but gives a starting point):

```markdown
**Provisional canonical convention (Polyakov–Schweitzer, PRD 60, 114002):**
  ⟨p'|T^μν|p⟩  →  A(t) [P^μ P^ν] + D(t) [Δ^μ Δ^ν − g^μν Δ²] / (2m)   (+ trace/c̄ term)
  Mapping: Θ₁(t) = A(t),  Θ₂(t) = A(t) + (t/4m²) D(t)  [verify sign in M0.2 unit test]
  Normalization: Θ₂(0) = A(0) = 1  (momentum sum rule)
```
