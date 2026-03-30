# NEW-R05 Paper Identity Fail-Closed First

## Intent

This is the approved-plan candidate for the **first real implementation lane after the 2026-03-30 NEW-R05 governance rebaseline**.

The priority is **closed-loop correctness**, not evidence-stack beautification.

This slice exists to fix the one runtime behavior that most directly weakens evidence provenance today:

- PDF evidence already enters the writing / semantic path;
- that path can still end up with a synthetic paper identity (`run_pdf`);
- that path also should not compete with a more accurate LaTeX surface for the same paper;
- and once the run already has successful LaTeX authority for that same paper, we should not even download/build the PDF surface for writing evidence;
- this lane removes that synthetic fallback and makes the boundary fail closed.

This lane is intentionally narrower than a full `NEW-R05` cleanup. It should improve the real loop quickly without broad refactoring or new abstraction churn.

## Read First

Implementation lane must read, in order:

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. the full `NEW-R05` section in `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. `meta/docs/prompts/prompt-2026-03-29-new-r05-evidence-abstraction-rebaseline.md` (background / rebaseline context only)
6. current live authority files:
   - `packages/hep-mcp/src/core/writing/evidence.ts`
   - `packages/hep-mcp/src/core/evidenceSemantic.ts`
   - `packages/hep-mcp/src/core/pdf/evidence.ts`
7. adjacent evidence substrate:
   - `packages/hep-mcp/src/core/evidence.ts`
   - `meta/schemas/evidence_catalog_item_v1.schema.json`
   - `packages/shared/src/generated/evidence-catalog-item-v1.ts`
8. targeted tests:
   - `packages/hep-mcp/tests/core/writingEvidence.test.ts`
   - `packages/hep-mcp/tests/core/pdfEvidence.test.ts`
   - `packages/hep-mcp/tests/core/evidenceCatalog.test.ts`

## GitNexus And Serena

- Activate Serena on the implementation worktree before using Serena output as authority.
- Run onboarding check before Serena-guided navigation.
- Read GitNexus repo context before coding.
- If the worktree is dirty or contains new symbols/callsites, refresh with `npx gitnexus analyze --force` before relying on graph evidence.
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if the changed authority map is not obvious from direct source inspection.

## Exact Scope

### In scope

- Add `paper_id?: string` to `WritingPdfSourceInput`.
- Treat LaTeX as the higher-fidelity authority for a paper when both LaTeX and PDF are available for that same paper.
- Treat PDF evidence promotion into writing / semantic artifacts as requiring a **real paper identity** from exactly one of:
  - explicit `pdf_source.paper_id`, or
  - exactly one successful LaTeX source paper in the same run, used only as an identity-resolution hint for same-paper detection when `pdf_source.paper_id` is absent.
- If a PDF source resolves to a paper that already has a successful LaTeX source in the same run, short-circuit before `buildRunPdfEvidence`: do not download, parse, or emit PDF writing/semantic artifacts for that paper.
- If a PDF source resolves to a paper that already has a successful LaTeX source in the same run, do **not** promote that PDF surface into writing / semantic artifacts for that paper; keep LaTeX as the only writing/semantic surface for the shared paper identity.
- If neither identity source exists, fail closed instead of fabricating `run_pdf`.
- If multiple successful LaTeX papers exist and `pdf_source.paper_id` is absent, treat that as ambiguous and fail closed rather than guessing.
- Ensure the semantic query path no longer emits `paper_id: 'run_pdf'`.
- Keep the touched PDF -> writing / semantic boundary visibly derived from shared evidence truth where practical, but prefer the smallest adapter needed over broad type churn.
- Add or update targeted tests proving:
  - explicit `pdf_source.paper_id` works;
  - unique successful LaTeX paper identity is used only to detect same-paper overlap or ambiguity, not to downgrade LaTeX from primary authority;
  - when the PDF source is for a paper that already has successful LaTeX authority in the same run, the code skips PDF download/build work rather than merely dropping PDF later;
  - PDF is skipped for writing / semantic promotion when the same paper already has a successful LaTeX source;
  - missing / ambiguous PDF paper identity fails closed;
  - semantic query results no longer rely on `run_pdf`.

### Out of scope

- Do not redesign `packages/hep-mcp/src/core/pdf/evidence.ts` storage format.
- Do not edit `meta/schemas/evidence_catalog_item_v1.schema.json`.
- Do not reopen `ComputationEvidenceCatalogItemV1` / `NEW-CONN-03`.
- Do not broaden this slice into a full evidence-type cleanup across every residual consumer.
- Do not pull `packages/hep-mcp/src/core/hep/measurements.ts` into scope unless a tiny, zero-risk adjustment is strictly required by the fail-closed paper-identity change.
- Do not attempt to mark `NEW-R05` done from this slice alone.

## Required Design Constraints

1. Closed-loop provenance is more important than broad cleanup in this slice.
2. Do not introduce any new synthetic paper-identity fallback after removing `run_pdf`.
3. If a paper has a successful LaTeX source, LaTeX remains the only writing / semantic authority for that paper in this slice; for that same paper, the lane should skip PDF download/build work instead of producing a parallel standalone PDF extraction artifact.
4. The unique-successful-LaTeX-paper rule is an identity-resolution aid only; it does not make LaTeX a fallback, and it must not authorize PDF download or PDF promotion for a paper that already has LaTeX authority in the same run.
5. Prefer a small explicit adapter at the PDF -> writing / semantic promotion boundary over a repo-wide evidence-type rewrite.
6. If `continue_on_error` behavior is preserved, unresolved PDF identity must still fail closed for the PDF surface itself and must not silently leak PDF evidence into semantic candidates.
7. Keep the implementation bounded to the files and tests directly needed for this paper-identity seam.

## Public Interface Change

- `WritingPdfSourceInput.paper_id?: string`

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `pnpm --filter @autoresearch/hep-mcp build`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/writingEvidence.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/pdfEvidence.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/evidenceCatalog.test.ts`
- `rg -n "WritingPdfSourceInput|paper_id\\?: string|run_pdf" packages/hep-mcp/src/core/writing/evidence.ts packages/hep-mcp/src/core/evidenceSemantic.ts`

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must inspect the real runtime path from PDF source input to writing-evidence artifacts to semantic query output.
- Reviewers must explicitly check that the implementation improved provenance truth without broadening the lane into a full evidence refactor.
- Reviewers must explicitly check that LaTeX stays authoritative when the same paper is available from both LaTeX and PDF sources.
- Reviewers must explicitly check that same-paper LaTeX authority suppresses PDF download/build work, not only downstream PDF promotion.
- If Gemini or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than shrinking to diff-only review.
- Formal self-review is required after trio convergence.

## Expected Closeout Claim

If this slice succeeds, the truthful claim is narrow:

- PDF evidence that enters writing / semantic artifacts now has a real paper identity or fails closed.
- When the same paper is available from both LaTeX and PDF, the writing / semantic path keeps LaTeX as the only active authority for that paper and skips redundant PDF download/build work.
- The semantic path no longer fabricates `run_pdf`.
- The closed-loop provenance story is materially improved without reopening the whole evidence abstraction stack.
- `NEW-R05` remains pending for later residual authority cleanup beyond this narrow seam.
