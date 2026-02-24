# Audit Report: LaTeX Macro Handling Strategy

## 1. Recommendation: **Hybrid (B-lite + A-core)**

**Rationale:**
- **Option A alone** creates unsustainable maintenance burden and poor UX (every new paper = manual list updates).
- **Option B alone** risks silently accepting malformed/ambiguous macros and weakens deterministic guarantees.
- **Hybrid approach**: Use B as a **discovery + suggestion tool** (warn-only sidecar), while A remains the **enforcement layer** (fail-fast gate).

### Hybrid Architecture:
```
┌─────────────────────────────────────────────────┐
│ Gate (fail-fast, Option A)                      │
│ - Check against explicit forbidden list         │
│ - Expand using curated expansions config        │
└─────────────────────────────────────────────────┘
                    ↑
                    │ feeds
                    │
┌─────────────────────────────────────────────────┐
│ Discovery Tool (warn-only, Option B-lite)       │
│ - Parse local LaTeX sources (0-arg macros only) │
│ - Generate candidate expansions                 │
│ - Emit warnings for new macros in KB notes      │
│ - Suggest config additions (human approval)     │
└─────────────────────────────────────────────────┘
```

**What stays deterministic (A-core):**
- Gate continues to fail on macros not in `latex_macro_hygiene.expansions`
- Fixer uses only the explicit config mapping
- No auto-expansion without human review

**What becomes helper tooling (B-lite):**
- `scripts/bin/discover_latex_macros.py` scans `references/arxiv_src/**/*.tex`
- Outputs candidate additions to config (JSON/YAML fragment)
- Optionally integrated into `literature_fetch.py arxiv-source` as a post-download step
- Does **not** auto-modify config or KB notes

---

## 2. Implementation Pitfalls Checklist

### LaTeX Parsing Traps
- [ ] **Multi-line macro definitions** (TeX allows `\newcommand{...}{...}` split across lines with `%` comments)
- [ ] **Nested braces** (e.g., `\newcommand{\X}{{\mathbb{R}}}` requires brace-balanced parsing, not naive regex)
- [ ] **Conditional definitions** (e.g., `\providecommand` only defines if undefined; may appear multiple times)
- [ ] **`\def` ambiguity** (`\def\X{...}` can have parameter text: `\def\X#1{...}` is 1-arg, not 0-arg)
- [ ] **DeclareMathOperator variants** (`\DeclareMathOperator*` has starred form; expansion must distinguish `\operatorname` vs `\operatorname*`)
- [ ] **Include files** (`\input{macros.tex}`, `\include{defs}` require recursive traversal; watch for circular includes)
- [ ] **Encoding issues** (arXiv sources may use Latin-1, UTF-8, or mixed; Python default open may fail)

### Collision & False Positive Risks
- [ ] **Prefix false matches** (forbidden list `\re` must not block `\renewcommand`, `\ref`, `\regexp`; require word boundaries or backslash-name parsing)
- [ ] **Math operator overloading** (paper may define `\Re` as `\mathcal{R}` while stdlib has `\Re` as Fraktur; context-dependent)
- [ ] **Scoped definitions** (LaTeX `\begingroup...\endgroup` or environments may locally redefine macros; parser must ignore or warn)
- [ ] **Package-provided macros** (e.g., `\implies` from `amssymb`; don't treat as custom if standard package provides it)

### Maintenance & Drift Risks
- [ ] **Config bloat** (auto-discovered macros accumulate over time; need pruning strategy for unused entries)
- [ ] **Divergent expansions** (Paper A defines `\Rc` as `\mathbb{R}`, Paper B as `\mathcal{R}`; conflict resolution needed)
- [ ] **Stale arXiv sources** (downloaded sources may be outdated vs published version; macro definitions may change)
- [ ] **Non-determinism from filesystem order** (if parser scans multiple `.tex` files, order may affect which definition wins; must sort or merge deterministically)

### Workflow Integration Pitfalls
- [ ] **Non-blocking sidecar must not delay CI** (discovery tool should run async or in separate step, not block merge)
- [ ] **Human-in-loop approval bottleneck** (if every new paper requires manual config update, still creates friction; consider auto-approve for common patterns)
- [ ] **Config version skew** (developer updates config locally, but CI/gate uses stale version; need versioning/lock strategy)

---

## 3. Minimal Test Matrix

### Discovery Tool (B-lite) Tests
```python
# Input: LaTeX source samples
# Output: Extracted macro definitions (name, expansion, source file)

- [ ] **Basic newcommand** (0-arg): `\newcommand{\Rc}{\mathbb{R}}` → `{"Rc": "\\mathbb{R}"}`
- [ ] **renewcommand override**: Two files define `\Rc` differently → warn about conflict, emit both
- [ ] **Multi-line definition**: 
      ```
      \newcommand{\Foo}{%
        \mathbb{F}
      }
      ```
      → correctly extract `\mathbb{F}` (strip comments/whitespace)
- [ ] **Nested braces**: `\newcommand{\X}{{\mathcal{X}}}` → preserve inner braces
- [ ] **1-arg macro (reject)**: `\newcommand{\Foo}[1]{\mathbb{#1}}` → skip (not 0-arg)
- [ ] **`\def` 0-arg**: `\def\X{\mathbb{X}}` → extract (but warn if parameter text detected)
- [ ] **DeclareMathOperator**: `\DeclareMathOperator{\re}{Re}` → `{"re": "\\operatorname{Re}"}`
- [ ] **Standard macro collision**: `\renewcommand{\implies}{...}` → warn (conflicts with LaTeX kernel/amsmath)
- [ ] **Include file recursion**: `main.tex` includes `macros.tex` which defines `\Rc` → extract from both
- [ ] **Encoding edge case**: Latin-1 file with `\newcommand{\Ñ}{...}` → handle gracefully or skip with warning
- [ ] **Filesystem determinism**: Process 5 `.tex` files in random order → output always sorted by macro name
```

### Gate Integration (A-core) Tests
```python
# Input: Markdown + config (explicit expansions)
# Output: Pass/fail + deterministic fixes

- [ ] **Forbidden macro present**: `\\Rc` in Markdown, not in config → fail, suggest expansion
- [ ] **Forbidden macro in code fence**: 
      ```latex
      \Rc
      ```
      → pass (ignore fenced blocks)
- [ ] **Inline code span**: `` `\Rc` `` → pass (ignore inline code)
- [ ] **Expansion applied**: `\\Rc` in Markdown, config has `{"Rc": "\\mathbb{R}"}` → fixer replaces with `\\mathbb{R}`
- [ ] **Prefix collision guard**: Config forbids `\re`, Markdown has `\renewcommand` → pass (not a macro invocation)
- [ ] **Display math hazard**: Fixer produces `$$\nRe$$` at line start → separate gate catches this (out of scope here)
- [ ] **Idempotence**: Run fixer twice on same input → second run produces no changes
- [ ] **Unknown macro**: `\\NewMacro` appears, not in config → fail with actionable message ("run discovery tool or add to config")
```

### Conflict Resolution (Hybrid) Tests
```python
# Input: Discovered macros + existing config
# Output: Merge strategy

- [ ] **New macro, no conflict**: Discovery finds `\Mc`, config empty → suggest addition
- [ ] **Conflicting expansion**: Discovery finds `\Rc → \mathbb{R}`, config has `\Rc → \mathcal{R}` → warn, require human choice
- [ ] **Redundant discovery**: Discovery finds macro already in config with same expansion → silent skip
- [ ] **Package macro false alarm**: Discovery extracts `\implies` from paper (non-standard redefinition) → warn that it conflicts with standard LaTeX
```

---

## 4. Decision Rationale Details

### Why not pure Option B?
1. **Loss of determinism**: Auto-parsing introduces variability (different papers → different macro sets → non-reproducible failures).
2. **Silent weakening**: If gate auto-accepts discovered macros, a malformed/ambiguous macro could slip through (e.g., paper defines `\Re` inconsistently across sections).
3. **Trust boundary**: arXiv sources are untrusted inputs; direct expansion without review risks injecting broken LaTeX into KB.

### Why not pure Option A?
1. **UX friction**: Every new paper = manual config update = developer toil.
2. **Incompleteness**: Manual lists lag behind actual usage; users hit gate failures frequently.
3. **Knowledge loss**: We *have* the source LaTeX (via `arxiv-source`), but we ignore it; wasteful.

### Why Hybrid works:
- **Fail-safe defaults**: Gate remains strict (A-core), so we never silently break.
- **Progressive enhancement**: Discovery tool (B-lite) reduces toil by suggesting additions.
- **Human oversight**: Config updates require explicit approval (via PR or interactive prompt), maintaining trust boundary.
- **Incremental adoption**: Can deploy B-lite as optional tool first, collect feedback, then integrate into CI as warn-only sidecar.

---

## 5. Suggested Implementation Path

### Phase 1 (MVP, 2-3 days):
1. Write `discover_latex_macros.py`:
   - Scan `references/arxiv_src/**/*.tex`
   - Extract only `\newcommand{\X}{}` (0-arg, single-line)
   - Output JSON: `{"Rc": {"expansion": "\\mathbb{R}", "source": "references/arxiv_src/2301.12345/main.tex"}}`
2. Add test suite (10 cases from matrix above)
3. Run manually, validate output, add 3-5 macros to config

### Phase 2 (Integrate, 1-2 days):
4. Hook into `literature_fetch.py arxiv-source` as post-download step
5. Emit warnings if discovered macros conflict with config
6. Add `--suggest-config` flag to output YAML fragment for manual merge

### Phase 3 (Harden, 2-3 days):
7. Handle multi-line definitions (regex → proper lexer)
8. Add `\renewcommand`, `\DeclareMathOperator` support
9. Implement deterministic conflict resolution (first-wins + warn)
10. Add recursive `\input` traversal (with cycle detection)

### Phase 4 (Optional, future):
11. Auto-detect standard package macros (parse `\usepackage` lines, cross-check against known packages)
12. Interactive approval tool (CLI prompt: "Add \Rc → \mathbb{R} to config? [y/n]")

---

## 6. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Parser bugs introduce false macros** | Test matrix + human approval gate; discovery is warn-only |
| **Config bloat over time** | Periodic audit: remove unused macros (grep KB for invocations) |
| **Divergent expansions across papers** | Discovery tool warns on conflicts; human chooses canonical form |
| **Non-blocking sidecar ignored** | Make discovery warnings visible in PR checks (fail CI if conflicts detected, but allow override) |
| **Encoding crashes** | Wrap file reads in try-except, log skipped files, default to UTF-8 with fallback |

---

**Final verdict**: Proceed with **Hybrid (B-lite + A-core)**. Implement Phase 1 MVP first (1-2 sprints), validate with real arXiv sources, then decide on Phase 2-4 based on observed friction.
