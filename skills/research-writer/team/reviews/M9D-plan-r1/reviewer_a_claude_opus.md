

VERDICT: NOT_READY

## Blockers

1. **No concrete acceptance criteria defined.** This packet is a design decision document, not a milestone packet with testable acceptance criteria. There is no list of "the milestone is complete when X, Y, Z are true." Without acceptance criteria, there is nothing to verify as READY.

2. **No artifact inventory or file manifest.** A proper milestone packet should enumerate exactly which files will be added/modified, with expected signatures. The packet references several existing files (`check_latex_evidence_gate.py`, system prompts, etc.) but does not specify what the deliverable artifact set is for M9D itself.

3. **The packet asks reviewers to make a design decision ("Decision we need from reviewers") rather than presenting a completed milestone for acceptance.** This is a pre-milestone design review, not a milestone completion packet. The convergence loop is meant to evaluate whether a milestone is READY to ship, not to serve as a design committee.

4. **No test plan or validation evidence.** Even if we treat Option B as the chosen direction, there is no description of tests that would confirm the evidence gate works end-to-end on `draft_sections` output, no example of a trace log format, no specification of failure modes and their handling beyond prose sketches.

## Non-blocking

- The naming is somewhat inconsistent: the packet mentions `research_writer_draft_sections.py` and also "a flag to `research_writer_scaffold.py`" — this should be resolved before implementation but is not a blocker for the decision itself.
- The "dual-model generation mode" (`claude.tex` + `gemini.tex`) is interesting but underspecified. It's unclear what happens downstream — who merges? Is there a diff tool? This needs fleshing out but can be deferred to implementation.
- The phrase "must not auto-mutate `assets/style/physics_discussion_logic_playbook.md`" is good but should be enforced by a file-permission or pre-commit check, not just by convention.

## Real-research fit

**Strong fit, with one caveat.** The core problem — preventing hallucinated provenance/uncertainty statements — is exactly the failure mode that destroys trust in AI-assisted research papers. The evidence-gate approach (risky keywords without anchors → fail) is a pragmatically sound heuristic for real workflows.

However, real research writing is iterative and messy. The proposal should account for:
- **Partial drafts**: researchers often want to draft one section at a time (e.g., just the Discussion), not the full paper. The command should support single-section drafting.
- **Human-in-the-loop editing**: the `paper/drafts/` staging area is good, but the workflow for promoting a draft section into `main.tex` should be explicit (even if manual).
- **Citation handling**: the evidence gate checks for anchors, but real papers anchor claims via `\cite{}`. The gate should recognize citation commands as valid evidence anchors, not just inline text explanations.

**My recommendation on the design decision itself:** **Option B (skill-provided, opt-in) is correct**, for these reasons:
- If drafting stays agent-only (Option A), every agent implementation will reinvent the guardrails, and most will do it worse. Centralizing the evidence gate into the skill is a safety improvement, not a risk increase.
- The `paper/drafts/` staging area (never overwriting `main.tex` by default) is the right containment boundary.
- The mandatory post-generation `check_latex_evidence_gate.py --fail` run means the skill is *more* auditable than ad-hoc agent drafting.
- The trace log requirement makes this more accountable than any agent-only approach.

## Robustness & safety

- **Hallucination risk**: Option B with the evidence gate *reduces* hallucination risk compared to Option A, because the gate runs automatically. Without it, agents may skip the check.
- **Graceful degradation**: the requirement "must not corrupt the paper" needs a concrete mechanism — e.g., all writes go to `paper/drafts/` with timestamped filenames; `main.tex` is never touched without `--in-place` *and* a passing evidence gate. This should be enforced in code, not just documented.
- **Trace log**: the format should be specified (JSON? plaintext?). It must include: input file paths, model name + temperature, full prompt hash or content, evidence gate pass/fail result, list of flagged lines if failed.
- **Atomicity**: if the LLM call succeeds but the evidence gate fails, the draft file should still be written (for human review) but a `.failed` marker or separate report file should be co-located. This is sketched in the packet but needs to be an explicit acceptance criterion.

## Specific patch suggestions

1. **Rewrite this packet as a proper milestone with acceptance criteria.** Suggested structure:

```markdown
## M9D Acceptance Criteria

- [ ] `scripts/bin/research_writer_draft_sections.py` exists and is executable
- [ ] Running it with `--help` shows usage for single-section and full-paper modes
- [ ] Default output goes to `paper/drafts/<timestamp>_<section>.tex`; `main.tex` is never modified without `--in-place`
- [ ] `--in-place` requires evidence gate to pass; if gate fails, write is aborted and draft is left in `paper/drafts/`
- [ ] Every invocation writes a JSON trace log to `paper/drafts/.trace/<timestamp>.json` containing: input paths, model args, prompt hash, gate result, flagged lines
- [ ] `check_latex_evidence_gate.py --fail` is run automatically on all generated output
- [ ] If LLM call fails, exit with non-zero status; no partial writes to `main.tex`; draft directory may contain partial output marked `.incomplete`
- [ ] At least 3 integration tests exist: (a) clean generation passes gate, (b) generation with hallucinated provenance fails gate and produces TODO report, (c) LLM failure degrades gracefully
- [ ] `\cite{}` commands are recognized as valid evidence anchors by the gate
```

2. **In `check_latex_evidence_gate.py`**, add `\cite{...}` and `\citet{...}` / `\citep{...}` as recognized evidence anchor patterns if not already present.

3. **Add a file-level guard** (pre-commit hook or in the script itself) that refuses to write to `paper/main.tex` if the evidence gate has not passed:

```python
# In research_writer_draft_sections.py
if args.in_place:
    gate_result = run_evidence_gate(output_path)
    if not gate_result.passed:
        logger.error("Evidence gate failed; refusing --in-place write. See %s", report_path)
        sys.exit(1)
```

4. **Define the trace log schema** explicitly in a docstring or a small JSON schema file, e.g. `assets/schemas/draft_trace_log.schema.json`.

5. **Add single-section support** to the CLI design:

```
research_writer_draft_sections.py --section introduction  # just intro
research_writer_draft_sections.py --all                    # full paper
```

6. **In the skill registration/documentation**, add a prominent note that `draft_sections` is opt-in and does not run automatically in any default workflow. This prevents surprise LLM calls in CI or batch processing.
