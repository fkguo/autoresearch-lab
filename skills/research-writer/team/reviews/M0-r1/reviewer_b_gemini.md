VERDICT: READY

## Blockers

## Non-blocking
- `assets/style/style_profile.md`: Section 7 contains absolute local paths (`/Users/fkg/...`). While acceptable for an audit trail of the *training* data, ensure the skill logic does not rely on these paths existing at runtime.
- `assets/style/writing_voice_system_prompt.txt`: The "insert TODO stubs" instruction is valuable but would benefit from a standardized format for easier programmatic detection (e.g., specific tags or LaTeX commands).

## Real-research fit
- **High.** The emphasis on "Physics-first" logic, operational definitions, and skepticism towards literature ("treat literature claims as inputs that can fail") accurately reflects high-standard theoretical physics workflows.
- The requirement for provenance pointers for all quoted numbers is essential for maintaining scientific integrity in AI-assisted writing.

## Robustness & safety
- The "kill criterion" requirement for unverified claims is a strong safeguard against compounding errors.
- Explicit instructions to avoid custom macros and double-escaping in LaTeX mitigate common LLM generation failures.

## Specific patch suggestions
- **File:** `assets/style/writing_voice_system_prompt.txt`
  - **Context:** Final paragraph regarding missing material.
  - **Suggestion:** Enforce a searchable format for TODOs.
  - **Patch:**
    ```text
    When source material is incomplete, do not hallucinate missing derivations or numbers; instead, insert TODO stubs using a strict format (e.g., "**[TODO: missing value from source X]**") to ensure they are easily greppable and not missed during review.
    ```
