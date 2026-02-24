# Adjudication — skilldev-tex-draft-check-r1

## Goal

Add a “TeX draft checking” capability to `research-team` that covers:
1) derivation checking (gap/definition/consistency),
2) literature checking (coverage + closest prior work + citation hygiene),
3) writing improvement (structure/clarity/claim framing),
while preserving research-team principles: deterministic preflight where possible, independent A/B review, traceable artifacts, and Capsule boundary semantics.

## Inputs (A/B/C)

- Member A (Opus): `team/skilldev-tex-draft-check-r1_member_a_opus.md`
- Member B (Gemini): `team/skilldev-tex-draft-check-r1_member_b_gemini.md`
- Member C (Sonnet, QA sidecar): `team/skilldev-tex-draft-check-r1_member_c_sonnet.md`

## Options Considered (compressed)

1) **Integrated “paper_milestone / --mode draft” inside `run_team_cycle.sh`**
   - Pros: one entrypoint; leverages existing team cycle semantics.
   - Cons: bloats `run_team_cycle.sh`; harder to test gates independently; more failure coupling.
   - Advocates: Gemini (primary), Sonnet (as Option 2).

2) **Standalone draft entrypoint + layered architecture**
   - New script (e.g. `scripts/bin/run_draft_cycle.sh` or `scripts/check_draft.sh`) runs deterministic gates + builds a focused review packet; then optionally invokes A/B/C review.
   - Pros: clean separation (deterministic vs LLM); easier regression tests; non-blocking by default; less coupling to existing cycle complexity.
   - Cons: extra entrypoint; needs clear UX to avoid “two competing workflows”.
   - Advocates: Opus (Option A hybrid), Sonnet (Option 1).

3) **PDF-first review**
   - Pros: catches reader-facing issues.
   - Cons: lossy for equations; heavier dependencies; weaker line-traceability.
   - Advocates: Opus (Option C) as later-stage enhancement only.

## Adjudication (Recommended Path)

**Adopt Option 2 (standalone draft cycle) as P0.**

Rationale:
- Minimizes risk of destabilizing `run_team_cycle.sh`.
- Enables deterministic gates (compile/ref/cite/fig existence, link hygiene, KB linkage) with strong regression coverage.
- Keeps LLM work clearly non-deterministic and review-structured (A/B independent; C optional).

## Staged Rollout

### P0 (deterministic, non-LLM)
- Implement a draft preflight runner (`run_draft_cycle.sh` or `check_draft.sh`) that produces:
  - `team/draft_<stamp>/preflight_report.md`
  - `team/draft_<stamp>/structure_map.json` (sections/envs/cites/labels minimal extraction)
  - `team/draft_<stamp>/citation_kb_linkage.md` (clickable links; missing coverage as WARN by default)
- Gates:
  - TeX build gate (if toolchain present; otherwise WARN + skip)
  - citation key coverage (`\cite{}` must exist in `.bib`) — FAIL
  - label/ref integrity — WARN/FAIL policy to be decided
  - figure path existence — WARN

### P1 (LLM reviews, structured outputs)
- Add member system prompts specialized for draft checking (derivation/literature/writing).
- Packet includes: selected TeX regions (or flattened/chunked), plus deterministic preflight outputs, plus relevant KB subset.
- Produce A/B independent reports + merge + action items list under `team/draft_<stamp>/`.

### P2 (claim/capsule traceability)
- Optional: claim registry (abstract/intro claims) and claim→body support mapping; flag capsule boundary violations.

## Next Decision Needed

Pick the interface shape for P0:
1) `scripts/bin/run_draft_cycle.sh` (draft-first “cycle” terminology, similar to team cycle)
2) `scripts/check_draft.sh` (explicit “preflight lint” terminology, can optionally call team cycle)

