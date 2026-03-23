# Prompt: 2026-03-23 `Pipeline A` Repoint Batch 1 — `autoresearch` Canonical Lifecycle Entrypoint

## Intent

Implement the smallest `Pipeline A repoint` slice that makes generic `autoresearch` the canonical lifecycle entrypoint authority without reopening `UX-05` scaffold authority, `project-contracts`, EVO-14, EVO-15, or HEP provider-pack cleanup.

## Scope

- Add the canonical `autoresearch` bin on `@autoresearch/orchestrator`
- Repoint only `init/status/approve/pause/resume/export`
- Keep `autoresearch init` as a thin composition shell over existing scaffold authority
- Add the canonical `skills/autoresearch/SKILL.md`
- Demote `skills/hepar/SKILL.md` plus touched Python help/doctor/README wording so `hepar` / `hep-autoresearch` are no longer described as the default generic entrypoint
- Update `meta/REDESIGN_PLAN.md`, `meta/remediation_tracker_v1.json`, and `AGENTS.md` so the repoint is preserved in checked-in SSOT

## Hard Constraints

- Do not add `hepar` / `hep-autoresearch` transition aliases or wrappers that create a second operator-facing authority
- Do not create a second scaffold authority; `project-contracts` remains the scaffold source of truth
- Do not expand into `run` shell parity, `doctor`/`bridge` repoint, or full tutorial/workflow cleanup
- Keep `hepar` and `hep-autoresearch` lifecycle semantics aligned

## Acceptance

```bash
git rev-parse --short HEAD
npx gitnexus analyze --force
pnpm --filter @autoresearch/orchestrator build
pnpm --filter @autoresearch/orchestrator test
pytest packages/hep-autoresearch/tests/test_doctor_entrypoints_cli.py
rg -n "hepar orchestrator|hepar project root|Treat `hep-autoresearch` as the control plane|default entrypoint|canonical entrypoint" \
  packages/orchestrator skills packages/hep-autoresearch/README.md
rg -n "hepar|hep-autoresearch|Pipeline A" \
  AGENTS.md meta/REDESIGN_PLAN.md meta/remediation_tracker_v1.json skills packages/hep-autoresearch
```
