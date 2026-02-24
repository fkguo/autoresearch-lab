# Adjudication — skilldev-run-team-cycle-bugfix-r1

## Goal

Fix a regression where `run_team_cycle.sh` could abort after writing member A/B reports, preventing the mandatory convergence gate and trajectory updates. Sidecar (member C) must remain strictly warn-only and never block convergence accounting.

## Decision List (with rationale)

1) **Extract inline Python heredocs into standalone helper CLIs**
- Decision: move the embedded Python snippets out of `scripts/bin/run_team_cycle.sh` into:
  - `scripts/bin/team_cycle_extract_primary_notebook.py`
  - `scripts/bin/team_cycle_find_config_path.py`
  - `scripts/bin/team_cycle_autofill_enabled.py`
  - `scripts/bin/team_cycle_patch_packet.py`
  - `scripts/bin/team_cycle_sidecar_probe.py`
- Rationale: reduce bash parse fragility and prevent mid-run aborts caused by heredoc boundary mistakes in complex control flow.

2) **Make convergence gate reachability explicit**
- Decision: log `"[gate] running convergence gate: ..."` immediately before invoking `scripts/gates/check_team_convergence.py`.
- Rationale: makes regressions obvious and ensures the “mandatory convergence gate” is observable in logs.

3) **Keep sidecar strictly non-blocking**
- Decision: sidecar stays background + warn-only; convergence accounting and trajectory updates happen before `finalize_sidecar`.
- Rationale: even if sidecar is misconfigured or fails, it must not block the mandatory A/B convergence gate once reports exist.

4) **Add deterministic regression for `--packet` mode**
- Decision: add `scripts/dev/smoke/smoke_test_run_team_cycle_packet_input.sh` to lock tag/round-tag patching behavior under `--packet` + `--preflight-only`.
- Rationale: the packet patcher is a high-risk integration surface; this regression catches drift deterministically.

## Gate / Regression Results

- `python3 -m compileall -q scripts` ✅
- `bash -n scripts/bin/run_team_cycle.sh` ✅
- `bash scripts/dev/run_all_smoke_tests.sh` ✅ (includes existing sidecar+convergence smoke tests and the packet-input smoke test)

## Member Reviews (A/B/C)

- Member A (Opus): `team/skilldev-run-team-cycle-bugfix-r1_member_a_opus.md` → **APPROVE** (minor recommendations)
  - Notes: suggested optional stderr warnings on helper import failures + keep `set +e` windows tight.
- Member B (Gemini): `team/skilldev-run-team-cycle-bugfix-r1_member_b_gemini.md` → **APPROVE**
  - Notes: flagged SIGINT orphan-process risk as a future hardening item (out of scope for this round).
- Member C (Sonnet): `team/skilldev-run-team-cycle-bugfix-r1_member_c_sonnet.md` → **CONCERNS (non-blocking)**
  - Notes: raised potential helper-failure / tag-injection hardening ideas; some concerns are already mitigated by current `set +e` wrappers and by existing smoke coverage, but the suggested follow-ups are reasonable future work.

## Adjudication

**ACCEPT r1.**

Rationale:
- The mandatory invariant is restored: once member A/B reports exist, the convergence gate runs and trajectory updates record `converged` / `not_converged`.
- Sidecar remains warn-only and cannot block convergence accounting (covered by `smoke_test_convergence_gate_sidecar.sh`).

## Follow-ups (optional; separate round)

- Add stderr warnings for helper import/config discovery failures (debuggability).
- Validate/sanitize `--tag` to forbid newlines/tabs (traceability hardening).
- Improve SIGINT handling to terminate background runner PIDs (robust cleanup).

