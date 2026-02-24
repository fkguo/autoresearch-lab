I will read the prompt and the skill definition to understand the requirements for the TeX draft checking capability.
Here are the design options for adding "TeX draft checking" to the research-team skill, adhering to the independent reviewer architecture and strict capsule boundary.

# TeX Draft Checking: Design Options

## Option 1: The "Paper Milestone" (Integrated Cycle)
Integrate draft checking directly into `run_team_cycle.sh` as a specific **Milestone Kind**. When a milestone is tagged as `kind: paper_draft`, the cycle shifts focus from "derivation verification" to "draft verification".

*   **Workflow:**
    1.  User sets `Milestone kind: paper_draft` in the Capsule (or passes `--mode writing`).
    2.  User provides a `main.tex` path in the Capsule or CLI.
    3.  **Preflight (Deterministic):**
        *   `tex_flattener`: Flattens `\input` / `\include` into a single text stream (Python script, regex-based, no external deps).
        *   `bib_checker`: Verifies every `\cite{X}` in TeX exists in `.bib`.
        *   `ref_checker`: Scans for `??` (undefined references) or duplicate labels.
        *   `figure_audit`: Checks that file paths in `\includegraphics{...}` exist on disk.
    4.  **Team Packet Construction:** Instead of just `Draft_Derivation.md`, the packet includes:
        *   The **Internal Truth**: `Draft_Derivation.md` (Derivations + Capsule).
        *   The **External Draft**: The flattened `.tex` content (clean text extraction).
    5.  **LLM Review:** Member A and B receive a "Reviewer" system prompt focused on:
        *   **Consistency:** "Does Eq (5) in TeX match the logic in Notebook Section 3?"
        *   **Gaps:** "Are steps skipped in the TeX that are crucial for understanding?"
        *   **Literature:** "Are claims in the Intro supported by citations in the `.bib`?"

*   **Pros:** Strongest adherence to "Team" ethos; enforces consistency between Lab Notebook (Markdown) and Paper (TeX). Uses existing infrastructure.
*   **Cons:** High context usage (Notebook + TeX). Requires robust "flattening" logic.
*   **Fit:** Best for `theory_numerics` and `mixed`.

## Option 2: The "Sidecar Auditor" (Parallel Workflow)
A separate script `run_draft_review.sh` that runs *alongside* the main research cycle, producing its own artifact trail in `team/drafts/`.

*   **Workflow:**
    1.  Script `scripts/bin/run_draft_review.sh --tex main.tex --bib references.bib`.
    2.  **Extraction:** Converts TeX to a "Review-friendly" Markdown format (using `pandoc` or `docling` if available, falling back to regex extraction) to isolate text/math.
    3.  **Gate:** `tex_hygiene_gate` (checks for hardcoded numbers vs macros, ensures citations resolve).
    4.  **Review:** Spawns a dedicated Agent (Member C or a generic "Reviewer") to critique the text against specific criteria (Flow, Clarity, Prior Work).
    5.  **Output:** Generates `team/drafts/review_<date>.md` with a structured "Referee Report".

*   **Pros:** Decoupled; doesn't clutter the main "scientific convergence" cycle. Can be run more frequently/cheaply on specific sections.
*   **Cons:** Disconnected from the "Ground Truth" of the derivation notebook. Risk of drift between Paper and Code.
*   **Fit:** Good for `literature_review` or late-stage `writing` profiles.

## Option 3: The "Evidence Injection" (TeX as Evidence)
Treat the TeX draft purely as an **Evidence Artifact** referenced in the `Draft_Derivation.md`.

*   **Workflow:**
    1.  In `Draft_Derivation.md`, user adds a section `## Draft Status` pointing to `docs/paper.tex`.
    2.  **Gate:** `evidence_manifest_gate` verifies the TeX file compiles.
    3.  **Traceability:** The system extracts specific "Claims" from the TeX (e.g., Abstract, Conclusion) and injects them into the Team Packet as "Claims to Verify".
    4.  **Cycle:** Member A/B are asked to "Verify the claims in the Draft Abstract against the Derivations in this Notebook".

*   **Pros:** Keeps `Draft_Derivation.md` as the absolute center of the universe. Low token overhead (only checking specific parts).
*   **Cons:** Misses "flow" and "narrative" checks. Hard to check "line-by-line" derivation steps in the TeX itself.
*   **Fit:** `theory_only` or `toolkit_extraction`.

---

# Recommendation: Option 1 (The "Paper Milestone")

**Why:** It best preserves the "Capsule Boundary" by treating the TeX draft as a *projection* of the work, which must be consistent with the *source* (the Notebook/Capsule). It utilizes the existing dual-member verification power to catch "hallucinations" in the paper that don't exist in the code/derivation.

## Risks & Loopholes
1.  **TeX Parsing Fragility:** `\newcommand` and heavy macro usage can confuse LLMs. **Mitigation:** A "Macro Expansion" pre-pass (using a robust Python script `discover_latex_zero_arg_macros.py` logic extended to the draft) before context injection.
2.  **Context Window:** A full thesis `.tex` + `Draft_Derivation.md` will blow up context. **Mitigation:** "Sectional Review". Allow user to pass `--section "Introduction"` or `--lines 1-500`.
3.  **Gate Overreach:** Preventing cycle completion because of a typo in the `.bib` file feels bad. **Mitigation:** "Warn-only" mode for stylistic gates; "Fail" only for broken compilation or missing citations.

## Staged Rollout

### P0: Ingestion & compilation Check
*   Add `--tex-draft <path>` to `run_team_cycle.sh`.
*   Implement `tex_flattener.py` (resolves `\input`).
*   Implement `tex_compilation_gate` (runs `pdflatex` or `latexmk` in sandbox/temp, confirms success).
*   **Acceptance:** `run_team_cycle.sh` accepts a TeX file, compiles it, and if it fails, the cycle aborts.

### P1: Consistency Review (LLM)
*   Update `build_team_packet.py` to include the flattened TeX content (truncated to N tokens).
*   Add `prompts/_system_draft_reviewer.txt` (specialized instruction for Member A/B).
*   **Acceptance:** Member A/B produce a "Draft vs Notebook" consistency report in `team/`.

### P2: Advanced Gates
*   `bib_coverage_gate`: Ensure all `\cite` keys exist in `.bib`.
*   `local_link_gate`: Ensure `\ref` targets exist.
*   **Acceptance:** A draft with missing bib entries fails the preflight.

---

# Suggested Regression Tests

1.  **Smoke Test - Valid Draft:**
    *   Input: A simple `main.tex` that compiles, with one equation matching the `Draft_Derivation.md`.
    *   Command: `bash scripts/bin/run_team_cycle.sh --tex-draft main.tex --mock-llm`
    *   Expect: Cycle completes, `tex_compilation_gate` passes.

2.  **Regression - Broken TeX:**
    *   Input: `main.tex` with a syntax error (`\begin{equation}` without `\end{equation}`).
    *   Expect: `tex_compilation_gate` fails fast. Cycle aborts.

3.  **Regression - Missing Bib Entry:**
    *   Input: `main.tex` cites `\cite{ghost}`, `.bib` is empty.
    *   Expect: `bib_coverage_gate` fails fast.

4.  **Consistency Check (Mock):**
    *   Input: `Draft_Derivation.md` says $x=2$. `main.tex` says $x=3$.
    *   Action: Run with mock LLM response "MISMATCH: TeX claims x=3".
    *   Expect: Convergence gate fails (Verdict: Needs Revision).
