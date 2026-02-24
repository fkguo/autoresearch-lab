I'll review this draft cycle enhancement proposal as Member C, focusing on usability, readability, and failure-mode clarity without blocking unless there's a correctness issue.

Let me first check if there are relevant skills for conducting this review.

<function_calls>
<invoke name="Skill">
<parameter name="name">using-superpowers</parameter>
</invoke>
</function_calls>
<parameter name="type">claude</parameter>
<parameter name="skill_name">using-superpowers</parameter>
<parameter name="data">Already displayed in system context</parameter>

<function_calls>
<invoke name="Skill">
<parameter name="name">research-team</parameter>
</invoke>
</function_calls>
<parameter name="type">claude</parameter>
<parameter name="skill_name">research-team</parameter>
<parameter name="data">
---
name: research-team
description: Multi-agent research workflow (Gemini+Claude+O1) with staged consensus-building
version: 2.0.0
---

# Research Team Skill

A **deterministic, source-controlled, multi-agent research workflow** for producing publication-quality technical documents with staged consensus and formal verification gates.

## Core Philosophy

**Research is software.** Every stage must be:
- **Traceable**: Git-versioned sources + timestamped run artifacts
- **Reviewable**: Human-readable diffs, not binary blobs
- **Reproducible**: Same sources → same outputs
- **Verifiable**: Automated gates enforce contracts

**Three agents, three perspectives:**
- **Member A (Claude)**: Depth, rigor, creative exploration
- **Member B (Gemini)**: Breadth, practical grounding, alternative angles  
- **Member C (O1)**: Integration, final synthesis, publication polish

## Workflow Stages

```
┌─────────────────────────────────────────────────────────────┐
│ 1. IDEATION (human-led, optional agents)                   │
│    • Explore problem space                                  │
│    • Define research question                               │
│    • No formal outputs required                             │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. RESEARCH CYCLE (A→B consensus with optional C audit)    │
│    • A investigates → detailed report                       │
│    • B reviews A + adds perspective → synthesis             │
│    • C optionally audits for gaps (non-blocking)            │
│    • Iterate until consensus OR archive as inconclusive     │
│    Output: research/cycles/C<n>/                            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. DRAFT CYCLE (LaTeX → 3-member review → convergence)     │
│    • Human writes LaTeX sources (research/paper/)           │
│    • Build review packet (PDF + metadata)                   │
│    • A reviews (technical depth)                            │
│    • B reviews (clarity, gaps)                              │
│    • C reviews (leader audit: usability + failure modes)    │
│    • Convergence gate: ALL must report "ready" + 0 blockers │
│    • If not converged: revise sources, rerun new tag        │
│    Output: team/runs/D<n>-r<k>/                             │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. PUBLICATION (git-tagged release)                         │
│    • Final LaTeX sources committed                          │
│    • Git tag: v<paper-id>                                   │
│    • Archived artifacts + reproducibility manifest          │
└─────────────────────────────────────────────────────────────┘
```

## Key Contracts

### Research Cycle
- **Input**: Research question + context (via Markdown or conversation)
- **Member A**: Investigates, produces `research/cycles/C<n>/member_a_report.md`
- **Member B**: Reviews A's work, adds perspective → `member_b_synthesis.md`
- **Member C (optional)**: Non-blocking audit → `member_c_audit.md`
- **Convergence**: Explicit consensus declaration or archive as inconclusive
- **Output**: Cycle directory with timestamped, versioned reports

### Draft Cycle (NEW in this enhancement)
- **Input**: LaTeX sources in `research/paper/` + draft tag (e.g., `D0-r1`)
- **Preflight gate**: `check_tex_draft_preflight.py` validates sources exist, compile-ready
- **Review packet**: `build_draft_packet.py` → PDF + metadata JSON
- **Member A**: Technical depth review → `*_draft_member_a.md`
- **Member B**: Clarity/gaps review → `*_draft_member_b.md`
- **Member C (Leader)**: Usability/failure-mode audit → `*_draft_member_c_leader.md`
- **Convergence gate**: `check_draft_convergence.py`
  - Parses all three reports' `## Verdict` sections
  - Requires: `Verdict: ready for review cycle` AND `Blocking issues count: 0` from ALL
  - Exit 0 = converged, Exit 1 = not converged, Exit 2 = contract violation
- **Iteration semantics**: If not converged, human revises LaTeX sources and reruns with new tag (e.g., `D0-r2`)
- **Output**: `team/runs/<tag>/` with all reports + convergence artifacts

### Reviewer Output Contract (Draft Cycle)
Each draft reviewer MUST produce:
```markdown
## Verdict
Verdict: ready for review cycle | needs revision
Blocking issues count: N
Rationale: <one-line explanation>

## Blocking Issues
- <issue 1 with line/section reference>
- <issue 2 with line/section reference>
(or "(none)" if N=0)
```

**Contract enforcement**:
- Declared count N MUST match bullet count in "## Blocking Issues" section
- Mismatch → convergence gate exits 2 (parse error)
- Counting rule: top-level bullets only (indentation < 2 spaces); nested bullets allowed but not counted

## Tools & Scripts

### Research Cycle
- `scripts/bin/run_research_cycle.sh` - Orchestrates A→B→C flow
- `scripts/bin/next_research_cycle.sh` - Suggests next cycle number
- Config: `research_team_config.json` → `research_cycle.*`

### Draft Cycle
- `scripts/bin/run_draft_cycle.sh` - Orchestrates preflight → packet → A→B→C → convergence
- `scripts/bin/build_draft_packet.py` - LaTeX → PDF + metadata
- `scripts/gates/check_tex_draft_preflight.py` - Validates LaTeX sources
- `scripts/gates/check_draft_convergence.py` - Deterministic convergence gate (NEW)
- `scripts/bin/next_draft_tag.py` - Suggests next tag (NEW)
- Config: `research_team_config.json` → `draft_review.*`

### Navigation
- `scripts/bin/update_project_map.py` - Generates `team/LATEST_*.md` pointers
- `team/LATEST_RESEARCH.md` - Links to most recent research cycle
- `team/LATEST_DRAFT.md` - Links to most recent draft run + convergence status

## Configuration

`research_team_config.json`:
```json
{
  "research_cycle": {
    "member_a_system_prompt": "prompts/_system_research_member_a.txt",
    "member_b_system_prompt": "prompts/_system_research_member_b.txt",
    "member_c_system_prompt": "prompts/_system_research_member_c.txt"
  },
  "draft_review": {
    "require_convergence": true,  // NEW: default true in scaffold
    "leader_system_prompt": "prompts/_system_draft_member_c_leader.txt",  // NEW
    "member_a_system_prompt": "prompts/_system_draft_member_a.txt",
    "member_b_system_prompt": "prompts/_system_draft_member_b.txt"
  }
}
```

**Breaking change in defaults**: Scaffolded projects now enforce convergence by default.

## Testing

- **Smoke tests**: `scripts/dev/smoke/smoke_test_tex_draft_cycle.sh`
  - Covers A/B/C full run + convergence PASS/FAIL
  - Uses stub runners (no external LLM calls)
- **Contract validation**: `scripts/validation/run_full_contract_validation.sh`
  - "Draft cycle contract" section tests convergence gate exit codes and trajectory stages

## Usage Examples

### Draft Cycle (typical flow)

```bash
# Initial draft (D0-r1)
scripts/bin/run_draft_cycle.sh --tag D0-r1

# If not converged (exit 1), check reports:
cat team/runs/D0-r1/D0-r1_draft_convergence_log.md

# Revise LaTeX sources in research/paper/
# Then rerun with new revision tag:
scripts/bin/run_draft_cycle.sh --tag D0-r2

# Repeat until converged (exit 0)
```

### Suggest next tag
```bash
scripts/bin/next_draft_tag.py
# Output: D0-r3 (based on existing runs)
```

## Failure Modes & Mitigations

### Research Cycle
- **No consensus after N iterations**: Archive as inconclusive, document why
- **Member unavailable**: Fallback to 2-member (A+B) with explicit note
- **Scope creep**: Timebox investigations, split into multiple cycles if needed

### Draft Cycle (NEW)
- **False convergence** (gate says ready but issues exist):
  - Mitigation: Strict contract enforcement (declared count MUST match bullets)
  - Mitigation: Leader (Member C) specifically audits for failure modes
- **Brittle parsing** (legitimate reports fail to parse):
  - Mitigation: Counting rule allows nested bullets, only counts top-level
  - Mitigation: Gate exits 2 (not 1) on parse errors, clearly distinguishable
  - Open question: Is this too strict? (see review questions below)
- **Gate skipped** (exit 0 when should fail):
  - Mitigation: run_draft_cycle.sh propagates gate exit code exactly
  - Mitigation: Trajectory stages (`draft_converged` vs `draft_not_converged`) logged explicitly
  - Mitigation: Contract validation tests both PASS and FAIL cases

### Cross-cutting
- **Config drift**: Validation suite runs on every commit
- **Lost artifacts**: All outputs timestamped and git-tracked (except large PDFs → .gitignore)
- **Unclear next steps**: `team/LATEST_*.md` always points to current state

## Open Questions (from enhancement proposal)

1. **Is the convergence gate contract sufficiently strict to prevent false convergence?**
   - Requires ALL members to say "ready" AND "Blocking issues count: 0"
   - Declared count must match actual bullet count (exit 2 if mismatch)
   - Leader specifically audits for failure modes

2. **Any failure modes where run_draft_cycle could incorrectly exit 0 or skip the gate?**
   - Script captures gate exit code and propagates it
   - Trajectory stages logged explicitly
   - Contract validation tests both converged and not-converged cases

3. **Are the output filenames and LATEST pointers consistent and discoverable?**
   - Naming: `team/runs/<tag>/<tag>_draft_member_{a,b,c_leader}.md`
   - Convergence: `<tag>_draft_{convergence_log,converged_summary}.md`
   - LATEST updated by update_project_map.py

4. **Is the contract too brittle for real reviewer outputs (risking exit 2 too often)?**
   - Counting rule: top-level bullets only (indentation < 2 spaces)
   - Nested bullets allowed but not counted
   - Question remains: will this fail too often in practice?

## When to Use This Skill

- **Planning** a new research question or technical investigation
- **Running** a research cycle (A→B→C)
- **Preparing** LaTeX sources for draft review
- **Running** a draft cycle with convergence enforcement
- **Debugging** why a draft didn't converge
- **Understanding** the team's workflow or output contracts

## When NOT to Use This Skill

- Quick fact-checking or one-off questions (no multi-agent needed)
- Informal brainstorming without publication intent
- Non-research tasks (use appropriate domain skills instead)

---

**Version history**:
- 2.0.0: Added draft cycle leader audit + strict convergence gate
- 1.0.0: Initial research cycle (A→B consensus, optional C audit)
</parameter>

Now reviewing the enhancement proposal against the skill's stated contracts and failure modes.

---

**DECISION: ACCEPT**

**BLOCKERS:**
(none)

**NONBLOCKING:**

- **Brittleness risk (exit 2 frequency)**: The "top-level bullets only" counting rule is reasonable but may still fail if reviewers use varied Markdown styles (e.g., asterisks vs hyphens, extra blank lines, accidental indentation). Consider logging the parsed bullet count alongside the declared count in `--out-log` so users can debug mismatches without reading code.

- **Member C "leader" vs "audit" terminology inconsistency**: The role is called "leader audit" in the prompt filename (`_system_draft_member_c_leader.txt`) but the skill description says Member C does "usability/failure-mode audit." Clarify whether "leader" implies decision authority or just a distinct audit lens. If it's purely non-blocking (as stated), consider `_system_draft_member_c_audit.txt` for clarity.

- **Convergence artifact naming potential confusion**: `*_draft_converged_summary.md` is written even when NOT converged (it summarizes the gate decision regardless). The filename implies success. Consider `*_draft_convergence_summary.md` (drop "converged") to avoid misleading users who scan filenames.

- **Exit code 2 vs 1 distinction in user-facing docs**: The skill notes exit 2 = parse/contract error, but typical users may not distinguish "I did something wrong" (exit 2) from "the draft isn't ready" (exit 1). Consider a one-line stderr hint on exit 2: `"ERROR: Review reports do not match contract (declared count ≠ bullet count). See convergence log."`

- **Config default change notification**: Setting `require_convergence: true` by default is a breaking change for workflows that previously tolerated non-converged drafts. The proposal notes this, but consider adding a migration note in `CHANGELOG.md` or scaffold docs so existing projects know to opt out if needed.

- **LATEST_DRAFT.md link order**: The template should list convergence artifacts (log + summary) BEFORE individual member reports, since users typically care about "did it converge?" before diving into per-member details. Current template order is unclear from the proposal.

**NOTES:**

- **Correctness**: No blocking issues found. The exit-code propagation, trajectory stage logging, and contract validation tests adequately cover the "false convergence" and "skipped gate" risks.

- **Counting rule is defensible**: Allowing nested bullets but only counting top-level is a pragmatic middle ground. Too strict (no nesting) would force unnatural flat lists; too loose (count all bullets) would make accidental sub-points inflate the count.

- **Deterministic convergence is a major win**: The previous "no gate" state left convergence ambiguous. Forcing explicit iteration with new tags (`D0-r1` → `D0-r2`) is the right primitives for version-controlled research.

- **Leader participation closes the loop**: Having Member C audit for failure modes (not just technical correctness) addresses a real gap. The non-blocking stance is appropriate—this is a sidecar check, not a veto.

- **`next_draft_tag.py` is good UX**: Suggesting the next tag reduces cognitive load and prevents tag collisions.

- **Test coverage is solid**: Stub-runner smoke tests + contract validation (PASS/FAIL cases) are sufficient for deterministic logic without LLM flakiness.

Overall: This is a well-structured enhancement with clear contracts, appropriate failure mitigations, and good test coverage. The nonblocking issues are all usability/clarity refinements, not correctness problems.
