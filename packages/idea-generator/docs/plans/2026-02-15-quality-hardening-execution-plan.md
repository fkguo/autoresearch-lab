# QL-03/04/05 Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement QL-03/QL-04/QL-05 as auditable, generic tool capabilities without mixing any M5 test-instance research content into tool repositories.

**Architecture:** Use `idea-generator` as design/contract SSOT, `idea-core` as control-plane/runtime implementation target, and a separate `idea-runs` monorepo for all test-instance/run artifacts. Enforce the boundary with anti-pollution gates in tool repos and schema/gate contracts that are method-agnostic.

**Tech Stack:** Python, JSON Schema draft-2020-12, Make/pytest, GitHub Project v2 (`gh`), review-swarm dual-review (Opus + gemini-3-pro-preview).

---

### Task 1: Stage Bootstrap + Board Sync

**Files:**
- Modify: `docs/plans/2026-02-12-implementation-plan-tracker.md`
- Create: external local review archive note for `2026-02-15-ql-03-board-sync-check-v1.txt` (outside repo)

**Step 1: Run board/tracker sync checks**

Run:
```bash
gh project item-list 1 --owner fkguo --limit 200 --format json
gh project field-list 1 --owner fkguo --format json
```
Expected: `QL-03` card exists and is `In Progress`; `QL-04`/`QL-05` are `Todo`.

**Step 2: Update tracker stage status + append-only log**

Set `QL-03` to `IN_PROGRESS`, keep `QL-04/05` as `TODO`, append an Update Log line with evidence path.

**Step 3: Commit tracker start sync**

Run:
```bash
git add docs/plans/2026-02-12-implementation-plan-tracker.md
git commit -m "QL-03: start stage with tracker-board sync"
```

### Task 2: QL-03 Implementation (decouple + anti-pollution)

**Files:**
- Create repo tree under: `idea-runs`
- Modify: `idea-core/Makefile` (or equivalent validate path)
- Create: `idea-core/scripts/check_no_test_instance_pollution.py`
- Modify: `idea-generator/Makefile` (or equivalent validate path)
- Create: `idea-generator/scripts/check_no_test_instance_pollution.py`
- Modify: `docs/plans/2026-02-12-implementation-plan-tracker.md`

**Step 1: Write failing anti-pollution tests/checks (RED)**

Add checks that fail if forbidden paths exist in tool repos:
- `research/**`
- `docs/research/**`
- `artifacts/runs/**`

**Step 2: Implement gate scripts (GREEN)**

Implement portable Python script in each tool repo and wire to `make validate`.

**Step 3: Scaffold `idea-runs` monorepo template**

Create:
- `projects/<project_slug>/README.md`
- `charter.md`, `tracker.md`, `pipeline/`, `compute/`, `runs/`, `artifacts/`, `reports/`, `evidence/`, `toolchain/manifest.lock.json`
- one expected-limitation sample project.

**Step 4: Run verification**

Run:
```bash
cd idea-core && make validate && pytest
cd idea-generator && make validate
```
Expected: pass and evidence archived outside the repo.

**Step 5: Dual review convergence**

Generate review packet and run:
```bash
python3 $CODEX_HOME/skills/review-swarm/scripts/bin/run_dual_task.py ... --claude-model opus --gemini-model gemini-3-pro-preview --check-review-contract --fallback-mode ask
```
Repeat minimal fixes until both `VERDICT: READY`.

**Step 6: Commit**

Commit per repo with prefix `QL-03:`.

### Task 3: QL-04 Implementation (generic schemas + checklist)

**Files:**
- Add/modify under: `idea-generator/schemas/`
- Add docs examples/checklist under: `idea-generator/docs/plans/`
- Modify: `docs/plans/2026-02-12-implementation-plan-tracker.md`

**Step 1: Define schema contracts (RED->GREEN)**

Create/upgrade:
- `method_fidelity_contract_v1`
- `literature_search_evidence_v2`
- `numerics_method_selection_v1`
- `numerics_validation_report_v1`
- `portability_report_v1`
- `scope` grading + non-citation flags
- optional `core_loop_execution_audit_v1`

**Step 2: Add minimal sample artifacts + checklist**

Use generic, non-domain-specific examples only.

**Step 3: Verify + dual review convergence**

Run schema validation and dual review loop until both READY.

**Step 4: Commit**

Commit with prefix `QL-04:`.

### Task 4: QL-05 Implementation (control-plane hardening)

**Files:**
- Modify: `idea-core/src/idea_core/hepar/*.py`
- Add/modify: `idea-core/tests/hepar/*.py`
- Modify: `docs/plans/2026-02-12-implementation-plan-tracker.md`

**Step 1: Path boundary fixes with shared helper**

Implement `safe_resolve_under(root, rel)` and replace unsafe path resolution points.

**Step 2: Reliability/perf fixes**

- atomic write helper (tmp+replace)
- reviewer/external timeout + backoff
- ledger de-dup O(N^2) fix
- runtime permission reactive SSE loop
- replay index concurrency safety
- align env whitelist behavior with actual execution.

**Step 3: Tests (RED->GREEN)**

Add regression tests for each hardening item.

**Step 4: Verify + dual review convergence**

Run `make validate && pytest`; persist logs; dual review until both READY.

**Step 5: Commit**

Commit with prefix `QL-05:`.

### Task 5: Final Sync + Clean State

**Files:**
- Modify: `docs/plans/2026-02-12-implementation-plan-tracker.md`

**Step 1: Mark statuses and evidence links**

Set QL-03/04/05 to DONE only if verification + dual READY + commits complete.

**Step 2: Board sync**

Set project cards to `Done` and append commit/evidence references.

**Step 3: Final cleanliness check**

Run:
```bash
git status --short
```
Expected: clean working trees for phase-scoped repos after commits.
