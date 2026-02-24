# research-writer — M9D-plan-r1 Decision Packet (should we add `draft_sections`?)

## Context / problem
We observed a concrete hallucination failure mode in a test project:
- The agent added an unverified provenance + uncertainty model statement (e.g. “data taken from NNOline” and “uniform errors manually added”) without an explicit evidence anchor.

This is precisely the class of error we want to prevent.

## Current mitigation already in `research-writer`
- Guardrails system prompt template:
  - `assets/style/research_writer_guardrails_system_prompt.txt`
  - Enforces: do not add factual statements about data provenance/uncertainties/error models without an evidence anchor; otherwise leave unchanged and add TODO.
- FK voice system prompt strengthened with the same evidence gate:
  - `assets/style/writing_voice_system_prompt.txt`
- Deterministic linter for LaTeX revision additions:
  - `scripts/bin/check_latex_evidence_gate.py`
  - Scans `\revadd{...}` blocks; if risky keywords appear (uncertainty/error model/provenance verbs etc.) without anchor, it fails (with `--fail`).

## Proposal under discussion
Add an **optional** LLM-assisted command to the skill:

- Name: `draft_sections` (exact CLI can be `scripts/bin/research_writer_draft_sections.py` or a flag to `research_writer_scaffold.py`).
- Intended purpose: help an agent draft a full paper (Intro/Formalism/Results/Discussion) from `Draft_Derivation.md`, `knowledge_base/`, and `artifacts/`, while enforcing the evidence gate.

### Design constraints (must not violate)
- Must not invent technical facts; missing evidence must become TODOs.
- Must not auto-mutate `assets/style/physics_discussion_logic_playbook.md`.
- Must be auditable: always write a trace log (inputs + model args + post-check results).
- Must degrade gracefully if LLM calls fail; must not corrupt the paper.

### Safety design options
A) **Agent-only** (recommended-by-some): keep `draft_sections` out of skill; agent orchestrates writing using external prompts and manual checks.

B) **Skill-provided but opt-in**: provide `draft_sections` in the skill with strict guardrails:
- Default behavior: write drafts under `paper/drafts/` (never overwrite `paper/main.tex` unless explicit `--in-place`).
- Require revision markup for additions/deletions (`\revadd{...}`, `\revdel{...}`) when `--revision-macros` is enabled.
- Run `check_latex_evidence_gate.py --fail` on the generated draft; if it fails, keep output but mark status as FAILED and write a short TODO report.
- Optional dual-model generation mode: produce `drafts/claude.tex` + `drafts/gemini.tex` rather than auto-merging.

## Decision we need from reviewers
Is it appropriate to add a `draft_sections` command to `research-writer` **as a skill feature** (opt-in, auditable), or should we keep it strictly as an agent responsibility?

Evaluate:
- Skill vs Agent boundary correctness
- Expected hallucination risk impact (does it help or make things worse?)
- Auditability and real-research workflow fit
- Minimal viable design (if YES)

