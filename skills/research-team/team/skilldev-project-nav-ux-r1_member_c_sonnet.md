**Using skill: product-design** to evaluate navigation UX proposal from a practical, user-centered perspective.

<answer type="PendingSkillResult">

Let me invoke the product-design skill to properly assess this navigation UX problem.

</answer>

---

## QA/UX Audit: Navigation System for Research-Team Workflow

### Verdict: **CONCERNS** (non-blocking, but implementation order matters)

---

## Executive Summary

The proposal addresses a real pain point, but **Option P0 alone is insufficient** at scale. Recommended approach: **staged P0 → P1 → P2** with specific guardrails to prevent "maintained documentation" from becoming stale fiction.

---

## Critical Issues Identified

### 1. **The "Dashboard Decay" Anti-Pattern**

**Risk**: `START_HERE.md` becomes the first thing to go stale.

**Evidence from real projects**:
- Handwritten dashboards drift within 2-3 cycles
- Generated dashboards that aren't validated become noise
- Users stop trusting the entrypoint, revert to grep/find

**Mitigation Required**:
```
P0 MUST include:
- Programmatic generation (not manual)
- Link validation in CI/gate (fail on 404s)
- Timestamp + staleness warning if >7 days old
- Content checksums for linked targets
```

Without validation, you're creating a **liability**, not an asset.

---

### 2. **Missing User Journey Clarity**

The proposal lists "what to link" but not **WHY each persona clicks each link**.

**Missing personas**:
- **Investigator** (you, returning after 2 weeks): "What changed? What's blocked? What needs my input?"
- **Collaborator** (new team member): "What's the current state? Where's the evidence for claim X?"
- **Writer** (paper deadline): "What figures/tables/references go in Section 3?"
- **Auditor** (reviewer/advisor): "Show me the derivation + method justification + validation."

**Fix**: Structure `START_HERE.md` by **task intent**, not file type:

```markdown
# START HERE

Last updated: 2024-01-15 14:32 UTC (auto-generated)

## Quick Status (Investigator)
- ✅ Latest cycle: `team/runs/2024-01-15_cycle-047/` — APPROVED
- ⚠️  Blocked: Task #12 (needs literature on X)
- 📊 Active: 3 tasks in progress (see RESEARCH_PLAN.md)

## Understanding the Project (Collaborator)
1. **Goals & Scope**: [PROJECT_CHARTER.md](PROJECT_CHARTER.md)
2. **Current Plan**: [RESEARCH_PLAN.md](RESEARCH_PLAN.md)
3. **Knowledge Base**: [knowledge_base/INDEX.md](knowledge_base/INDEX.md)

## Key Chains (Auditor)
- **Derivation**: [Draft_Derivation.md](Draft_Derivation.md#main-theorem) → [Proof sketch](#proof) → [Numerical validation](artifacts/LATEST.md#validation)
- **Algorithm Design**: [PREWORK.md](PREWORK.md#method-selection) → [knowledge_base/methodology_traces/](knowledge_base/methodology_traces/)
- **Evidence Trail**: [team/trajectory_index.json](team/trajectory_index.json)

## Paper Artifacts (Writer)
- **Figures**: [artifacts/LATEST.md](artifacts/LATEST.md) (links to `artifacts/runs/2024-01-15/figures/`)
- **References**: [knowledge_base/bib_export.bib](knowledge_base/bib_export.bib)
- **Export Bundle**: Run `./scripts/export_paper_bundle.sh` → `export/paper_bundle_2024-01-15/`
```

---

### 3. **Directory Hygiene is Mandatory, Not Optional**

**Why P1 is NOT optional**:
- Without partitioning, `team/` becomes a 200-file graveyard by cycle 50.
- Without `LATEST.md` redirection, users must mentally version-sort.
- Without archiving, search tools (grep/ag/IDEs) become unusable.

**Recommended structure**:
```
team/
  LATEST.md              # symlink or pointer to runs/2024-01-15_cycle-047/
  runs/
    2024-01-15_cycle-047/
      decision_packet.md
      member_a_report.md
      member_b_report.md
      adjudication.md
      logs/
    2024-01-12_cycle-046/
      ...
  archive/               # compressed older runs (>30 days)

artifacts/
  LATEST.md              # pointer to runs/2024-01-15/
  runs/
    2024-01-15/
      manifest.json
      figures/
      data/
    ...
```

**Critical detail**: `LATEST.md` must be **auto-updated on gate pass**, not manually. Otherwise it becomes stale immediately.

---

### 4. **The 1000-File Scale Test**

**Failure modes at scale**:
- `START_HERE.md` becomes 500 lines of links → users don't read it.
- `knowledge_base/INDEX.md` becomes a 50-page document → defeats purpose.
- Link validation takes >5 minutes → blocks fast iteration.

**Solution: Two-Tier Navigation**

**Tier 1: START_HERE.md** (≤100 lines, task-oriented, updated every cycle)
- Quick status
- 3-5 primary workflows
- Links to Tier 2 indices

**Tier 2: Domain Indices** (regenerated on-demand, can be large)
- `knowledge_base/INDEX.md` (full KB map)
- `team/HISTORY.md` (all cycles, compressed view)
- `artifacts/CATALOG.md` (all figures/data with thumbnails)

**Validation strategy**:
```python
# Fast validation (run on every gate):
- Check START_HERE.md links (≤10 targets)
- Check LATEST.md pointers

# Full validation (weekly cron):
- Check all Tier 2 indices
- Regenerate stale indices
- Report broken cross-references
```

---

## Recommended Staged Implementation

### **Stage 1: Foundation (Week 1)** — MUST HAVE

**Deliverables**:
1. `START_HERE.md` template (task-oriented, ≤100 lines)
2. Directory restructure (P1): `team/runs/`, `artifacts/runs/`
3. `LATEST.md` auto-update on gate pass
4. Link validation script (fail on 404s in `START_HERE.md`)

**Success criteria**:
- User can answer "what's the current status?" in <30 seconds.
- `START_HERE.md` never goes stale (validated on every commit).

**Implementation**:
```python
# In team_gate.py (after adjudication approval):
def update_navigation():
    cycle_tag = f"{datetime.now().strftime('%Y-%m-%d')}_cycle-{cycle_num:03d}"
    
    # Archive current cycle
    shutil.move("team/current/", f"team/runs/{cycle_tag}/")
    
    # Update LATEST pointer
    with open("team/LATEST.md", "w") as f:
        f.write(f"# Latest Team Cycle\n\n")
        f.write(f"**Cycle**: {cycle_tag}\n")
        f.write(f"**Status**: {status}\n")
        f.write(f"**Reports**: [View full cycle](runs/{cycle_tag}/)\n")
    
    # Regenerate START_HERE
    generate_start_here(cycle_tag)
    
    # Validate links
    validate_links("START_HERE.md", fail_on_broken=True)
```

---

### **Stage 2: Chain Traceability (Week 2)** — HIGH VALUE

**Deliverables**:
1. `Draft_Derivation.md` with anchor tags (#theorem-1, #proof-sketch, etc.)
2. `knowledge_base/methodology_traces/DECISION_LOG.md` (why each method was chosen)
3. Auto-generated chain maps in `START_HERE.md`

**Success criteria**:
- User can click from `START_HERE.md` → specific theorem → proof → validation plot in <3 clicks.
- Derivation→Algorithm→Evidence chains are explicit, not inferred.

**Example chain map**:
```markdown
## Derivation Chain: Main Theorem

1. **Statement**: [Draft_Derivation.md#theorem-1](Draft_Derivation.md#theorem-1)
2. **Proof Sketch**: [Draft_Derivation.md#proof-sketch](Draft_Derivation.md#proof-sketch)
3. **Numerical Validation**: [artifacts/LATEST.md#validation-plots](artifacts/runs/2024-01-15/figures/validation_plot_01.png)
4. **Method Justification**: [knowledge_base/methodology_traces/DECISION_LOG.md#fft-choice](knowledge_base/methodology_traces/DECISION_LOG.md#fft-choice)
5. **Literature Support**: [@recid-smith2020](#ref-smith2020) in [knowledge_base/INDEX.md](knowledge_base/INDEX.md)
```

---

### **Stage 3: Writing Export (Week 3)** — NICE TO HAVE

**Deliverables**:
1. `scripts/export_paper_bundle.sh` that creates:
   ```
   export/paper_bundle_<tag>/
     derivation.md          # cleaned Draft_Derivation
     figures/               # final plots only
     tables/                # LaTeX-ready
     references.bib         # filtered to cited only
     MANIFEST.md            # what's included + why
   ```
2. Optional: LaTeX template that ingests bundle.

**Success criteria**:
- Writer can run one command, get a folder with everything needed for paper.
- No manual file hunting.

---

## Pitfalls & Mitigations

### **Pitfall 1: Broken Link Hell**

**Symptom**: At file 500, 30% of internal links are broken.

**Mitigation**:
- Validate on every gate (mandatory).
- Use relative paths, not absolute.
- Never wrap Markdown links in backticks (breaks rendering).
- CI pre-commit hook to catch breaks early.

---

### **Pitfall 2: Index Generation Cost**

**Symptom**: Regenerating `knowledge_base/INDEX.md` takes 10 minutes.

**Mitigation**:
- Incremental updates (track what changed).
- Full regeneration weekly, not every cycle.
- Cache expensive operations (graph traversal).

---

### **Pitfall 3: "Too Much Dashboard"**

**Symptom**: `START_HERE.md` grows to 300 lines, users ignore it.

**Mitigation**:
- Hard limit: 100 lines.
- Enforce in CI: fail if `wc -l START_HERE.md > 100`.
- Move details to Tier 2 indices.

---

### **Pitfall 4: Manual Maintenance Trap**

**Symptom**: After 5 cycles, someone forgets to update `LATEST.md`.

**Mitigation**:
- **Zero manual steps**. All updates programmatic.
- Gate enforcement: cannot pass without updated navigation.
- Weekly audit report (automated).

---

## Concrete Recommendations

### **DO THIS** (High ROI, Low Risk):

1. **Staged rollout**: P0 → P1 → P2 (3 weeks).
2. **Automated everything**: No manual dashboard updates.
3. **Link validation**: Mandatory gate check.
4. **Task-oriented navigation**: "Quick Status", "Understand Project", "Trace Claims", "Write Paper".
5. **Two-tier indices**: Lightweight `START_HERE.md`, detailed domain indices.

### **DON'T DO THIS** (Risk > Reward):

1. ❌ **Manual `START_HERE.md` maintenance** → will go stale.
2. ❌ **Optional link validation** → will break at scale.
3. ❌ **Single-tier navigation** (all links in one file) → unusable at 1000 files.
4. ❌ **Wrap Markdown links in backticks** → breaks clickability.
5. ❌ **Defer directory hygiene (P1)** → creates debt that compounds.

---

## Minimal Spec (Stage 1 Only)

**Files to create**:
- `START_HERE.md` (template, auto-generated)
- `team/LATEST.md` (auto-updated pointer)
- `artifacts/LATEST.md` (auto-updated pointer)
- `scripts/validate_links.py` (CI gate)
- `scripts/generate_navigation.py` (run on gate pass)

**Update trigger points**:
- On `team_gate.py` approval
- On `RESEARCH_PLAN.md` update
- On `Draft_Derivation.md` significant edit (detected via diff)

**Success criteria** (measurable):
- **Time to status**: User answers "what's the current state?" in <30s (manual test).
- **Link health**: 100% of `START_HERE.md` links valid (automated).
- **Freshness**: `START_HERE.md` timestamp <7 days old (warn if older).

---

## Final Recommendation

**Adopt P0 + P1 immediately** (Stage 1 + Stage 2), defer P2 until writing phase begins.

**Critical path**:
1. Week 1: Directory hygiene + basic navigation + validation.
2. Week 2: Chain traceability + anchor tags.
3. Week 3+ (optional): Export bundle when paper writing starts.

**This is not a "nice to have"** — without this, the system becomes unusable at scale. The cost of retrofit is 10x the cost of doing it now.
