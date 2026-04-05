# NEW-R05 SSOT Truth Sync After Raw-PDF Removal

## Intent

This is the canonical prompt for a **bounded documentation/SSOT sync lane**: bring checked-in SSOT truth up to date after the already-landed removal of the live raw-PDF producer path in `hep-mcp`.

This lane must stay tight:

- do **not** reopen `NEW-R05` architecture work;
- do **not** reintroduce any repo-owned raw PDF parsing / page-region evidence producer stack;
- prefer SSOT updates only, unless source-proof finds a direct contradiction that must be minimally corrected to keep the SSOT sync honest.

## Read First (minimal)

1. `/Users/fkg/Coding/Agents/autoresearch-lab-new-r05-ssot-truth-sync-after-raw-pdf-removal/AGENTS.md`
2. `/Users/fkg/Coding/Agents/autoresearch-lab-new-r05-ssot-truth-sync-after-raw-pdf-removal/meta/remediation_tracker_v1.json`
3. the full `NEW-R05` section in `/Users/fkg/Coding/Agents/autoresearch-lab-new-r05-ssot-truth-sync-after-raw-pdf-removal/meta/REDESIGN_PLAN.md`
4. `/Users/fkg/Coding/Agents/autoresearch-lab-new-r05-ssot-truth-sync-after-raw-pdf-removal/meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/prompts/prompt-2026-04-04-new-r05-remove-live-raw-pdf-path.md`
6. source-proof surfaces only:
   - `/Users/fkg/Coding/Agents/autoresearch-lab-new-r05-ssot-truth-sync-after-raw-pdf-removal/packages/hep-mcp/src/core/writing/evidence.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab-new-r05-ssot-truth-sync-after-raw-pdf-removal/packages/hep-mcp/src/tools/registry/projectCore.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab-new-r05-ssot-truth-sync-after-raw-pdf-removal/packages/hep-mcp/tests/core/writingEvidence.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab-new-r05-ssot-truth-sync-after-raw-pdf-removal/docs/README_zh.md`
   - `/Users/fkg/Coding/Agents/autoresearch-lab-new-r05-ssot-truth-sync-after-raw-pdf-removal/docs/TOOL_CATEGORIES.md`
   - `/Users/fkg/Coding/Agents/autoresearch-lab-new-r05-ssot-truth-sync-after-raw-pdf-removal/docs/ARCHITECTURE.md`

## Critical Source Truths (must verify before editing SSOT)

1. The worktree already contains the raw-PDF removal effect:
   - `packages/hep-mcp/src/core/pdf/evidence.ts` is no longer a live source file in this worktree.
2. `hep_run_build_pdf_evidence` is no longer a live public tool surface.
3. `hep_run_build_writing_evidence` fail-closes `pdf_source` (and other PDF producer inputs) rather than consuming it as a live path.
4. The remaining supported in-repo writing-evidence path is **LaTeX-first plus bridge-artifact inputs only**.
5. Any remaining `pdf_page` / `pdf_region` vocabulary is **generic shared/eval vocabulary**, not proof of a live repo-owned raw-PDF producer.

## Scope

### In scope

- update `meta/remediation_tracker_v1.json` to the truthful current `NEW-R05` status and note text
- update `meta/REDESIGN_PLAN.md` so the `NEW-R05` section matches current source truth
- update front-door docs that still imply a live raw-PDF producer (bounded to `docs/README_zh.md` and `docs/TOOL_CATEGORIES.md`) when source-proof finds drift
- add this canonical prompt file:
  `meta/docs/prompts/prompt-2026-04-05-new-r05-ssot-truth-sync-after-raw-pdf-removal.md`
- update `AGENTS.md` / `CLAUDE.md` only if a GitNexus generated appendix drift requires it (not as hand-authored governance)

### Out of scope

- no reopening of shared evidence schema design
- no new raw PDF stack
- no broad redesign of NEW-RT-09/10 or closure workflow
- no package-code changes unless source-proof finds a direct contradiction that must be minimally corrected

## Decision Target

Decide, based on source-proof, whether `NEW-R05` can truthfully move from `pending` to `done`. If not, narrow the exact remaining scope in SSOT terms (do not repeat stale pre-removal wording).

## Minimum Acceptance (before review)

- `git diff --check`
- `python3 -m json.tool meta/remediation_tracker_v1.json`
- `pnpm --filter @autoresearch/hep-mcp build`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/writingEvidence.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/toolContracts.test.ts`
- `rg -n "hep_run_build_pdf_evidence|pdf_source" /Users/fkg/Coding/Agents/autoresearch-lab-new-r05-ssot-truth-sync-after-raw-pdf-removal/packages/hep-mcp/src /Users/fkg/Coding/Agents/autoresearch-lab-new-r05-ssot-truth-sync-after-raw-pdf-removal/packages/hep-mcp/tests /Users/fkg/Coding/Agents/autoresearch-lab-new-r05-ssot-truth-sync-after-raw-pdf-removal/docs /Users/fkg/Coding/Agents/autoresearch-lab-new-r05-ssot-truth-sync-after-raw-pdf-removal/packages/hep-autoresearch/references/hep-research-mcp`

## Review Requirements

Because this lane changes checked-in SSOT files, formal trio review is mandatory:

- `Opus`
- `Gemini(auto)`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Self-review is also mandatory after trio convergence.

## Expected Closeout Claims (if successful)

- `NEW-R05` is `done` and the SSOT matches current runtime truth.
- `hep_run_build_pdf_evidence` is not part of the live `hep-mcp` public tool surface.
- `hep_run_build_writing_evidence` no longer accepts or consumes `pdf_source` (fail-closed).
- the supported in-repo writing-evidence path is LaTeX-first plus bridge-artifact inputs only
- any remaining `pdf_page` / `pdf_region` vocabulary is generic shared/eval consumer vocabulary, not proof of a live raw-PDF producer.
