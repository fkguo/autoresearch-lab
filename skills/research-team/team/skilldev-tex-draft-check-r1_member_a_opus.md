I'll invoke the relevant skills to understand the existing research-team infrastructure before proposing designs.

**Using `research-team` skill to understand current architecture and constraints.**

**Using `brainstorming` skill for structured design exploration.**

Now let me examine the existing research-team implementation to understand the current architecture:

---

# TeX Draft Checking Design Proposal

## 1. Diagnosis: What Can Go Wrong If Naïvely Added

### 1.1 Parsing Fragility
| Problem | Impact | Example |
|---------|--------|---------|
| **Macro expansion hell** | Silently wrong extraction | `\newcommand{\R}{\mathbb{R}}` breaks naive regex for "real numbers" |
| **Multi-file projects** | Missing content | `\input{sections/methods.tex}` not followed |
| **Package-specific syntax** | Parse failures | `\begin{algorithmic}[1]` vs `\begin{algorithm}` |
| **Comments as content** | False positives | `% TODO: prove this later` treated as gap |
| **Conditional compilation** | Version confusion | `\iffalse ... \fi` blocks extracted |

### 1.2 Derivation Checking Pitfalls
| Problem | Impact | Mitigation Needed |
|---------|--------|-------------------|
| **"Obvious" steps** | False gap detection | Domain-calibrated step-size expectations |
| **Notation drift** | Missed inconsistencies | Symbol table extraction before checking |
| **Cross-reference validity** | Phantom references | Deterministic `\label`/`\ref` matching |
| **Implicit assumptions** | Undetected gaps | Force explicit assumption blocks |

### 1.3 Literature Checking Pitfalls
| Problem | Impact | Mitigation Needed |
|---------|--------|-------------------|
| **Citation key ≠ actual paper** | Wrong linkage | BibTeX→DOI→KB normalization |
| **Uncited influences** | Coverage gaps undetected | Semantic similarity to KB, not just citation matching |
| **Self-citation bias** | Overrepresented prior work | Author deduplication |
| **Preprint vs published** | Version confusion | Canonical identifier resolution |

### 1.4 Capsule Boundary Violations
| Problem | Impact | Mitigation Needed |
|---------|--------|-------------------|
| **Derivation in abstract** | Contract violation | Structural zone detection |
| **Claims without body support** | Capsule overreach | Claim→proof traceability |
| **Figures carrying proof burden** | Hidden derivations | Figure caption analysis |

### 1.5 Workflow Integration Risks
| Problem | Impact | Mitigation Needed |
|---------|--------|-------------------|
| **Blocking on PDF generation** | Friction for early drafts | Graceful degradation (TeX-only mode) |
| **Review sprawl** | Unactionable feedback | Structured issue taxonomy |
| **Independent replication failure** | Member A/B reviews collapse | Isolation protocol + merge criteria |

---

## 2. Design Options

### Option A: "Draft Preflight + Structured LLM Review" (Layered Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                    DRAFT CYCLE ENTRY                        │
│  scripts/run_draft_cycle.sh <draft.tex> [--profile=...]     │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ GATE 1: BUILD │    │ GATE 2: REFS  │    │ GATE 3: LINKS │
│ (deterministic)│    │ (deterministic)│    │ (deterministic)│
│ - latexmk -pdf │    │ - biber check │    │ - KB pointer  │
│ - error parse  │    │ - orphan refs │    │   validation  │
│ - warning triage│    │ - undefined   │    │ - backtick    │
│               │    │   citations   │    │   detector    │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                    [All gates pass?]──No──▶ STOP + report
                              │
                             Yes
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              EXTRACTION PHASE (robust heuristics)           │
│  - Structure map (sections, theorems, proofs)               │
│  - Symbol table (defined symbols, first use)                │
│  - Claim registry (theorem statements, main results)        │
│  - Citation graph (what cites what, KB linkage)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 LLM REVIEW PHASE (parallel)                 │
├─────────────────┬─────────────────┬─────────────────────────┤
│ DERIVATION      │ LITERATURE      │ WRITING                 │
│ REVIEW          │ REVIEW          │ REVIEW                  │
│ ─────────────── │ ─────────────── │ ─────────────────────── │
│ Member A: check │ Member A: check │ Member A: structure +   │
│ proof steps     │ coverage gaps   │ clarity                 │
│                 │                 │                         │
│ Member B: check │ Member B: prior │ Member B: claims +      │
│ definitions     │ work proximity  │ framing                 │
│                 │                 │                         │
│ MERGE: unified  │ MERGE: unified  │ MERGE: unified          │
│ gap report      │ lit report      │ suggestions             │
└─────────────────┴─────────────────┴─────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              ARTIFACTS (team/draft_YYYYMMDD_HHMMSS/)        │
│  - preflight_report.md                                      │
│  - derivation_review_A.md, derivation_review_B.md           │
│  - derivation_merged.md                                     │
│  - literature_review_merged.md                              │
│  - writing_suggestions.md                                   │
│  - action_items.md (prioritized, linked to line numbers)    │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- Clear separation of deterministic vs LLM work
- Parallel reviews maintain independence
- Graceful degradation (can skip PDF if not buildable)
- Fits existing Member A/B/C pattern
- Explicit artifact trail

**Cons:**
- New script (`run_draft_cycle.sh`) to maintain
- Extraction phase requires non-trivial heuristics
- May duplicate some work across review types

**Failure Modes:**
- Extraction misses important content → reviews have blind spots
- Gates too strict → blocks useful early drafts
- Merge phase loses nuance from individual reviews

**Effort:** Medium-High (3-5 days for robust implementation)

**Profile Fit:**
| Profile | Fit | Notes |
|---------|-----|-------|
| `mixed` | ★★★★★ | Full feature usage |
| `theory_only` | ★★★★☆ | Heavy derivation focus, light literature |
| `literature_review` | ★★★★☆ | Heavy literature focus, light derivation |
| `toolkit_extraction` | ★★☆☆☆ | Mostly code, minimal TeX |

---

### Option B: "Scope Selection with User-Guided Extraction"

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERACTIVE SCOPE PHASE                  │
│  1. User marks regions with lightweight annotations:        │
│     %!CHECK-DERIVATION: theorem_main                        │
│     %!CHECK-DEFINITION: def_widget                          │
│     %!CLAIM: "We achieve O(n log n) complexity"             │
│  2. Tool extracts only marked regions                       │
│  3. Deterministic validation of annotation syntax           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              FOCUSED REVIEW (on marked regions only)        │
│  - Derivation: only %!CHECK-DERIVATION blocks               │
│  - Definitions: only %!CHECK-DEFINITION blocks              │
│  - Claims: only %!CLAIM statements (capsule contract)       │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- Avoids brittle full-document parsing
- User controls scope → no surprise extractions
- Very clear traceability (annotation → review)
- Minimal false positives

**Cons:**
- Requires user annotation discipline
- May miss unmarked gaps (silent failures)
- Doesn't catch structural issues outside marked zones
- Extra friction for "just check the whole thing" use case

**Failure Modes:**
- User forgets to annotate critical section → unchecked
- Annotation syntax errors → extraction fails
- Annotations become stale across revisions

**Effort:** Low-Medium (2-3 days)

**Profile Fit:**
| Profile | Fit | Notes |
|---------|-----|-------|
| `mixed` | ★★★☆☆ | Works but high annotation burden |
| `theory_only` | ★★★★☆ | Natural fit for proof-heavy work |
| `literature_review` | ★★☆☆☆ | Awkward for prose-heavy docs |
| `toolkit_extraction` | ★★★☆☆ | Good for algorithm blocks |

---

### Option C: "PDF-First with TeX Fallback"

```
┌─────────────────────────────────────────────────────────────┐
│                    PRIMARY: PDF ANALYSIS                    │
│  1. Extract text + structure from PDF (pdftotext, PyMuPDF)  │
│  2. Page/section detection from visual layout               │
│  3. Equation extraction via image segmentation              │
└─────────────────────────────────────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
      [PDF available?]               [TeX source available?]
               │                             │
              Yes                           Yes
               │                             │
               ▼                             ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  PDF-based review        │    │  TeX reconciliation      │
│  (reader's perspective)  │    │  (author's perspective)  │
└──────────────────────────┘    └──────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              CROSS-VALIDATION: PDF↔TeX consistency          │
│  - Missing content in PDF (compilation issues)              │
│  - Visual vs source structure alignment                     │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- PDF is the "ground truth" readers see
- Catches compilation artifacts (wrong figures, missing refs)
- TeX parsing becomes secondary, not blocking
- Catches visual issues (layout, equation rendering)

**Cons:**
- PDF extraction is lossy (especially for equations)
- Requires working build to get PDF
- Line number traceability is hard
- Dual processing increases complexity

**Failure Modes:**
- PDF extraction mangles equations → bad derivation review
- TeX/PDF mismatch detection has false positives
- No PDF available → degrades to TeX-only

**Effort:** High (4-6 days)

**Profile Fit:**
| Profile | Fit | Notes |
|---------|-----|-------|
| `mixed` | ★★★☆☆ | Useful but complex |
| `theory_only` | ★★☆☆☆ | Equation extraction too lossy |
| `literature_review` | ★★★★☆ | Good for prose-heavy, visual structure |
| `toolkit_extraction` | ★☆☆☆☆ | Overkill |

---

### Option D: "Minimal TeX Extraction + Structured Prompting"

```
┌─────────────────────────────────────────────────────────────┐
│              MINIMAL EXTRACTION (regex + heuristics)        │
│  Extract only:                                              │
│  - Environment boundaries (\begin{theorem}...\end{theorem}) │
│  - Section headings (\section{...}, \subsection{...})       │
│  - Citation keys (\cite{...}, \citep{...})                  │
│  - Label/ref pairs (\label{...}, \ref{...})                 │
│  - BibTeX entries (key → metadata)                          │
│  NO: macro expansion, full parse, cross-file resolution     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              STRUCTURED LLM REVIEW (full source context)    │
│  Prompt includes:                                           │
│  - Full TeX source (or chunked if >100K tokens)             │
│  - Extracted structure map (for navigation)                 │
│  - BibTeX database                                          │
│  - KB literature notes (relevant subset)                    │
│                                                             │
│  Output schema enforced:                                    │
│  ```yaml                                                    │
│  derivation_gaps:                                           │
│    - location: "Theorem 3.2, line 4 of proof"               │
│      gap_type: "skipped_step"                               │
│      description: "..."                                     │
│      severity: high|medium|low                              │
│  ```                                                        │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- Avoids parser complexity
- LLM handles ambiguity gracefully
- Structured output enables tooling (action item generation)
- Full context means no blind spots from extraction
- Schema enforcement enables independent replication

**Cons:**
- Token costs for large documents
- LLM may hallucinate locations/line numbers
- Less deterministic than gate-based approaches

**Failure Modes:**
- Document too large → chunking loses cross-references
- Structured output schema violation → downstream tooling breaks
- LLM conflates similar theorems

**Effort:** Medium (2-4 days)

**Profile Fit:**
| Profile | Fit | Notes |
|---------|-----|-------|
| `mixed` | ★★★★☆ | Good balance |
| `theory_only` | ★★★★☆ | Works well with structured prompting |
| `literature_review` | ★★★★★ | Excellent for semantic coverage |
| `toolkit_extraction` | ★★★☆☆ | Usable but not primary use case |

---

### Option E: "Capsule-Centric Checking" (Contract-First)

```
┌─────────────────────────────────────────────────────────────┐
│              CAPSULE EXTRACTION (from abstract/intro)       │
│  1. Parse abstract + intro for claims                       │
│  2. Build claim registry with unique IDs                    │
│  3. Capsule = {claims} (nothing else)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              CLAIM→BODY TRACEABILITY CHECK                  │
│  For each claim in capsule:                                 │
│  - Does body contain supporting derivation/evidence?        │
│  - Is the support complete? (all quantifiers, conditions)   │
│  - Are there body results NOT in capsule? (under-selling)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              DERIVATION/LITERATURE AS SUPPORT CHECKS        │
│  - Derivation review: does proof actually establish claim?  │
│  - Literature review: is claim novel given cited work?      │
│  - Writing review: is claim stated clearly and precisely?   │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- Enforces capsule boundary rule by design
- Structured around paper's logical contract
- Catches over-claiming and under-claiming
- Natural priority: claims first, support second

**Cons:**
- Requires claim extraction to be accurate
- May not fit all paper types (e.g., surveys)
- Capsule identification is itself non-trivial

**Failure Modes:**
- Claim extraction misses key result → incomplete check
- Implicit claims (not stated as theorems) missed
- Survey papers have no clear capsule

**Effort:** Medium (3-4 days)

**Profile Fit:**
| Profile | Fit | Notes |
|---------|-----|-------|
| `mixed` | ★★★★★ | Natural fit for claim-based research |
| `theory_only` | ★★★★★ | Perfect for theorem-driven papers |
| `literature_review` | ★★☆☆☆ | Poor fit (no clear claims) |
| `toolkit_extraction` | ★★★☆☆ | Claims are "tool does X" |

---

## 3. Recommendation: Staged Rollout

### Synthesis: Hybrid of Options A + D + E

The recommended design combines:
- **Option A's layered architecture** (gates → extraction → review)
- **Option D's minimal extraction** (avoid parser brittleness)
- **Option E's capsule-centric framing** (contract-first)

---

### P0: Deterministic Infrastructure (Week 1)

**Scope:**
1. `scripts/run_draft_cycle.sh` entry point
2. Deterministic gates (build, refs, links)
3. Minimal extraction (structure map, citation keys, label/ref)
4. KB linkage validation

**Acceptance Criteria:**
- [ ] `run_draft_cycle.sh draft.tex` runs without error on valid LaTeX
- [ ] Gate failures produce actionable error messages with file:line
- [ ] Extraction produces `team/draft_*/structure_map.json`:
  ```json
  {
    "sections": [{"title": "...", "start_line": N, "end_line": M}],
    "environments": [{"type": "theorem", "label": "thm:main", ...}],
    "citations": [{"key": "smith2023", "locations": [L1, L2]}],
    "refs": [{"label": "thm:main", "ref_locations": [...]}]
  }
  ```
- [ ] Citation→KB linkage check: each `\cite{key}` must have corresponding `knowledge_base/literature/<key>.md` or explicit "uncovered" marker
- [ ] Backtick detector: no `` `citation` `` patterns; must be clickable pointers

**Regression Tests:**
```bash
# Gate tests
test_build_gate_catches_undefined_control_sequence
test_build_gate_passes_clean_document
test_ref_gate_catches_orphan_label
test_ref_gate_catches_undefined_citation
test_link_gate_catches_backtick_citations
test_link_gate_validates_kb_pointers

# Extraction tests
test_extraction_handles_multifile_input
test_extraction_ignores_comments
test_extraction_handles_custom_theorem_envs
```

**Artifacts:**
```
team/draft_YYYYMMDD_HHMMSS/
├── preflight_report.md        # Gate results
├── structure_map.json         # Extracted structure
├── citation_kb_linkage.md     # Citation → KB mapping
└── gate_errors.log            # Raw errors for debugging
```

---

### P1: Structured LLM Reviews (Week 2)

**Scope:**
1. Derivation review (Member A + B, independent)
2. Literature coverage review (Member A + B, independent)
3. Merge protocols
4. Writing suggestions (single pass, not independent)

**Acceptance Criteria:**
- [ ] Derivation review produces structured output per schema:
  ```yaml
  derivation_review:
    gaps:
      - id: GAP-001
        location: "Theorem 3.2, proof line 4"
        gap_type: skipped_step | undefined_term | missing_assumption | circular_reasoning
        description: "Step from X to Y requires intermediate result Z"
        severity: high | medium | low
        suggested_fix: "Add lemma showing Z"
    symbol_issues:
      - id: SYM-001
        symbol: "\\alpha"
        issue: "Used before definition"
        first_use_line: 42
        definition_line: null | N
  ```
- [ ] Literature review produces:
  ```yaml
  literature_review:
    coverage_gaps:
      - topic: "Widget optimization bounds"
        missing_work: ["Smith 2023 (related but uncited)", "Jones 2022 (foundational)"]
        severity: high | medium | low
    closest_prior_work:
      - claim: "Our main theorem"
        closest: "Smith 2019, Theorem 4.1"
        relationship: generalizes | specializes | orthogonal | contradicts
        notes: "..."
    citation_issues:
      - key: "smith2023"
        issue: "Cited but not discussed"
  ```
- [ ] Member A and B reviews produced independently (separate prompts, no cross-contamination)
- [ ] Merge produces unified report with attribution (`[A]`, `[B]`, `[both]`)
- [ ] Writing suggestions cover: structure, clarity, claims framing, capsule compliance

**Regression Tests:**
```bash
# Review schema tests
test_derivation_review_valid_yaml
test_derivation_review_all_required_fields
test_literature_review_valid_yaml
test_merge_preserves_attribution

# Independence tests
test_member_a_b_prompts_isolated
test_merge_handles_contradictions

# Integration tests
test_full_cycle_on_sample_paper
```

**Artifacts:**
```
team/draft_YYYYMMDD_HHMMSS/
├── ... (P0 artifacts)
├── derivation_review_A.md
├── derivation_review_B.md
├── derivation_merged.md
├── literature_review_A.md
├── literature_review_B.md
├── literature_merged.md
├── writing_suggestions.md
└── action_items.md            # Prioritized, with line numbers
```

---

### P2: Capsule Contract Enforcement + Polish (Week 3)

**Scope:**
1. Capsule extraction and claim registry
2. Claim→body traceability checking
3. Profile-specific tuning
4. Documentation and examples

**Acceptance Criteria:**
- [ ] Capsule extraction identifies main claims from abstract/intro
- [ ] Each claim has unique ID and traceability to supporting content
- [ ] Capsule boundary violations flagged:
  - Derivation in abstract/intro → ERROR
  - Claim without body support → WARNING
  - Body result not in capsule → INFO (potential under-selling)
- [ ] Profile-specific behavior:
  - `theory_only`: Heavy derivation weight, light literature
  - `literature_review`: Heavy literature weight, light derivation
  - `mixed`: Balanced
- [ ] Documentation: skill file updated with draft-cycle examples
- [ ] Sample papers for testing (synthetic, covering edge cases)

**Regression Tests:**
```bash
# Capsule tests
test_capsule_extraction_finds_main_theorem
test_capsule_no_derivation_in_abstract
test_claim_body_traceability

# Profile tests
test_theory_only_skips_literature_depth
test_literature_review_skips_derivation_depth

# Documentation tests
test_skill_file_has_draft_cycle_section
test_sample_papers_all_pass
```

**Artifacts:**
```
team/draft_YYYYMMDD_HHMMSS/
├── ... (P0, P1 artifacts)
├── capsule_registry.md        # Claims with IDs
├── claim_traceability.md      # Claim → body support mapping
└── capsule_violations.md      # Boundary issues
```

---

## 4. Suggested Artifacts per Draft Cycle

### Directory Structure
```
team/
├── plan_draft_v1.md                    # Draft review plan (optional)
└── draft_20250614_143022/              # Timestamped cycle
    ├── input/
    │   ├── main.tex                    # Snapshot of input (or symlink)
    │   ├── references.bib
    │   └── manifest.txt                # List of included files
    │
    ├── preflight/
    │   ├── build_log.txt               # latexmk output
    │   ├── gate_results.json           # Pass/fail per gate
    │   └── preflight_report.md         # Human-readable summary
    │
    ├── extraction/
    │   ├── structure_map.json          # Sections, envs, labels
    │   ├── symbol_table.json           # Defined symbols
    │   ├── citation_graph.json         # Cite keys + locations
    │   └── capsule_registry.json       # Main claims
    │
    ├── reviews/
    │   ├── derivation/
    │   │   ├── review_A.md
    │   │   ├── review_B.md
    │   │   └── merged.md
    │   ├── literature/
    │   │   ├── review_A.md
    │   │   ├── review_B.md
    │   │   └── merged.md
    │   └── writing/
    │       └── suggestions.md
    │
    ├── traceability/
    │   ├── claim_support.md            # Claim → body mapping
    │   └── capsule_violations.md       # Boundary issues
    │
    └── summary/
        ├── action_items.md             # Prioritized, actionable
        └── cycle_meta.json             # Timing, token usage, etc.
```

### Artifact Contracts

**`preflight_report.md`:**
```markdown
# Draft Preflight Report
Generated: 2025-06-14 14:30:22

## Build Gate
Status: ✅ PASS | ❌ FAIL
Errors: N
Warnings: M (N critical)

## Reference Gate  
Status: ✅ PASS | ❌ FAIL
Undefined citations: [list]
Orphan labels: [list]

## Link Hygiene Gate
Status: ✅ PASS | ❌ FAIL
Backtick violations: [list with line numbers]
Missing KB entries: [list]

## Proceed to Review: YES | NO
```

**`action_items.md`:**
```markdown
# Action Items
Generated: 2025-06-14 14:45:00
Cycle: draft_20250614_143022

## High Priority
- [ ] **GAP-001** (derivation): Add intermediate step in Theorem 3.2 proof
  - Location: `proofs.tex:142`
  - Source: [A][B]
  
- [ ] **LIT-003** (literature): Cite Smith 2023 for widget bounds
  - Location: `intro.tex:28`
  - Source: [A]

## Medium Priority
...

## Low Priority / Suggestions
...
```

**`cycle_meta.json`:**
```json
{
  "cycle_id": "draft_20250614_143022",
  "input_files": ["main.tex", "references.bib"],
  "profile": "mixed",
  "timing": {
    "preflight_seconds": 12.3,
    "extraction_seconds": 4.5,
    "review_seconds": 180.2
  },
  "token_usage": {
    "derivation_A": 45000,
    "derivation_B": 42000,
    "literature_A": 38000,
    "literature_B": 36000,
    "writing": 25000
  },
  "gate_results": {
    "build": "pass",
    "refs": "pass", 
    "links": "fail"
  }
}
```

---

## 5. Implementation Notes

### Minimal TeX Extraction (P0)

```python
# Robust extraction without full parsing
import re

def extract_structure(tex_content: str) -> dict:
    """Extract structure without macro expansion."""
    
    # Sections (handles \section, \subsection, etc.)
    section_pattern = r'\\(section|subsection|subsubsection)\*?\{([^}]+)\}'
    
    # Environments (theorem, lemma, proof, etc.)
    env_pattern = r'\\begin\{(\w+)\}(?:\[([^\]]*)\])?.*?\\end\{\1\}'
    
    # Labels
    label_pattern = r'\\label\{([^}]+)\}'
    
    # Citations (handles \cite, \citep, \citet, etc.)
    cite_pattern = r'\\cite[pt]?\{([^}]+)\}'
    
    # References
    ref_pattern = r'\\(?:ref|eqref|cref|Cref)\{([^}]+)\}'
    
    # Extract and return structure
    # ... implementation details ...
```

### Gate Implementation (P0)

```bash
#!/bin/bash
# Gate 1: Build check
run_build_gate() {
    latexmk -pdf -interaction=nonstopmode "$1" 2>&1 | tee build.log
    if grep -q "^!" build.log; then
        echo "FAIL: LaTeX errors found"
        grep "^!" build.log
        return 1
    fi
    return 0
}

# Gate 2: Reference check
run_ref_gate() {
    # Check for undefined citations
    if grep -q "Citation .* undefined" "$1.log"; then
        echo "FAIL: Undefined citations"
        grep "Citation .* undefined" "$1.log"
        return 1
    fi
    # Check for undefined references
    if grep -q "Reference .* undefined" "$1.log"; then
        echo "FAIL: Undefined references"
        return 1
    fi
    return 0
}

# Gate 3: Link hygiene
run_link_gate() {
    # No backticks around citations
    if grep -qE '`[^`]+`.*\\cite|\\cite[^{]*\{[^}]+\}.*`' "$1"; then
        echo "FAIL: Backtick citation pattern found"
        return 1
    fi
    # KB linkage check
    for key in $(grep -oP '\\cite[pt]?\{\K[^}]+' "$1" | tr ',' '\n'); do
        if [[ ! -f "knowledge_base/literature/${key}.md" ]]; then
            echo "WARN: No KB entry for citation: $key"
        fi
    done
    return 0
}
```

### Review Prompt Template (P1)

```markdown
# Derivation Review Task

You are reviewing a LaTeX paper draft for derivation gaps.

## Input
- Full TeX source: [attached]
- Structure map: [attached]
- Symbol table: [attached]

## Your Task
Identify derivation issues:
1. **Skipped steps**: Where does a proof jump without justification?
2. **Undefined terms**: What symbols/concepts are used before definition?
3. **Missing assumptions**: What implicit assumptions are needed?
4. **Circular reasoning**: Does any argument depend on itself?

## Output Format (YAML)
```yaml
derivation_review:
  reviewer: "A" # or "B"
  gaps:
    - id: "GAP-001"
      location: "exact location in document"
      gap_type: "skipped_step|undefined_term|missing_assumption|circular_reasoning"
      description: "clear description of the issue"
      severity: "high|medium|low"
      suggested_fix: "how to address"
  symbol_issues:
    - id: "SYM-001"
      symbol: "the symbol"
      issue: "description"
      first_use_line: N
      definition_line: N or null
```

## Important
- Be specific about locations
- Distinguish "skipped but obvious" (low) from "skipped and critical" (high)
- Do not hallucinate line numbers; use descriptive locations if uncertain
```

---

This design provides a robust, staged approach to TeX draft checking that:
1. **Prioritizes determinism** where mechanical checking is possible
2. **Contains LLM work** within structured, replicable reviews
3. **Avoids parsing brittleness** through minimal extraction
4. **Maintains traceability** through comprehensive artifacts
5. **Fits existing workflows** via Member A/B independence and merge protocols
