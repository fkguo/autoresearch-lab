# NEW-R06 Analysis-Types Live-Authority Convergence First

## Intent

This is the canonical implementation prompt for the next truthful `NEW-R06` slice after the 2026-03-29 governance rebaseline.

The goal is not to “finish analysis-types rollout everywhere.” The goal is to land the smallest real consumer-authority convergence:

- the checked-in schema/codegen substrate remains the single cross-language SSOT;
- only the currently live TS/shared + hep-mcp analysis-tool consumer path is in scope;
- parked shapes and non-consumer rollout stay deferred;
- this slice does not claim `NEW-R06` is fully done unless the source evidence truly supports that broader closeout.

## Worktree Requirement

Do not implement this prompt on the governance-only rebaseline lane:

- `/Users/fkg/Coding/Agents/autoresearch-lab-new-r06-analysis-types-rebaseline`

Use a dedicated implementation worktree for the runtime/package changes.

## Read First

Implementation lane must read, in order:

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. the full `NEW-R06` section in `meta/REDESIGN_PLAN.md`
4. `meta/ECOSYSTEM_DEV_CONTRACT.md` (`SYNC-06`)
5. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
6. this file
7. live substrate and tests:
   - `meta/schemas/analysis_types_v1.schema.json`
   - `packages/shared/src/generated/analysis-types-v1.ts`
   - `meta/generated/python/analysis_types_v1.py`
   - `packages/shared/src/types/analysis-types.ts`
   - `packages/shared/src/types/index.ts`
   - `packages/shared/src/generated/index.ts`
   - `packages/shared/src/__tests__/analysis-types.test.ts`
   - `packages/shared/src/__tests__/schemas.test.ts`
8. live hep-mcp consumer path:
   - `packages/hep-mcp/src/tools/research/findConnections.ts`
   - `packages/hep-mcp/src/tools/research/findRelated.ts`
   - `packages/hep-mcp/src/tools/research/expansion.ts`
   - `packages/hep-mcp/src/tools/research/survey.ts`
   - `packages/hep-mcp/src/tools/research/topicEvolution.ts`
   - `packages/hep-mcp/src/tools/registry/inspireSchemas.ts`
   - adjacent registry/unified callers that exercise the same path:
     - `packages/hep-mcp/src/tools/registry/inspireResearch.ts`
     - `packages/hep-mcp/src/tools/research/index.ts`
     - `packages/hep-mcp/src/tools/research/topicAnalysis.ts`

## GitNexus And Serena

- Activate Serena on the current implementation worktree before using Serena output as authority.
- Run onboarding check before Serena-guided navigation.
- Read GitNexus repo context before coding.
- If the implementation worktree is dirty or contains new symbols/callsites, refresh with `npx gitnexus analyze --force` before relying on graph evidence.
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if the changed callers or authority map are not obvious from direct source inspection.

## Locked Current Truth

### Already live

- `meta/schemas/analysis_types_v1.schema.json` already exists and is the checked-in schema authority for this family.
- `packages/shared/src/generated/analysis-types-v1.ts` and `meta/generated/python/analysis_types_v1.py` already exist, so codegen is not the missing deliverable.
- `packages/shared/src/types/analysis-types.ts` already provides handwritten shared TS/Zod validators and types.
- `packages/shared/src/__tests__/analysis-types.test.ts` already exercises the consolidated shared Zod surface.

### Real live consumers

Current non-test live consumers are limited and specific:

- `packages/hep-mcp/src/tools/research/findConnections.ts`
- `packages/hep-mcp/src/tools/research/findRelated.ts`
- `packages/hep-mcp/src/tools/research/expansion.ts`
- `packages/hep-mcp/src/tools/research/survey.ts`
- `packages/hep-mcp/src/tools/registry/inspireSchemas.ts`

### Real remaining duplicate/partial state

- overlapping analysis-type names exist in both `packages/shared/src/generated/analysis-types-v1.ts` and `packages/shared/src/types/analysis-types.ts`
- `packages/shared/src/generated/index.ts` suppresses overlapping generated exports because the handwritten shared types already claim those names
- `packages/hep-mcp/src/tools/research/topicEvolution.ts` still defines local `TopicEvolutionParams` and result interfaces instead of reading the shared analysis-types authority
- `packages/hep-mcp/src/tools/research/topicAnalysis.ts` still consumes that local `topicEvolution.ts` authority transitively, and `packages/hep-mcp/src/tools/research/index.ts` still re-exports `TopicEvolutionParams` / `TopicEvolutionResult` from the local file rather than from shared
- `AnalyzePapers*`, `AnalyzeCollection*`, `BatchImport*`, and `CollectionAnalysis` currently have no non-test consumer on this tree
- the old `analysis-params*` / `analysis-results*` files are no longer present; do not reintroduce governance wording that claims they still exist

## Exact Scope

### In scope

- converge only the currently live shared/hep-mcp analysis-tool surfaces onto one shared analysis-types authority
- tighten the public/runtime boundary in `packages/shared` so the live consumer path no longer depends on overlapping handwritten-vs-generated ambiguity
- update the live hep-mcp consumer path for:
  - `findConnections`
  - `findRelated`
  - `researchExpansion`
  - `generateSurvey`
  - `topicEvolution`
- add or update adjacent tests proving those live consumers no longer rely on local duplicate analysis-type authority

### Out of scope

- redesigning `analysis_types_v1.schema.json`
- broad generated-type rollout outside the live consumer path
- touching parked shapes without a non-test consumer:
  - `AnalyzePapers*`
  - `AnalyzeCollection*`
  - `BatchImport*`
  - `CollectionAnalysis`
- unrelated hep-mcp tool cleanup, research-tool redesign, or registry refactors outside the live analysis-types consumer path
- new Python-consumer claims unless a real consumer is added and proven in the same slice
- marking `NEW-R06` fully `done` without broader source-grounded authority evidence

## Required Design Constraints

1. `meta/schemas/analysis_types_v1.schema.json` remains the only cross-language SSOT; do not introduce a second schema or a parallel handwritten contract.
2. The next slice must converge live authority; it must not merely add another adapter layer or another duplicate export surface.
3. If generated and handwritten TS surfaces both remain after the slice, the surviving public/runtime ownership must be explicit and test-locked rather than implied by barrel-export suppression.
4. `topicEvolution.ts` must stop being an untracked local authority if the slice touches it; either consume shared authority directly or derive visibly from it.
5. Do not widen the slice to parked/non-consumer shapes just because they share the same schema file.

## Source-Proof Commands

Preserve and rerun these proofs during the implementation lane:

```bash
rg --files packages | rg 'analysis-(params|results)|analysis-types|analysis-types-v1'
```

```bash
python3 - <<'PY'
from pathlib import Path
import re
root = Path('.')
gen = (root/'packages/shared/src/generated/analysis-types-v1.ts').read_text()
hand = (root/'packages/shared/src/types/analysis-types.ts').read_text()
name_pat = re.compile(r'^export\\s+(?:type|interface|const|function|enum)\\s+(\\w+)', re.M)
gen_names = name_pat.findall(gen)
hand_names = name_pat.findall(hand)
overlap = sorted(set(gen_names) & set(hand_names))
print('generated_count=', len(gen_names))
print('handwritten_count=', len(hand_names))
print('overlap_count=', len(overlap))
print('overlap_names=', ', '.join(overlap))
PY
```

```bash
rg -n "FindConnectionsParamsSchema|FindRelatedParamsSchema|ResearchExpansionParamsSchema|GenerateSurveyParamsSchema|TopicEvolutionParamsSchema|TopicEvolutionSchema|CollectionAnalysisSchema|BatchImportParamsSchema|AnalyzeCollectionParamsSchema|AnalyzePapersParamsSchema" packages/shared/src/types/index.ts packages/shared/src/index.ts packages/hep-mcp/src/tools
```

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `pnpm --filter @autoresearch/shared test -- analysis-types.test.ts`
- `pnpm --filter @autoresearch/shared test -- schemas.test.ts`
- targeted hep-mcp tests covering the live consumer path touched by the slice
- `rg -n "analysis-types|analysis-types-v1|TopicEvolutionParams|TopicEvolutionSchema|FindConnectionsParamsSchema|FindRelatedParamsSchema|ResearchExpansionParamsSchema|GenerateSurveyParamsSchema" packages/shared packages/hep-mcp meta/REDESIGN_PLAN.md meta/remediation_tracker_v1.json`

Implementation note from the governance lane:

- On the governance rebaseline worktree, `pnpm --filter @autoresearch/shared test -- analysis-types.test.ts` and `pnpm --filter @autoresearch/shared test -- schemas.test.ts` both failed before execution because `vitest: command not found` and `node_modules` were missing.
- Treat missing dependencies as an environment prerequisite to hydrate, not as permission to skip the shared tests.

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must check source, callers, tests, and whether the live shared/hep-mcp path actually converged to one analysis-types authority.
- If Gemini or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than shrinking to diff-only review.
- Formal self-review is also required after trio convergence.

## Expected Closeout Claims

If the batch succeeds, the truthful closeout claim is narrow:

- the checked-in analysis-types schema/codegen substrate was already live before the slice;
- the slice converged the currently live shared/hep-mcp analysis-tool authority path;
- `topicEvolution` no longer remains a silent local duplicate authority if it was in the touched path;
- parked/non-consumer analysis-types shapes remain deferred.

Anything broader than that needs fresh source evidence and should not be claimed by default.
