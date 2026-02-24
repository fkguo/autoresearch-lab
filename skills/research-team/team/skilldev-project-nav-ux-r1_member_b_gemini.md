**Member B (Gemini) - UX/Design Review**

My stance is **adversarial**. I am optimizing for **agent reliability** first and **human readability** second. If the file structure becomes too complex (deep nesting), agents will fail to locate context, resulting in hallucinations or duplicate work.

### Recommended Approach: Staged Hybrid (P0 First, then Modified P1)

Do not implement P1 (deep archiving) immediately. It introduces high risk of context loss (broken relative paths).

**Phase 1: The Living Map (P0)**
Implement a mandatory `PROJECT_MAP.md` (or `STATUS.md`) at the root. This is not just a "dashboard" for humans; it is the **primary context injection point** for agents entering the project mid-stream.

**Phase 2: The Graveyard (Modified P1)**
Only move **completed/closed** cycles to an `archive/` folder. Never create new work inside a `runs/<tag>` folder. Agents perform best in the root or shallow directories.

---

### Analysis of Options

#### Option P0: Canonical "Front Door" (`PROJECT_MAP.md`)
*   **Pros:**
    *   **Low Risk:** No file movement means no broken links/imports.
    *   **Context Window:** Agents can read one file to understand the *entire* state, rather than `ls -R`.
    *   **Human UX:** Immediate orientation.
*   **Cons:**
    *   **Staleness:** If the Adjudicator fails to update it, it becomes misleading (worse than no map).
*   **Verdict:** **Essential/Required.**

#### Option P1: Deep Archiving (`team/runs/<tag>/...`)
*   **Pros:**
    *   Keeps the root clean.
*   **Cons (CRITICAL):**
    *   **Agent Failure:** Agents act unpredictably with deep relative paths (e.g., `../../assets/template.md`).
    *   **Link Rot:** Moving a file to `runs/` changes its URI. Existing `[Link](file.md)` references in other docs break immediately.
    *   **Searchability:** Harder to `grep` or `glob` for specific previous decisions.
*   **Verdict:** **Reject in current form.** Only archive *dead* files (logs, intermediate raw outputs) that are never referenced again. Keep the *Adjudication* (the truth) in a stable location.

#### Option P2: Writing Export Bundle
*   **Pros:** Nice for the user.
*   **Cons:** Irrelevant to the engineering/derivation workflow. It's a "build artifact," not a UX solution for the team.
*   **Verdict:** **Deferred.** Nice-to-have later.

---

### Minimal Spec (Phase 1: `PROJECT_MAP.md`)

The **Adjudicator** is responsible for maintaining this file. It is the last step of the adjudication phase.

**Filename:** `PROJECT_MAP.md`

**Structure:**
1.  **Current State:**
    *   Phase: (e.g., "Designing Skill Interface")
    *   Active Gate: (e.g., "Gate 2: Interface Approval")
2.  **The "Truth" (Stable Links):**
    *   `[Context]: user_requirements.md`
    *   `[Architecture]: system_map.md`
    *   `[Latest Decision]: team/decisions/r2_adjudication.md`
3.  **Active Workstreams (The Churn):**
    *   Member A Draft: `team/drafts/member_a_r3.md` (Link to current working file)
4.  **Derivation Chain (Reverse Chronological):**
    *   `R2 Adjudication` <- `R2 Drafts` <- `R1 Adjudication`

### Gate Recommendations

**Gate: Adjudication Phase Completion**

1.  **`PROJECT_MAP.md` Exists & Updated** -> **MANDATORY**
    *   *Justification:* Without this, the next agent (or the user) has to "guess" where to start. We cannot rely on implicit folder knowledge. The Adjudicator *must* stamp the map.

2.  **No Broken Links in `PROJECT_MAP.md`** -> **WARN-ONLY**
    *   *Justification:* Validating links is computationally expensive or requires external tools. We can assume the Adjudicator (an LLM) is reasonably accurate, but we shouldn't block the pipeline if it hallucinates a `.txt` extension instead of `.md`.

3.  **Root Directory Cleanliness (< 20 files)** -> **WARN-ONLY**
    *   *Justification:* We want to encourage archiving, but blocking on file count is annoying and arbitrary. Let the `PROJECT_MAP` handle the organization, not the file system.
