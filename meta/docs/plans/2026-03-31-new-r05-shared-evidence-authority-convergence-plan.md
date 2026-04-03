# NEW-R05 Shared Evidence Authority Convergence Plan

> **Date**: 2026-03-31
> **Status**: Approved
> **Role**: Planning-only charter for the next bounded `NEW-R05` follow-up after the paper-identity fail-closed slice
>
> **Implementation Charter**: `meta/docs/prompts/prompt-2026-04-01-new-r05-shared-evidence-authority-convergence-first.md`

## Why This Exists

`NEW-R05` is no longer blocked on the old `run_pdf` provenance hole alone. The first bounded runtime slice already landed:

- PDF evidence entering writing / semantic artifacts now needs a real paper identity;
- `run_pdf` is no longer fabricated in the semantic path;
- and same-paper PDF work is skipped when the run already has successful LaTeX authority for that paper.

What remains is the narrower **shared authority convergence** backlog inside the evidence stack. This plan exists to keep that next slice small and closed-loop oriented instead of reopening the whole evidence abstraction at once.

## Source-Grounded Current State

The current checked-in tracker/plan/source agree on this residual seam:

- shared/generated authority already exists for `EvidenceCatalogItemV1`, `LatexLocatorV1`, `PdfLocatorV1`, and `EvidenceType`;
- `packages/hep-mcp/src/core/evidence.ts` already consumes shared generated authority for LaTeX/project evidence;
- but local authority still remains in:
  - `packages/hep-mcp/src/core/pdf/evidence.ts`
  - `packages/hep-mcp/src/core/writing/evidence.ts`
  - `packages/hep-mcp/src/core/hep/measurements.ts`

The tracker note for `NEW-R05` already records the exact residuals:

- local `PdfEvidenceCatalogItemV1` / `PdfLocatorV1` / `PdfEvidenceType`
- PDF promotion into writing evidence still going through local PDF types rather than the shared generated contract
- `measurements.ts` still keeping a local `EvidenceType` subset plus `EvidenceCatalogItemV1Like`

## Hard Principles For The Next Slice

These principles are already part of the real runtime truth and must remain intact:

1. For the same paper, LaTeX is the higher-fidelity authority.
2. If the same paper already has successful LaTeX authority in the run, the writing / semantic path must not download/build a redundant PDF surface for that paper.
3. PDF support remains for cases where LaTeX is absent or the PDF is for a different paper.
4. The next slice should improve shared authority convergence without weakening the fail-closed paper-identity behavior that just landed.

## Recommended Next Lane

Recommended next implementation lane after `M-22 research-team convergence first`:

- `NEW-R05 shared evidence authority convergence first`

This should be the next `NEW-R05` code lane because it is:

- runtime-relevant, not governance-only;
- smaller and safer than a full evidence-stack rewrite;
- aligned with the already-landed paper-identity/LaTeX-first behavior;
- and scoped enough to review deeply.

## Proposed Goal

Land the smallest real shared-authority convergence slice in the evidence stack:

- replace the touched local PDF/evidence-like authority at the writing / semantic boundary with shared generated contracts where that boundary is already live;
- remove the most direct local evidence-like duplicate in `measurements.ts`;
- keep LaTeX-first / same-paper PDF-skip behavior unchanged.

## Proposed Candidate Scope

### In scope candidate

- `packages/hep-mcp/src/core/pdf/evidence.ts`
- `packages/hep-mcp/src/core/writing/evidence.ts`
- `packages/hep-mcp/src/core/hep/measurements.ts`
- directly affected tests:
  - `packages/hep-mcp/tests/core/writingEvidence.test.ts`
  - `packages/hep-mcp/tests/core/pdfEvidence.test.ts`
  - `packages/hep-mcp/tests/core/evidenceCatalog.test.ts`
  - `packages/hep-mcp/tests/core/hepMeasurements.test.ts`
  - adjacent compare/localization tests only if the source proof shows they consume the touched authority

### Explicitly out of scope candidate

- no schema redesign of `meta/schemas/evidence_catalog_item_v1.schema.json`
- no reopening of `ComputationEvidenceCatalogItemV1` / `NEW-CONN-03`
- no storage-format redesign for standalone PDF evidence artifacts
- no broad all-consumer evidence cleanup across the repo
- no regression against the newly landed paper-identity fail-closed and LaTeX-first behavior

## Key Planning Questions The Lane Must Settle

The next planning/inspection lane should answer these before code starts:

1. What is the smallest touched path where `PdfLocatorV1` and catalog item authority can switch to shared generated types without widening into full PDF storage refactors?
2. Can `measurements.ts` consume shared generated `EvidenceCatalogItemV1` and shared generated `EvidenceType` directly, or is a tiny compatibility adapter still required?
3. Which tests already lock the live writing/semantic/provenance behavior, and which one narrow new tests are needed to lock shared-authority adoption without changing behavior?
4. Does any front-door/public contract text still imply that local PDF/evidence-like types are authoritative after the slice?

## Expected Deliverable From The Planning Lane

The planning lane should not implement code. It should produce:

- a source-grounded approved-plan candidate for `NEW-R05 shared evidence authority convergence first`;
- a recommended exact file scope;
- a minimal acceptance command set;
- and, if warranted, a canonical implementation prompt under `meta/docs/prompts/`.

## Why This Is Not The Immediate First Lane

This should follow, not precede, the `M-22` convergence consumer lane because:

- `M-22 research-team convergence first` is smaller and more isolated;
- it improves another real runtime authority seam with lower merge risk;
- and it avoids running two code lanes near the same `hep-mcp` evidence stack at once.
