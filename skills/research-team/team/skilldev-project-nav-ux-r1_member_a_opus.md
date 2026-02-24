I'll invoke relevant skills to approach this design review systematically.

Let me now analyze this UX/design proposal as Member A (Claude Opus), providing a comprehensive review.

---

# Member A Review: Project Navigation UX Improvement

## Executive Summary

**Recommended approach: Staged P0 → P1 → P2**, with P0 as the critical foundation, P1 as high-value follow-on, and P2 as optional polish.

The core insight: **the problem isn't too many files—it's missing navigation affordances**. The traceability is *working as designed*; what's missing is the "table of contents" layer that makes traceability *usable*.

---

## Option Analysis

### Option P0: "Front Door" Navigation ✅ **STRONGLY RECOMMENDED**

**Pros:**
| Benefit | Why it matters |
|---------|----------------|
| Single canonical entry point | Eliminates "where do I start?" paralysis |
| Zero structural migration | Low implementation risk |
| Preserves all existing traceability | Team cycles, KB provenance untouched |
| Chains are *views*, not duplication | Links into existing files, no content sprawl |
| Cheap to implement | Template on scaffold + append-only updates |
| Degrades gracefully | Stale dashboard still useful (links work) |

**Cons:**
| Concern | Mitigation |
|---------|------------|
| Dashboard can become stale | Warn-only freshness check (see below) |
| Another file to maintain | Deterministic generation = minimal burden |
| Could become bloated | Strict section structure; links only, no prose |

**Verdict:** This is the **minimum viable fix**. Without P0, P1 and P2 are polishing a structure no one can navigate.

---

### Option P1: Archive / Partition Outputs ⚠️ **RECOMMENDED (P0 + 2-4 weeks)**

**Pros:**
| Benefit | Why it matters |
|---------|----------------|
| Reduces visual clutter | Top-level dirs stay clean |
| Natural grouping by "run" | Easier to compare/rollback |
| `LATEST.md` symlink pattern | Stable paths for dashboard links |
| Enables garbage collection | Old runs can be archived/deleted |

**Cons:**
| Concern | Mitigation |
|---------|------------|
| Path changes break existing links | Not a concern (backward compat not required) |
| More complex scaffolding | One-time template update |
| `<tag>` naming conventions | Use ISO timestamps: `2025-01-15T1842Z` |
| Cross-run references harder | Dashboard chains link to LATEST, not specific runs |

**Verdict:** Valuable for projects with >3-4 team cycles. Not urgent for initial usability.

---

### Option P2: Writing Export Bundle ⚠️ **OPTIONAL (P0 + P1 first)**

**Pros:**
| Benefit | Why it matters |
|---------|----------------|
| Clean handoff to writing phase | Authors don't wade through intermediates |
| Reproducibility manifest | Bundle is self-contained |
| Shareable | Can send to collaborators without full repo |

**Cons:**
| Concern | Severity |
|---------|----------|
| Duplication (content copied, not linked) | Medium—can diverge from source |
| "When is it ready?" ambiguity | User must trigger manually |
| Scope creep risk | "Just add one more thing" |
| TeX-specific assumptions | Not all projects produce papers |

**Verdict:** Nice-to-have, but **premature optimization**. A well-structured P0 dashboard with a "Writing Chain" section achieves 80% of this.

---

## Minimal Spec for P0 (Dashboard)

### New Files

| File | Purpose | Created | Updated |
|------|---------|---------|---------|
| `START_HERE.md` | Top-level navigation dashboard | Scaffold | After each team cycle, draft cycle, KB mutation |
| `team/LATEST.md` | Pointer to most recent team cycle | Scaffold | After each team cycle |

### `START_HERE.md` Structure

```markdown
# [Project Name] — Navigation

> Last updated: 2025-01-15T18:42:00Z | Status: [In Progress / Complete]

## Quick Start (Read in Order)

1. [PROJECT_CHARTER.md](./PROJECT_CHARTER.md) — Goals, constraints, scope
2. [RESEARCH_PLAN.md](./RESEARCH_PLAN.md) — Task board + progress log  
3. [PREWORK.md](./PREWORK.md) — Literature survey, method selection
4. [Draft_Derivation.md](./Draft_Derivation.md) — Full derivation chain

## Chains

### Derivation Chain
- [§1 Problem Setup](./Draft_Derivation.md#problem-setup)
- [§2 Core Lemma](./Draft_Derivation.md#core-lemma)
- ... (auto-populated from Draft_Derivation.md headers)

### Algorithm/Numerics Chain  
- [Method Selection Rationale](./knowledge_base/methodology/method_selection.md)
- [Implementation Notes](./knowledge_base/methodology/implementation.md)
- [Numerical Validation](./artifacts/LATEST.md#validation)

### Evidence Chain
- [Team Trajectory](./team/trajectory_index.json)
- [Latest Team Cycle](./team/LATEST.md)
- [Knowledge Graph](./knowledge_graph/index.md) *(if enabled)*

### Writing Chain
- [Draft Outline](./paper/outline.md) *(if exists)*
- [Figures Index](./artifacts/figures/INDEX.md) *(if exists)*
- [References](./knowledge_base/references/)

## Knowledge Base
- [KB Index](./knowledge_base/INDEX.md)

## Recent Activity
<!-- Auto-appended; last 5 entries -->
- 2025-01-15: Team Cycle #4 completed → [Adjudication](./team/LATEST.md)
- 2025-01-14: Draft_Derivation.md §3 added
```

### Update Triggers

| Event | Action |
|-------|--------|
| Scaffold | Generate initial `START_HERE.md` from template |
| Team cycle completes | Update "Recent Activity", refresh "Latest Team Cycle" link |
| `Draft_Derivation.md` modified | Regenerate "Derivation Chain" anchors |
| KB index changes | Regenerate "Knowledge Base" section |
| `artifacts/` changes | Update "Algorithm Chain" links |

### Update Mechanism

**Deterministic script** (not LLM-generated) that:
1. Parses `Draft_Derivation.md` for `## ` headers → generates anchor links
2. Reads `team/runs/` (or flat `team/`) for latest cycle → updates pointer
3. Appends to "Recent Activity" (capped at 10 entries)
4. Writes timestamp

Script is invoked:
- Manually: `research-team update-nav`
- Automatically: post-adjudication hook (if hooks exist)

---

## Gate Recommendations

| Check | Mandatory vs Warn-Only | Justification |
|-------|------------------------|---------------|
| `START_HERE.md` exists | **Mandatory** | Without it, navigation fails. Cheap to enforce. |
| `START_HERE.md` freshness (< 24h or < 2 cycles stale) | **Warn-only** | Staleness is annoying, not fatal. Links still work. |
| `team/LATEST.md` points to valid file | **Mandatory** | Broken link = navigation failure. |
| Derivation chain anchors resolve | **Warn-only** | Broken anchors are cosmetic; content exists. |
| No orphan files in `artifacts/` | **Warn-only** | Hygiene, not correctness. |

**Rationale for warn-only defaults:** Mandatory gates that block LLM work create friction that degrades output quality (users skip steps, LLMs hallucinate to satisfy gates). The dashboard's value is *navigational*, not *contractual*. A stale map is better than no map.

---

## Pitfalls and Mitigations

| Pitfall | Likelihood | Mitigation |
|---------|------------|------------|
| **Auto-generated anchors break** (headers renamed) | Medium | Script re-scans on each update; warn if anchor count drops |
| **Dashboard becomes "too much text"** | Medium | Strict template: links only, no prose; max 50 lines |
| **Markdown rendering differences** (GitHub vs Obsidian vs VSCode) | Low | Use only `[text](./path#anchor)` syntax; test in GitHub |
| **"Recent Activity" spam** | Low | Cap at 10 entries; prune oldest |
| **LLM ignores dashboard** | Medium | Skill/hook reminds LLM to consult `START_HERE.md` on entry |

---

## Recommended Implementation Plan

### Phase 0 (Week 1) — MVP Dashboard
- [ ] Define `START_HERE.md` template
- [ ] Implement `update-nav` script (header parsing, timestamp, recent activity)
- [ ] Add mandatory gate: `START_HERE.md` exists
- [ ] Add warn-only gate: freshness check
- [ ] Update scaffold to generate initial dashboard
- [ ] Add post-adjudication hook to call `update-nav`

### Phase 1 (Week 3-4) — Directory Partitioning
- [ ] Migrate `team/` to `team/runs/<tag>/` structure
- [ ] Implement `team/LATEST.md` as redirect
- [ ] Migrate `artifacts/` similarly
- [ ] Update `update-nav` to handle new paths

### Phase 2 (Optional, Week 6+) — Writing Bundle
- [ ] Define bundle contents (subset of dashboard chains)
- [ ] Implement `research-team export-bundle` command
- [ ] Add user prompt for bundle scope

---

## Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| User can reach any file in ≤3 clicks from `START_HERE.md` | Manual audit |
| Derivation chain is fully traceable via dashboard links | Automated link checker |
| New contributor can understand project structure in <5 min | User testing |
| Dashboard update takes <2s | Benchmark script |
| No mandatory gates block valid research output | Gate audit |

---

## Final Recommendation

**Ship P0 immediately.** It solves the "lost in the file swamp" problem with minimal risk. P1 is valuable but not urgent. P2 is premature—wait for user demand.

The key insight: **navigation is a view layer, not a data layer**. The underlying traceability (team cycles, KB provenance, trajectory) is correct. We're adding a *map*, not restructuring the *territory*.
