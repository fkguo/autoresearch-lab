No external tools available—proceeding with deep analysis based on the provided specification and first-principles reasoning about deterministic gates, parser correctness, and failure modes.

---

# LaTeX Macro Hygiene Gate: Option A vs B Analysis

## 1) Verdict: **Hybrid (A+B)** 

**Rationale:** Use Option B's auto-parsing as an *offline tooling layer* to propose expansions, but keep Option A's explicit allowlist/blocklist as the *authoritative gate contract*—ensuring determinism while reducing manual drift.

---

## 2) Pros/Cons Table

### Option A: Explicit List (Status Quo)

| Aspect | Pros | Cons |
|--------|------|------|
| **Determinism** | ✅ Fully deterministic; config is the single source of truth | — |
| **Auditability** | ✅ Easy to review diffs; every macro is explicitly approved | — |
| **Fail-fast** | ✅ Unknown macros fail immediately | — |
| **Maintenance** | — | ❌ Manual one-by-one additions; drift risk as papers accumulate |
| **Onboarding** | — | ❌ New papers with 20+ custom macros create friction |
| **Coverage** | — | ❌ Reactive, not proactive; always playing catch-up |
| **Prefix collisions** | ✅ Human reviewer catches `\re` vs `\ref` issues | — |

### Option B: Auto-Parse from LaTeX Sources

| Aspect | Pros | Cons |
|--------|------|------|
| **Coverage** | ✅ Automatic discovery; scales with corpus | — |
| **Maintenance** | ✅ Reduced manual work; macros from new papers auto-available | — |
| **Onboarding** | ✅ `arxiv-source` fetch → expansions ready immediately | — |
| **Determinism** | ⚠️ Deterministic *if* sources are pinned, but hidden dependency on file order/presence | ❌ Source file changes silently alter gate behavior |
| **Auditability** | — | ❌ Harder to review; "why did this macro expand this way?" requires tracing back to `.tex` |
| **Parser correctness** | — | ❌ LaTeX parsing is Turing-complete; edge cases abound (`\def` with delimited args, catcode changes, conditionals) |
| **Fail-fast** | — | ❌ May silently accept bad expansions if parser misreads definition |
| **Prefix collisions** | — | ❌ Auto-extracted `\re` would still collide with `\ref`; parser doesn't understand semantic context |
| **Trust boundary** | — | ❌ ArXiv sources are untrusted; malformed/malicious `.tex` could inject bad expansions |

### Hybrid (A+B): Explicit Gate + Auto-Parse Tooling

| Aspect | Pros | Cons |
|--------|------|------|
| **Determinism** | ✅ Gate uses only explicit config (A); parsing is separate | — |
| **Auditability** | ✅ Config diffs remain reviewable; tooling output is proposal only | — |
| **Fail-fast** | ✅ Unknown macros fail until explicitly added | — |
| **Coverage** | ✅ Auto-parser discovers macros; human approves into config | — |
| **Maintenance** | ✅ Batch proposals reduce friction; human review prevents drift | ⚠️ Still requires human approval step |
| **Prefix collisions** | ✅ Human review catches collisions; tooling can warn but not auto-approve | — |
| **Complexity** | — | ⚠️ Two systems to maintain (parser + config) |

---

## 3) Risk Register: Top 5 Risks + Mitigations

| # | Risk | Severity | Likelihood | Mitigation |
|---|------|----------|------------|------------|
| **R1** | **Prefix collision false positives**: `\re` in forbidden list matches `\ref`, `\real`, `\renewcommand` | High | High | Gate must use **word-boundary matching**: regex `\\re(?![a-zA-Z])` or token-based parsing. Explicit test coverage for `\ref`, `\implies`, `\renewcommand`. |
| **R2** | **Non-determinism from file discovery order**: Auto-parser reads `.tex` files in glob order; different machines/filesystems yield different results | High | Medium | If implementing B: Sort file list lexicographically. Pin to explicit manifest. **Hybrid avoids this**: config is canonical. |
| **R3** | **Parser misinterprets complex macro definitions**: `\def\foo#1#2{...}` misread as 0-arg; conditional `\newcommand` inside `\ifx` blocks | Medium | High | Restrict parser to simple patterns only. Flag uncertain parses for human review. Never auto-approve; only propose. |
| **R4** | **Silent gate weakening via config bloat**: Over time, expansions accumulate; some may be wrong/stale | Medium | Medium | Periodic audit of `expansions` config. Add `source_paper` annotation to each expansion for traceability. |
| **R5** | **Untrusted source injection**: Malicious or malformed arXiv `.tex` causes parser to emit dangerous expansions | Medium | Low | Parser output is **proposal only**; human must approve. Sandbox parser (no code execution). Validate expansion syntax before accepting. |

---

## 4) Gate Contract: What MUST Remain True

The following invariants are **non-negotiable** for the macro hygiene gate:

- [ ] **Determinism**: Given identical inputs (Markdown files + config), the gate MUST produce identical pass/fail results. No ambient state (network, timestamps, random).

- [ ] **Fail-fast on unknown macros**: Any macro matching forbidden patterns that is NOT in `expansions` MUST fail the gate. Warn-only is NOT acceptable for unknown macros in gated paths.

- [ ] **Prefix-safe matching**: Forbidden macro `\foo` MUST NOT match `\foobar`, `\footnote`, etc. Implementation MUST use word-boundary or tokenized matching.

- [ ] **Code block exclusion**: Macros inside fenced code blocks (` ``` `) or inline code spans (`` ` ``) MUST be ignored by the gate.

- [ ] **Expansion correctness**: If a macro is auto-expanded by the fixer, the expansion MUST be syntactically valid for MathJax/KaTeX rendering. The gate SHOULD validate expansion syntax.

- [ ] **Config is canonical**: The `latex_macro_hygiene.expansions` config is the **single source of truth**. Auto-parsing MUST NOT directly modify gate behavior; it MAY propose additions.

- [ ] **Clickability preservation**: Fixer MUST NOT alter content outside math delimiters in ways that break link syntax or introduce rendering hazards.

- [ ] **Idempotency**: Running the fixer twice on the same file MUST produce identical output.

---

## 5) Implementation Sketch: Minimal Deterministic Approach

### Architecture (Hybrid)

```
┌─────────────────────────────────────────────────────────────────┐
│                        TOOLING LAYER (Optional)                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  scripts/bin/propose_macro_expansions.py                  │   │
│  │  - Scans references/arxiv_src/**/*.tex                    │   │
│  │  - Extracts 0-arg macro definitions                       │   │
│  │  - Outputs YAML/JSON proposal for human review            │   │
│  │  - WARN-ONLY; does not modify config                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │ (human reviews, approves)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CONFIG (Authoritative)                    │
│  latex_macro_hygiene:                                            │
│    forbidden_macros:    # patterns that must not appear raw     │
│      - "\\Rc"                                                    │
│      - "\\Mc"                                                    │
│      - "\\re"           # careful: word-boundary enforced       │
│    expansions:          # approved expansions                   │
│      "\\Rc": "\\mathcal{R}"                                      │
│      "\\Mc": "\\mathcal{M}"                                      │
│      "\\re": "\\operatorname{Re}"                                │
│    expansion_sources:   # traceability (optional)               │
│      "\\Rc": "arxiv:2301.12345"                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        GATE LAYER (Fail-Fast)                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  scripts/gates/check_markdown_latex_macro_hygiene.py      │   │
│  │  - Loads config (forbidden_macros, expansions)            │   │
│  │  - Parses Markdown, skipping code blocks                  │   │
│  │  - For each forbidden macro (word-boundary match):        │   │
│  │    - If in expansions → record (fixer can handle)         │   │
│  │    - If NOT in expansions → FAIL gate                     │   │
│  │  - DETERMINISTIC; no file discovery beyond target paths   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  scripts/bin/fix_markdown_latex_macros.py                 │   │
│  │  - Applies expansions from config                         │   │
│  │  - Idempotent                                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Core Matching Algorithm (Prefix-Safe)

```python
import re
from typing import Dict, List, Tuple

def build_macro_pattern(macros: List[str]) -> re.Pattern:
    """
    Build regex that matches macros with word boundaries.
    \re should NOT match \ref, \real, \renewcommand.
    """
    # Escape backslashes for regex, then add negative lookahead for letters
    escaped = [re.escape(m) for m in macros]
    # Pattern: match macro NOT followed by [a-zA-Z]
    # This handles: \re followed by space, digit, punctuation, or end
    pattern = r'(?:' + '|'.join(escaped) + r')(?![a-zA-Z])'
    return re.compile(pattern)

def find_macros_outside_code(content: str, pattern: re.Pattern) -> List[Tuple[int, str]]:
    """
    Find all macro matches outside fenced code blocks and inline code.
    Returns list of (line_number, matched_macro).
    """
    # Step 1: Mask out code blocks and inline code
    masked = mask_code_regions(content)
    
    # Step 2: Find matches in masked content
    matches = []
    for i, line in enumerate(masked.split('\n'), 1):
        for match in pattern.finditer(line):
            matches.append((i, match.group()))
    return matches

def mask_code_regions(content: str) -> str:
    """Replace code regions with spaces (preserving positions)."""
    # Fenced code blocks: ```...```
    content = re.sub(r'```[\s\S]*?```', lambda m: ' ' * len(m.group()), content)
    # Inline code: `...` (non-greedy, single line)
    content = re.sub(r'`[^`\n]+`', lambda m: ' ' * len(m.group()), content)
    return content
```

### Edge Cases Handled

| Edge Case | Handling |
|-----------|----------|
| `\ref{fig:1}` with forbidden `\re` | Negative lookahead `(?![a-zA-Z])` prevents match |
| `\implies` with forbidden `\im` | Same: `\im` pattern won't match `\implies` |
| `\renewcommand` with forbidden `\re` | Same: `\re` followed by `n` doesn't match |
| Macro at end of line: `$\re$` | Matches correctly (followed by `$`, not letter) |
| Macro in code: `` `\re` `` | Masked out; not matched |
| Macro in fenced block | Masked out; not matched |
| Nested math in link: `[text]($x$)` | Math delimiters preserved; fixer operates inside math only |
| `\re` inside `\operatorname{Re}` (post-fix) | Fixer must not re-expand; idempotency check |

### Proposal Tooling (Warn-Only)

```python
# scripts/bin/propose_macro_expansions.py

import re
from pathlib import Path

MACRO_DEF_PATTERNS = [
    # \newcommand{\foo}{expansion} - 0-arg only
    r'\\newcommand\s*\{\\([a-zA-Z]+)\}\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}',
    # \renewcommand{\foo}{expansion}
    r'\\renewcommand\s*\{\\([a-zA-Z]+)\}\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}',
    # \DeclareMathOperator{\foo}{Bar} → \operatorname{Bar}
    r'\\DeclareMathOperator\*?\s*\{\\([a-zA-Z]+)\}\s*\{([^{}]+)\}',
]

def extract_zero_arg_macros(tex_content: str) -> dict:
    """Extract 0-argument macro definitions. Conservative: skip anything with #1, #2, etc."""
    macros = {}
    for pattern in MACRO_DEF_PATTERNS:
        for match in re.finditer(pattern, tex_content):
            name, expansion = match.groups()
            # Skip if expansion contains argument placeholders
            if '#' in expansion:
                continue
            # Normalize DeclareMathOperator
            if 'DeclareMathOperator' in pattern:
                expansion = f'\\operatorname{{{expansion}}}'
            macros[f'\\{name}'] = expansion
    return macros

def propose_for_review(source_dir: Path) -> dict:
    """Scan all .tex files, return proposed expansions."""
    proposals = {}
    # DETERMINISM: sort files lexicographically
    for tex_file in sorted(source_dir.rglob('*.tex')):
        content = tex_file.read_text(errors='ignore')
        extracted = extract_zero_arg_macros(content)
        for macro, expansion in extracted.items():
            if macro not in proposals:
                proposals[macro] = {
                    'expansion': expansion,
                    'source': str(tex_file.relative_to(source_dir)),
                }
    return proposals

# Output: YAML proposal for human review
# Human approves → adds to config → gate uses config
```

---

## 6) Regression Tests: Minimum Set

### Gate Correctness Tests

```python
# tests/test_latex_macro_hygiene_gate.py

import pytest
from scripts.gates.check_markdown_latex_macro_hygiene import (
    build_macro_pattern, find_macros_outside_code, check_file
)

class TestPrefixCollisions:
    """CRITICAL: Ensure no false positives from prefix matching."""
    
    @pytest.mark.parametrize("content,forbidden,should_match", [
        # \re should NOT match \ref
        (r"See \ref{fig:1}", ["\\re"], False),
        # \re should NOT match \real
        (r"$\real$", ["\\re"], False),
        # \re should NOT match \renewcommand
        (r"\renewcommand{\foo}{bar}", ["\\re"], False),
        # \re SHOULD match standalone \re
        (r"$\re(z)$", ["\\re"], True),
        # \re SHOULD match \re followed by non-letter
        (r"$\re + \im$", ["\\re"], True),
        # \im should NOT match \implies
        (r"$A \implies B$", ["\\im"], False),
        # \im should NOT match \imaginary
        (r"$\imaginary$", ["\\im"], False),
        # \im SHOULD match standalone
        (r"$\im(z)$", ["\\im"], True),
    ])
    def test_prefix_safety(self, content, forbidden, should_match):
        pattern = build_macro_pattern(forbidden)
        matches = find_macros_outside_code(content, pattern)
        assert bool(matches) == should_match

class TestCodeBlockExclusion:
    """Macros in code blocks must be ignored."""
    
    def test_fenced_code_block_ignored(self):
        content = "```latex\n\\Rc\n```"
        pattern = build_macro_pattern(["\\Rc"])
        assert find_macros_outside_code(content, pattern) == []
    
    def test_inline_code_ignored(self):
        content = "Use `\\Rc` for the set."
        pattern = build_macro_pattern(["\\Rc"])
        assert find_macros_outside_code(content, pattern) == []
    
    def test_macro_outside_code_found(self):
        content = "We have $\\Rc$ and `\\Rc` here."
        pattern = build_macro_pattern(["\\Rc"])
        matches = find_macros_outside_code(content, pattern)
        assert len(matches) == 1  # Only the one outside backticks

class TestDeterminism:
    """Gate must be deterministic."""
    
    def test_same_input_same_output(self, tmp_path):
        md_file = tmp_path / "test.md"
        md_file.write_text(r"$\Rc$")
        config = {"forbidden_macros": ["\\Rc"], "expansions": {}}
        
        result1 = check_file(md_file, config)
        result2 = check_file(md_file, config)
        assert result1 == result2
    
    def test_order_independence(self):
        """Forbidden list order shouldn't affect results."""
        content = r"$\Rc + \Mc$"
        pattern1 = build_macro_pattern(["\\Rc", "\\Mc"])
        pattern2 = build_macro_pattern(["\\Mc", "\\Rc"])
        
        matches1 = set(m[1] for m in find_macros_outside_code(content, pattern1))
        matches2 = set(m[1] for m in find_macros_outside_code(content, pattern2))
        assert matches1 == matches2

class TestFailFast:
    """Unknown macros must fail the gate."""
    
    def test_unknown_macro_fails(self, tmp_path):
        md_file = tmp_path / "test.md"
        md_file.write_text(r"$\UnknownMacro$")
        config = {
            "forbidden_macros": ["\\UnknownMacro"],
            "expansions": {}  # No expansion provided
        }
        
        result = check_file(md_file, config)
        assert result.passed == False
        assert "UnknownMacro" in result.error_message
    
    def test_known_macro_with_expansion_passes(self, tmp_path):
        md_file = tmp_path / "test.md"
        md_file.write_text(r"$\Rc$")
        config = {
            "forbidden_macros": ["\\Rc"],
            "expansions": {"\\Rc": "\\mathcal{R}"}
        }
        
        # Gate passes because expansion exists (fixer can handle it)
        # OR gate still fails but fixer can fix it - clarify semantics
        # Recommended: gate WARNS if expansion exists, FAILS if not
        result = check_file(md_file, config)
        assert result.passed == True  # Expansion available

class TestFixerIdempotency:
    """Fixer must be idempotent."""
    
    def test_double_fix_idempotent(self, tmp_path):
        md_file = tmp_path / "test.md"
        md_file.write_text(r"$\Rc$")
        config = {"expansions": {"\\Rc": "\\mathcal{R}"}}
        
        fix_file(md_file, config)
        content_after_first = md_file.read_text()
        
        fix_file(md_file, config)
        content_after_second = md_file.read_text()
        
        assert content_after_first == content_after_second
        assert r"\mathcal{R}" in content_after_second
        assert r"\Rc" not in content_after_second
```

### Proposal Tooling Tests (Warn-Only Layer)

```python
# tests/test_propose_macro_expansions.py

class TestMacroExtraction:
    """Test 0-arg macro extraction from LaTeX sources."""
    
    def test_newcommand_zero_arg(self):
        tex = r"\newcommand{\Rc}{\mathcal{R}}"
        result = extract_zero_arg_macros(tex)
        assert result == {"\\Rc": "\\mathcal{R}"}
    
    def test_newcommand_with_args_skipped(self):
        tex = r"\newcommand{\foo}[2]{#1 + #2}"
        result = extract_zero_arg_macros(tex)
        assert result == {}  # Has arguments, skipped
    
    def test_declare_math_operator(self):
        tex = r"\DeclareMathOperator{\re}{Re}"
        result = extract_zero_arg_macros(tex)
        assert result == {"\\re": "\\operatorname{Re}"}
    
    def test_proposal_is_deterministic(self, tmp_path):
        """File order must not affect proposals."""
        (tmp_path / "b.tex").write_text(r"\newcommand{\foo}{bar}")
        (tmp_path / "a.tex").write_text(r"\newcommand{\baz}{qux}")
        
        result1 = propose_for_review(tmp_path)
        result2 = propose_for_review(tmp_path)
        
        assert result1 == result2
```

### Integration Tests

```python
# tests/integration/test_macro_hygiene_workflow.py

class TestEndToEndWorkflow:
    """Full workflow integration tests."""
    
    def test_new_paper_workflow(self, tmp_path):
        """
        Scenario: User fetches new arXiv paper with custom macros.
        Expected: Gate fails → user runs proposal tool → reviews →
                  approves into config → runs fixer → gate passes.
        """
        # Setup: paper source with custom macro
        src_dir = tmp_path / "references/arxiv_src/2301.12345"
        src_dir.mkdir(parents=True)
        (src_dir / "main.tex").write_text(r"\newcommand{\Rc}{\mathcal{R}}")
        
        # Setup: KB note using the macro
        kb_dir = tmp_path / "knowledge_base"
        kb_dir.mkdir()
        note = kb_dir / "note.md"
        note.write_text("# Note\n\n$\\Rc$ is important.")
        
        # Initial config: no expansions
        config = {"forbidden_macros": ["\\Rc"], "expansions": {}}
        
        # Step 1: Gate fails
        result = run_gate(note, config)
        assert result.passed == False
        
        # Step 2: Proposal tool suggests expansion
        proposals = propose_for_review(src_dir.parent)
        assert "\\Rc" in proposals
        
        # Step 3: Human approves (simulated)
        config["expansions"]["\\Rc"] = proposals["\\Rc"]["expansion"]
        
        # Step 4: Fixer expands
        fix_file(note, config)
        
        # Step 5: Gate passes
        result = run_gate(note, config)
        assert result.passed == True
        assert "\\mathcal{R}" in note.read_text()
```

---

## Summary

| Component | Behavior | Rationale |
|-----------|----------|-----------|
| **Gate** (`check_markdown_latex_macro_hygiene.py`) | **Fail-fast** on unknown macros; uses explicit config only | Determinism, auditability, trust |
| **Fixer** (`fix_markdown_latex_macros.py`) | Applies config expansions; idempotent | Automation with human-approved mappings |
| **Proposal tool** (`propose_macro_expansions.py`) | **Warn-only**; outputs suggestions for human review | Reduces manual discovery; doesn't weaken gate |
| **Config** (`latex_macro_hygiene.expansions`) | Single source of truth; version-controlled | Reviewable, traceable, deterministic |

The Hybrid approach gives you the ergonomic benefits of auto-discovery (Option B) while preserving the deterministic, auditable gate semantics of Option A. The key insight is that **parsing untrusted sources should inform but never control** the gate contract.
