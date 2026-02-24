# QA Audit: TeX Draft Checking Feature

## 1. QA Risks

### Critical Risks
- **Brittle TeX parsing**: Complex LaTeX documents have infinite edge cases (macros, packages, custom environments, multi-file setups)
- **Context explosion**: Full drafts + bibliography + figures can exceed LLM context windows
- **False negatives in deterministic checks**: Missing `\cite{}` due to custom citation commands, packages like `natbib`, `biblatex` variations
- **Dependency hell**: `pdflatex`, `bibtex`, `latexmk` availability and version skew across environments
- **Silent failures**: Draft checking continues even if toolchain missing, producing incomplete results
- **Traceability gaps**: Citations in draft ↔ KB literature notes linkage can break silently
- **Non-blocking violation**: Feature could block user workflow if checks fail ungracefully

### Medium Risks
- **Figure/table extraction**: No reliable cross-platform tool for extracting visuals from PDF without dependencies
- **Multi-file projects**: `\input{}`, `\include{}`, subfiles package complexity
- **Custom macros**: User-defined theorem environments, proof structures won't be recognized
- **Bibliography format diversity**: `.bib`, `.bbl`, embedded `thebibliography`, Zotero/Mendeley exports
- **Incremental updates**: Draft evolves; how to diff/track changes across check cycles?

### Low Risks
- **PDF unavailability**: Can fallback to `.tex` analysis only
- **Missing figures**: Non-blocking; flag but continue
- **Locale issues**: TeX distributions vary (TeX Live, MiKTeX, tectonic)

---

## 2. Minimal Viable Design (P0) + Tests

### P0 Scope: "Opinionated but Robust"

**Philosophy**: Assume **single-file `.tex` + `.bib`** with **standard commands**. Gracefully degrade when assumptions break.

#### Deterministic Gates (Must Pass)
1. **File presence**: `.tex` exists, readable UTF-8
2. **Syntax smoke test**: 
   - If `pdflatex` available → run `pdflatex -halt-on-error -interaction=nonstopmode draft.tex`
   - Parse exit code: `0` = pass, `>0` = compilation errors → **FAIL with log excerpt**
   - If toolchain missing → **WARN** and skip build check
3. **Citation coverage**:
   - Regex scan for `\cite{key1,key2}` (handle `natbib`, `biblatex` variations)
   - Extract cited keys → cross-check against `.bib` entries
   - **FAIL** if any `\cite{}` key missing from `.bib`
4. **Reference integrity**:
   - Scan for `\label{foo}` and `\ref{foo}`, `\eqref{foo}`
   - **WARN** if dangling refs (cited but not defined)
5. **KB linkage**:
   - Extract `.bib` keys → check for `knowledge_base/literature/<key>.md`
   - **WARN** (not fail) if <50% coverage
   - Generate clickable markdown: `See [literature/smith2020.md](../knowledge_base/literature/smith2020.md)`

#### LLM Review Outputs (Non-blocking)
1. **Derivation gaps** (Member A):
   - Extract `\begin{theorem}...\end{theorem}`, `\begin{proof}...\end{proof}` blocks (heuristic: look for common environments)
   - Send to LLM: "Check logical flow; flag missing steps, undefined notation"
   - Output: `team/draft_review_derivations.md`
2. **Literature positioning** (Member B):
   - Extract Introduction + Related Work sections (heuristic: `\section{Introduction}` → next `\section{}`)
   - Cross-check claims against KB literature notes
   - Output: `team/draft_review_literature.md`
3. **Writing clarity** (Member C, if enabled):
   - Full text → LLM suggestions for passive voice, vague claims, structure
   - Output: `team/draft_review_writing.md`

#### Interface
```bash
# New script: research-team/scripts/check_draft.sh
./scripts/check_draft.sh path/to/draft.tex [--bib path/to/refs.bib] [--strict]

# Flags:
#   --bib: explicit .bib file (else look for draft.bib in same dir)
#   --strict: treat WARNs as failures (for CI)
#   --skip-build: skip pdflatex (useful when toolchain unavailable)
#   --profile: mixed|theory_only|literature_review (reuses existing profiles)
```

**Outputs**:
```
team/draft_check/
  ├── deterministic_report.md      # Pass/fail gates
  ├── review_derivations.md        # Member A
  ├── review_literature.md         # Member B
  ├── review_writing.md            # Member C (if enabled)
  ├── citations_to_kb_map.json     # Traceability
  └── build.log                     # pdflatex output
```

#### Capsule Boundary
- **Capsule** (`capsule.md`): Add section "Draft Status"
  - Link to `team/draft_check/deterministic_report.md`
  - High-level summary: "3 citations need KB notes; 1 undefined ref; derivation review complete"
- **Body** (`team/`): Full review artifacts, logs, detailed findings

---

### P0 Acceptance Tests

```bash
# Test 1: Clean draft (all gates pass)
test_clean_draft() {
  # Fixture: valid single-file .tex + .bib, all refs defined, all cites in .bib
  ./scripts/check_draft.sh tests/fixtures/clean_draft.tex
  assert_exit_code 0
  assert_file_exists team/draft_check/deterministic_report.md
  assert_contains "✓ Compilation successful"
  assert_contains "✓ All citations found in .bib"
}

# Test 2: Missing citation in .bib → FAIL
test_missing_citation() {
  # Fixture: \cite{nonexistent}
  ./scripts/check_draft.sh tests/fixtures/bad_cite.tex
  assert_exit_code 1
  assert_contains "✗ Missing .bib entries: nonexistent"
}

# Test 3: Undefined reference → WARN (not fail)
test_dangling_ref() {
  ./scripts/check_draft.sh tests/fixtures/dangling_ref.tex
  assert_exit_code 0
  assert_contains "⚠ Undefined references: eq:missing"
}

# Test 4: No pdflatex → WARN and continue
test_no_toolchain() {
  PATH=/usr/bin ./scripts/check_draft.sh tests/fixtures/clean_draft.tex --skip-build
  assert_exit_code 0
  assert_contains "⚠ pdflatex not found; skipping build check"
}

# Test 5: KB linkage < 50% → WARN
test_low_kb_coverage() {
  # Fixture: 10 \cite{} keys, only 3 have KB notes
  ./scripts/check_draft.sh tests/fixtures/sparse_kb.tex
  assert_exit_code 0
  assert_contains "⚠ KB coverage: 30% (3/10 citations)"
  assert_file_contains team/draft_check/deterministic_report.md "literature/smith2020.md"
}

# Test 6: LLM review artifacts created
test_llm_reviews() {
  ./scripts/check_draft.sh tests/fixtures/clean_draft.tex --profile mixed
  assert_file_exists team/draft_check/review_derivations.md
  assert_file_exists team/draft_check/review_literature.md
  # Member C not in 'mixed' profile
  assert_file_not_exists team/draft_check/review_writing.md
}
```

---

## 3. Design Options (5 Concrete Proposals)

### Option 1: Standalone `check_draft.sh` (Recommended for P0)

**Interface**:
```bash
./scripts/check_draft.sh draft.tex --bib refs.bib --profile mixed
```

**Flow**:
1. Run deterministic gates (as described in P0)
2. If gates pass (or `--force`), invoke `run_team_cycle.sh` with special mode:
   ```bash
   DRAFT_MODE=1 ./run_team_cycle.sh \
     --query "Review draft at team/draft_check/draft.tex" \
     --profile mixed
   ```
3. Members A/B read `team/draft_check/draft.tex` + `deterministic_report.md` + KB
4. Output reviews to `team/draft_check/review_*.md`
5. Update `capsule.md` with summary + links

**Pros**:
- Clean separation: deterministic → LLM pipeline
- Reuses existing `run_team_cycle.sh` orchestration
- Easy to test gates independently
- Non-blocking by default (exit 0 unless `--strict`)

**Cons**:
- Two-step invocation feels clunky
- Draft isn't a "query" in the traditional sense (may confuse existing profiles)

**Failure Modes**:
- If `.tex` is huge, LLM context overflow → solution: chunking in P1
- If user forgets `--bib`, may not find citations → fallback: look for `<basename>.bib`

**Effort**: 3–5 days (1 day gates, 2 days integration, 2 days tests)

**Profile Fit**:
- `mixed`: A checks derivations, B checks literature
- `theory_only`: A+C check derivations deeply, skip B
- `literature_review`: B only, focus on citation positioning
- `toolkit_extraction`: Not applicable (skip)

---

### Option 2: Integrated "Draft Cycle" in `run_team_cycle.sh`

**Interface**:
```bash
./run_team_cycle.sh --mode draft --draft-file draft.tex --bib refs.bib
```

**Flow**:
1. Detect `--mode draft` → skip normal query loop
2. Run deterministic gates inline (before spawning members)
3. Spawn members with context: `TASK=draft_review`, `DRAFT_PATH=team/draft_check/draft.tex`
4. Members read draft, produce reviews
5. Single `capsule.md` update at end

**Pros**:
- Single entrypoint (no extra script)
- Unified orchestration (gates + LLM in one pass)
- Easier to track artifacts (all under `team/cycle_N/`)

**Cons**:
- Bloats `run_team_cycle.sh` (already complex)
- Harder to test gates independently
- "Mode flag" anti-pattern (violates single-responsibility)

**Failure Modes**:
- If gates fail mid-cycle, unclear how to roll back
- Error messages buried in orchestration logs

**Effort**: 4–6 days (refactor `run_team_cycle.sh`, add mode logic, tests)

**Profile Fit**: Same as Option 1, but harder to customize per-profile

---

### Option 3: Makefile-Based Pipeline

**Interface**:
```bash
make draft-check DRAFT=draft.tex BIB=refs.bib PROFILE=mixed
```

**Flow**:
1. `Makefile` targets:
   - `draft-lint`: Run deterministic gates (pdflatex, citation check, refs)
   - `draft-review`: Invoke LLM reviews (calls `run_team_cycle.sh`)
   - `draft-check`: Phony target → `draft-lint` + `draft-review`
2. Outputs cached; only re-run if `.tex` or `.bib` modified (Make dependency tracking)

**Pros**:
- Incremental builds (skip expensive LLM calls if draft unchanged)
- Familiar interface for LaTeX users
- Easy parallelization (`make -j4`)
- Clean artifact dependency graph

**Cons**:
- Adds Make as a required dependency
- Users unfamiliar with Make may struggle
- Harder to implement cross-platform (Windows Make variants)

**Failure Modes**:
- Stale `.tex` → Make cache doesn't detect changes (need `.PHONY` annotations)
- Parallel targets clobber shared files (need `.NOTPARALLEL` or locks)

**Effort**: 3–4 days (Makefile + integration)

**Profile Fit**: Best for `theory_only` (heavy iterative drafting); overkill for `literature_review`

---

### Option 4: Pre-commit Hook / CI Integration

**Interface**:
```bash
# User enables in .git/hooks/pre-commit
research-team draft-check --ci-mode draft.tex
```

**Flow**:
1. Git hook or CI runner calls `check_draft.sh --strict`
2. Deterministic gates **must pass** (exit 1 on failure)
3. LLM reviews optional (can skip in CI to save cost)
4. Output uploaded as artifact (GitHub Actions) or committed to `team/draft_check/`

**Pros**:
- Enforces quality gates before commit/push
- Deterministic checks run fast (seconds)
- Prevents broken drafts from merging

**Cons**:
- Blocking workflow (violates "non-blocking unless enabled" constraint)
- Requires `pdflatex` in CI environment (Docker image bloat)
- LLM reviews too slow for pre-commit (need async queue)

**Failure Modes**:
- User bypasses with `git commit --no-verify`
- CI LaTeX environment differs from local (version skew)

**Effort**: 2–3 days (assuming Option 1 exists)

**Profile Fit**: `mixed` in CI; `theory_only` for local pre-commit

---

### Option 5: Interactive TUI (Terminal UI)

**Interface**:
```bash
./scripts/draft_wizard.sh
# Prompts:
# 1) Select .tex file
# 2) Select .bib file (or auto-detect)
# 3) Choose profile (mixed, theory_only, etc.)
# 4) Run checks (show progress bar for gates)
# 5) Display results in scrollable pane
# 6) Option to re-run failed checks
```

**Flow**:
1. TUI built with `dialog` or `whiptail` (POSIX) or `gum` (modern)
2. User selects files interactively
3. Gates run with real-time progress updates
4. Results rendered in colored output (✓/✗/⚠)
5. Option to open reviews in `$EDITOR`

**Pros**:
- Best UX for exploratory use (non-experts)
- Clear feedback (no parsing logs)
- Can guide user to fix issues (e.g., "Add missing \label{}")

**Cons**:
- Not automatable (CI-unfriendly)
- Extra dependency (`gum`, `dialog`)
- Harder to test (UI logic)

**Failure Modes**:
- SSH/tmux rendering issues
- Users prefer CLI flags (TUI feels slow)

**Effort**: 5–7 days (UI framework + integration)

**Profile Fit**: Best for `literature_review` (less technical users); overkill for `toolkit_extraction`

---

## 4. Comparison Table

| Criteria                  | Option 1 (Standalone) | Option 2 (Integrated) | Option 3 (Makefile) | Option 4 (CI/Hook) | Option 5 (TUI) |
|---------------------------|-----------------------|-----------------------|---------------------|--------------------|----------------|
| **Ease of use**           | ★★★★☆                 | ★★★☆☆                 | ★★★☆☆               | ★★☆☆☆              | ★★★★★          |
| **Testability**           | ★★★★★                 | ★★★☆☆                 | ★★★★☆               | ★★★★☆              | ★★☆☆☆          |
| **Non-blocking**          | ★★★★★                 | ★★★★☆                 | ★★★★★               | ★☆☆☆☆              | ★★★★★          |
| **Incremental support**   | ★☆☆☆☆                 | ★☆☆☆☆                 | ★★★★★               | ★★★☆☆              | ★☆☆☆☆          |
| **CI-friendly**           | ★★★★★                 | ★★★★☆                 | ★★★★☆               | ★★★★★              | ★☆☆☆☆          |
| **Effort (days)**         | 3–5                   | 4–6                   | 3–4                 | 2–3                | 5–7            |
| **Capsule boundary**      | ✓ Clean               | ✓ Clean               | ✓ Clean             | ✓ Clean            | ✓ Clean        |
| **Profile compatibility** | ★★★★★                 | ★★★★★                 | ★★★☆☆               | ★★★★☆              | ★★★☆☆          |

---

## 5. Recommended Staged Rollout

### P0: Core Functionality (Option 1 + Minimal Tests)
**Timeline**: Sprint 1 (1 week)

**Deliverables**:
1. `scripts/check_draft.sh` with deterministic gates (file presence, pdflatex, citation/ref checks, KB linkage)
2. Integration with `run_team_cycle.sh` (draft mode flag)
3. Output structure: `team/draft_check/{deterministic_report, review_*.md}`
4. 6 acceptance tests (as listed in section 2)
5. Documentation: `docs/draft_checking.md` with examples

**Acceptance Criteria**:
- ✅ Single-file `.tex` + `.bib` works end-to-end
- ✅ Deterministic gates fail gracefully (exit 1 + clear error message)
- ✅ LLM reviews non-blocking (always exit 0 unless `--strict`)
- ✅ KB linkage produces clickable markdown paths
- ✅ No pdflatex → WARN (don't fail)
- ✅ All tests pass in CI (without LaTeX toolchain)

**Out of Scope**:
- Multi-file projects (`\input{}`)
- PDF extraction
- Custom macro recognition
- Incremental updates

---

### P1: Robustness + Multi-File Support
**Timeline**: Sprint 2 (1 week)

**Deliverables**:
1. Multi-file support: parse `\input{}`, `\include{}` → collect all `.tex` fragments
2. Chunking for large drafts (split by `\section{}` for LLM review)
3. PDF fallback: if `.tex` unavailable, extract text from PDF (`pdftotext`)
4. Custom environment detection: scan preamble for `\newtheorem`, `\newenvironment` → adapt parsing
5. Incremental mode: `--since-last-check` flag → only review changed sections (git diff-based)

**Acceptance Criteria**:
- ✅ 3-file project (`main.tex` + `intro.tex` + `proofs.tex`) works
- ✅ 50-page draft doesn't exceed LLM context (chunked reviews)
- ✅ PDF-only input produces reasonable review
- ✅ Incremental mode reduces cost (only changed sections reviewed)

**Tests**:
- Multi-file fixture
- 100-page stress test
- PDF-only fixture
- Git diff simulation

---

### P2: Polish + Advanced Features
**Timeline**: Sprint 3+ (backlog)

**Deliverables**:
1. **Option 3 (Makefile)**: For users who want incremental builds
2. **Option 4 (CI integration)**: GitHub Actions workflow template
3. **Figure/table extraction**: Use `pdfimages` + `pdftk` to extract visuals → LLM review
4. **Custom profile**: `draft_review` profile (A=derivations, B=literature, C=writing)
5. **Diff view**: Compare draft versions (`team/draft_check/v1/` vs `v2/`)
6. **Auto-fix suggestions**: Generate `.patch` files for simple issues (e.g., missing `\label{}`)

**Acceptance Criteria**:
- ✅ Makefile works for iterative drafting workflow
- ✅ CI template runs in <5 min (deterministic gates only)
- ✅ Figure extraction works for common formats (PNG, PDF, EPS)

---

## 6. Regression Test Strategy

### Unit Tests (Fast, No Dependencies)
```bash
# research-team/tests/unit/test_draft_gates.sh

test_citation_extraction() {
  # Mock .tex with \cite{a,b}, \citep{c}, \citet{d}
  result=$(extract_citations tests/fixtures/citations.tex)
  assert_equals "a b c d" "$result"
}

test_reference_extraction() {
  # Mock .tex with \label{eq:1}, \ref{eq:1}, \ref{eq:missing}
  result=$(find_dangling_refs tests/fixtures/refs.tex)
  assert_equals "eq:missing" "$result"
}

test_kb_linkage() {
  # Mock .bib with keys [smith2020, jones2021]
  # Mock KB with only smith2020.md
  result=$(check_kb_coverage tests/fixtures/refs.bib knowledge_base/literature/)
  assert_contains "50% coverage"
  assert_contains "literature/smith2020.md"
}
```

### Integration Tests (Require pdflatex)
```bash
# research-team/tests/integration/test_draft_build.sh

test_valid_latex_builds() {
  # Fixture: clean.tex compiles without errors
  ./scripts/check_draft.sh tests/fixtures/clean.tex
  assert_exit_code 0
  assert_file_exists team/draft_check/build.log
}

test_latex_error_caught() {
  # Fixture: syntax_error.tex has \begin{document} without \end{document}
  ./scripts/check_draft.sh tests/fixtures/syntax_error.tex
  assert_exit_code 1
  assert_contains "LaTeX compilation failed"
}

# Run only if pdflatex found
if command -v pdflatex >/dev/null; then
  test_valid_latex_builds
  test_latex_error_caught
else
  echo "⊘ Skipping integration tests (pdflatex not found)"
fi
```

### E2E Tests (Full Workflow)
```bash
# research-team/tests/e2e/test_draft_workflow.sh

test_full_review_cycle() {
  # Fixture: medium_draft.tex (5 pages, 10 citations, 3 theorems)
  ./scripts/check_draft.sh tests/fixtures/medium_draft.tex --profile mixed
  
  # Deterministic gates
  assert_file_exists team/draft_check/deterministic_report.md
  assert_contains "✓ Compilation successful"
  
  # LLM reviews
  assert_file_exists team/draft_check/review_derivations.md
  assert_file_exists team/draft_check/review_literature.md
  
  # Capsule updated
  assert_file_contains capsule.md "Draft Status"
  assert_file_contains capsule.md "team/draft_check/deterministic_report.md"
  
  # KB linkage clickable (no backticks)
  assert_not_contains team/draft_check/deterministic_report.md '`literature/'
}
```

---

## 7. Non-Blocking Safeguards

### Design Principles
1. **Default to WARN, not FAIL**: Only compilation errors and missing citations are hard failures (P0)
2. **Graceful degradation**: If `pdflatex` missing → skip build check, continue with text analysis
3. **Explicit opt-in for strictness**: `--strict` flag converts WARNs to FAILs (for CI)
4. **Clear exit codes**:
   - `0`: All checks passed (or warnings only)
   - `1`: Hard failure (compilation error, missing citation)
   - `2`: Toolchain missing (if `--require-toolchain` set)

### Implementation
```bash
# check_draft.sh

EXIT_CODE=0

# Gate 1: File presence
if [[ ! -f "$DRAFT_TEX" ]]; then
  echo "✗ Draft file not found: $DRAFT_TEX"
  exit 1
fi

# Gate 2: Compilation (soft by default)
if command -v pdflatex >/dev/null; then
  if ! pdflatex -halt-on-error "$DRAFT_TEX" &>/dev/null; then
    if [[ "$STRICT" == "1" ]]; then
      echo "✗ Compilation failed"
      exit 1
    else
      echo "⚠ Compilation failed (continuing in non-strict mode)"
      EXIT_CODE=0  # Still exit 0
    fi
  fi
else
  echo "⚠ pdflatex not found; skipping build check"
  [[ "$REQUIRE_TOOLCHAIN" == "1" ]] && exit 2
fi

# Gate 3: Citation coverage (hard fail)
MISSING_CITES=$(find_missing_citations "$DRAFT_TEX" "$BIB_FILE")
if [[ -n "$MISSING_CITES" ]]; then
  echo "✗ Missing .bib entries: $MISSING_CITES"
  exit 1
fi

# Gate 4: KB linkage (soft warn)
KB_COVERAGE=$(check_kb_coverage "$BIB_FILE" knowledge_base/literature/)
if [[ "$KB_COVERAGE" -lt 50 ]]; then
  echo "⚠ KB coverage: ${KB_COVERAGE}% (consider adding literature notes)"
fi

exit $EXIT_CODE
```

---

## 8. Summary & Recommendation

### Recommended Path: **Option 1 (Standalone) → P0 → P1 → P2**

**Why**:
- ✅ Fastest to implement and test
- ✅ Clean separation of concerns (gates vs reviews)
- ✅ Non-blocking by default, strict mode opt-in
- ✅ Reuses existing orchestration (`run_team_cycle.sh`)
- ✅ Easy to extend (P1: multi-file, P2: Makefile/CI)

**P0 Acceptance** (1 week):
- Single-file `.tex` + `.bib` workflow
- Deterministic gates: compilation, citations, refs, KB linkage
- LLM reviews: derivations (A), literature (B), optional writing (C)
- 6 unit + integration + E2E tests
- Non-blocking unless `--strict`

**P1 Extensions** (1 week):
- Multi-file support
- Chunking for large drafts
- PDF fallback
- Incremental mode

**P2 Enhancements** (backlog):
- Makefile pipeline (Option 3)
- CI/pre-commit (Option 4)
- Figure extraction
- Auto-fix patches

**Key Metrics**:
- **Coverage**: 80% of common LaTeX patterns (single-file, standard packages)
- **Speed**: Deterministic gates <5s; full LLM review <2 min (for 10-page draft)
- **Reliability**: 0 false positives on citation/ref checks (P0); <10% false negatives (P1)

---

## Appendix: Clickable KB Linkage (No Backticks)

### Bad (Breaks Traceability)
```markdown
Missing KB notes for citations: `smith2020`, `jones2021`
```

### Good (Clickable)
```markdown
Missing KB notes for citations:
- [smith2020](knowledge_base/literature/smith2020.md) ← create this
- [jones2021](knowledge_base/literature/jones2021.md) ← create this
```

### Implementation
```bash
# Generate clickable links
for cite_key in $MISSING_KB_NOTES; do
  echo "- [$cite_key](knowledge_base/literature/${cite_key}.md) ← create this"
done >> team/draft_check/deterministic_report.md
```

---

**Final Note**: All design options respect the capsule boundary (summary in `capsule.md`, details in `team/`). The deterministic gates prevent most common errors (broken builds, missing citations) while keeping LLM reviews as advisory outputs. This aligns with the "research-team spirit" of traceability and non-blocking iteration.
