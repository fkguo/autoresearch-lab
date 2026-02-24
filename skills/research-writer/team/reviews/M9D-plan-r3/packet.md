# research-writer — M9D-plan-r3 Review Packet (auto-merge for human usability)

## Question
For the upcoming opt-in `draft_sections` command, should we:
- (A) output two model drafts only (Claude + Gemini) and let humans merge, OR
- (B) output two model drafts **and** also produce a single **human-readable merged** draft (agent-style synthesis), OR
- (C) default to a single draft (writer) + second model as auditor, producing one final draft (keep raw intermediate).

We want to **maximize writing automation** while keeping hallucination risk controlled and auditability high.

## Constraints
- Must respect evidence gate: do not invent provenance/uncertainty/error-model details.
- Must remain auditable: keep raw outputs, always write trace logs.
- Must be safe for humans: default outputs should be readable and immediately usable.
- Must be opt-in; no surprise model calls.
- Must not auto-mutate `assets/style/physics_discussion_logic_playbook.md`.

## Existing tooling to leverage
- Guardrails prompt: `assets/style/research_writer_guardrails_system_prompt.txt`
- Voice prompt strengthened with evidence gate: `assets/style/writing_voice_system_prompt.txt`
- Deterministic linter for risky added claims: `scripts/bin/check_latex_evidence_gate.py` (fails if risky `\revadd{...}` lacks anchors)

## Proposed decision (recommendation candidate)
Implement **(C)** as default, with an optional **(B)** mode:

### Default mode: writer + auditor → single draft
- Step 1 (Writer): one model drafts the requested section(s) into `paper/drafts/<run_id>/draft_<section>.tex`.
- Step 2 (Auditor): the other model reviews the draft **only for evidence-gate compliance and clarity**, and produces a revised version `paper/drafts/<run_id>/draft_<section>_revised.tex`.
- Post-check: run `check_latex_evidence_gate.py --fail` on the revised file.
  - If fail: rename to `*.unsafe.tex`, write `EVIDENCE_GATE_FAILED.md`, and exit non-zero.

Why: humans get one coherent draft by default; dual-model helps reduce hallucination; raw intermediate remains for audit.

### Optional mode: dual drafts + synthesis (agent merge)
- Produce `draft_claude_<section>.tex` + `draft_gemini_<section>.tex`.
- Step 3 (Synthesizer): run a third pass (choose one model) to synthesize a single merged `draft_merged_<section>.tex`.
- Post-check same as above.

This is opt-in because an extra generation pass can re-introduce hallucinations even if both drafts were good.

## Acceptance criteria for implementing this design
- Default output is a single readable draft per section.
- Raw intermediate drafts are preserved.
- Evidence gate linter is always enforced and blocks any “promotion” to main paper.
- Trace logs record: inputs, prompts, models, all raw outputs, and linter results.
- Users can disable automation (e.g., `--no-audit` / `--no-merge`) only with explicit flags.

## Reviewer request
Return `VERDICT: READY` only if you agree that adding a default single-draft pipeline (writer+auditor) is appropriate for human usability and automation, and is consistent with safety/auditability constraints.

