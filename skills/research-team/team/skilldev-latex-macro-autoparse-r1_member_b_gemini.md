I have analyzed the options for handling LaTeX macro hygiene.

### 1) Verdict: Option B (with Strict Guardrails)

**Rationale:**
Option A (manual maintenance) scales poorly against the primary user workflow: extracting notes from source papers. The friction of manually auditing and adding macros encourages users to either disable the gate or tolerate broken rendering. Option B removes this toil.

However, since regex parsing of LaTeX is fragile, Option B must be implemented as a **conservative, additive layer**:
1.  **Precedence:** Explicit manual config > Discovered macros > Defaults.
2.  **Scope:** STRICTLY limited to **0-argument** macros (constants). Dynamic macros (1+ args) are too complex for safe text substitution without a full AST parser.
3.  **Visibility:** Discovered macros should be logged or dumpable (e.g., `make check-macros --verbose`) to debug "why did this expand?".

### 2) Pros and Cons

**Option A (Status Quo)**
*   **Pros:**
    *   **Absolute Determinism:** No runtime surprises; the config is the source of truth.
    *   **Simplicity:** No parsing logic to maintain or debug.
    *   **Safety:** No risk of bad expansions breaking standard LaTeX syntax.
*   **Cons:**
    *   **High Friction:** Users must context-switch to `config` files every time they paste a snippet with a new macro.
    *   **Incomplete:** Likely to lag behind actual usage, leading to "broken windows" (ignored errors).

**Option B (Auto-parsing)**
*   **Pros:**
    *   **Workflow Velocity:** Copy-pasting from `arxiv_src` "just works" for common notation shortcuts (e.g., `\be`, `\Mcal`).
    *   **Accuracy:** Expansions match the specific paper's definition, not a generic default.
*   **Cons:**
    *   **Parsing Complexity:** "Parsing HTML with Regex" risk. Comments, multi-line definitions, and complex `\def` syntax are failure points.
    *   **False Positive Risk:** A bad expansion can silently corrupt math (e.g., expanding `\r` meant for a specific variable into a command).

### 3) Edge Cases & Failure Modes

*   **Argument Count Detection Failure:**
    *   *Risk:* Parser mistakes a 1-arg macro (`\newcommand{\foo}[1]{...}`) for a 0-arg macro.
    *   *Result:* `\foo{x}` expands to `...{x}`, leaving a dangling brace or consuming the brace incorrectly.
*   **Prefix/Boundary Collisions:**
    *   *Risk:* Defining `\d` expands `\delta` to `(expansion)elta`.
    *   *Mitigation:* Expander must respect word boundaries (`\b` or equivalent logic for backslashes).
*   **Commented Definitions:**
    *   *Risk:* Parsing `source.tex`: `% \newcommand{\foo}{bad}`.
    *   *Result:* Expander activates a commented-out (possibly deprecated/broken) macro.
*   **Redefinitions (Scope):**
    *   *Risk:* Paper uses `\renewcommand{\vec}{\mathbf}`.
    *   *Result:* Expander overwrites standard LaTeX `\vec`, potentially breaking standard usage in other contexts if not carefully scoped.
*   **Nested Macros:**
    *   *Risk:* `\newcommand{\a}{\alpha}` and `\newcommand{\b}{\a + \beta}`.
    *   *Result:* Order of expansion matters. The system requires multipass expansion or topological sort to resolve `\b`.

### 4) Minimal Deterministic Test Plan

Create a fixture file `tests/fixtures/macro_extraction.tex` and a corresponding test case.

**Test Case 1: 0-Arg Detection (Success)**
*   **Input:** `\newcommand{\R}{\mathbb{R}}`
*   **Expect:** Map `{\R: \mathbb{R}}`
*   **Check:** Text `\R^2` becomes `\mathbb{R}^2`.

**Test Case 2: Argument Rejection (Safety)**
*   **Input:**
    ```latex
    \newcommand{\myvec}[1]{\mathbf{#1}}
    \def\simple{simple}
    ```
*   **Expect:** Map `{\simple: simple}` ONLY. `\myvec` must be ignored.

**Test Case 3: Comments & Formatting (Robustness)**
*   **Input:**
    ```latex
    % \newcommand{\ignoreme}{bad}
    \newcommand{\valid}{
       good
    }
    ```
*   **Expect:** Map `{\valid: good}` (stripped of newlines/trim). `\ignoreme` is absent.

**Test Case 4: Boundary Check**
*   **Input:** Definition `\newcommand{\d}{derivative}`
*   **Target:** `\delta \d`
*   **Expect:** `\delta derivative` (NOT `derivativeelta derivative`).
