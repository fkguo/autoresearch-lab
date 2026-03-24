# NEW-LITFLOW-02 — Executable Generic Literature Workflows + High-Level MCP Surface Pruning

## Status / Why This Exists

`NEW-LITFLOW-01` successfully registered a workflow-pack / recipe authority layer and narrowed `M-25`, but post-closeout review found that the implementation stopped at governance/documentation registration and did **not** yet deliver an executable provider-neutral literature workflow surface or any reduction of the public high-level MCP tool surface.

The key mismatches between `NEW-LITFLOW-01` intent and current code/docs are:

1. **Recipes still hardcode provider-specific tools**
   - `meta/recipes/literature_landscape.json`
   - `meta/recipes/literature_gap_analysis.json`
   - `meta/recipes/literature_to_evidence.json`
   These recipes still encode `inspire_*` / `hep_*` tools directly, so the new “workflow authority” is still effectively provider-specific.
2. **Workflow-pack is metadata, not an executable authority path**
   - `packages/skills-market/packages/literature-workflows.json`
   - `skills/research-team/SKILL.md`
   The workflow-pack is registered and consumer docs now point at it, but no checked-in runtime/launcher/consumer path actually reads the literature recipes and uses them as the fail-closed authority for workflow execution or tool selection.
3. **High-level MCP surface was not pruned**
   - `packages/hep-mcp/tool_catalog.standard.json`
   - `packages/hep-mcp/tool_catalog.full.json`
   - `packages/hep-mcp/tests/research/researchToolSurface.test.ts`
   Standard/public high-level literature tools remain present and are explicitly locked in by tests.
4. **Top-level docs still present high-level MCP tools as the front door**
   - `README.md`
   - `docs/README_zh.md`
   The docs still list dedicated high-level INSPIRE research tools as the primary way to “navigate the literature,” so the practical user-facing surface is not yet meaningfully reduced.

Because of that, the conclusion “no durable follow-up beyond `M-25`” is too optimistic. A separate follow-up slice is required.

This work must **not** be folded into `M-25`. `M-25` remains only the residual atomic cleanup for `inspire_critical_research`.

## Review-Process Diagnosis

`NEW-LITFLOW-01` also exposed a review-process weakness: formal review converged at 0 blocking even though the resulting system still left the practical high-level literature surface almost unchanged.

The problem is not only “implementation incomplete.” It is also that the review process, as executed for this slice, appears to have over-optimized for:

- prompt conformance,
- checked-in governance/doc sync,
- and local acceptance commands,

while under-checking:

- whether workflow authority became **executable** rather than merely documented,
- whether recipes actually became provider-neutral rather than `inspire_*` in disguise,
- whether the public/user-facing literature entry surface materially changed,
- whether tests/docs were actively locking the old surface in place,
- and whether the closeout claim “no durable follow-up beyond `M-25`” was really justified by the code/docs/tool surface.

This follow-up must therefore treat the review deficiency itself as part of the problem statement.

## Objective

Create a follow-up slice that turns the literature workflow-pack from a documentation/metadata layer into an **executable, provider-neutral workflow authority**, and then uses that executable authority to justify a **quality-preserving pruning/demotion** of the public high-level MCP literature surface.

The goal is **not** “fewer tools at any cost.” The goal is:

- generic workflow authority that is truly provider/capability-oriented,
- an actual checked-in consumer/launcher path for that authority,
- and only then a deliberate reduction of redundant high-level MCP tools where quality and operator ergonomics are preserved or improved.

## Non-Goals

- Do not fold this into `M-25`.
- Do not simply delete high-level tools before there is an executable workflow consumer/launcher.
- Do not re-create another provider-specific facade in recipe/workflow-pack form.
- Do not reduce tool count as the only success metric.
- Do not weaken high-value bounded atomic operators merely to make the catalog smaller.
- Do not introduce top-level schema unions (`oneOf` / `anyOf` / `allOf`) into MCP tool surfaces.

## Required Reads

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md` sections for:
   - `NEW-DISC-01`
   - `NEW-WF-01`
   - `NEW-SKILL-WRITING`
   - `M-24`
   - `M-25`
   - `NEW-LITFLOW-01`
4. `meta/ECOSYSTEM_DEV_CONTRACT.md` rules on generic/provider-neutral authority and skill/workflow boundaries
5. `meta/protocols/session_protocol_v1.md`
6. `meta/schemas/workflow_recipe_v1.schema.json`
7. `meta/recipes/*.json`
8. `packages/hep-mcp/src/tools/registry/inspireResearch.ts`
9. `packages/hep-mcp/tests/research/researchToolSurface.test.ts`
10. `packages/hep-mcp/tool_catalog.standard.json`
11. `packages/hep-mcp/tool_catalog.full.json`
12. `packages/hep-mcp/src/tools/research/discovery/providerExecutors.ts`
13. `packages/skills-market/packages/literature-workflows.json`
14. `packages/skills-market/packages/research-team.json`
15. `skills/research-team/SKILL.md`
16. `skills/research-team/scripts/bin/literature_fetch.py`
17. `README.md`
18. `docs/README_zh.md`

## GitNexus Gates

1. Before planning, read `gitnexus://repo/autoresearch-lab/context`.
2. If the index is stale, run `npx gitnexus analyze` (or `--force` on a dirty worktree).
3. Before any later implementation/review prompt is written, rerun `npx gitnexus analyze --force` if authoritative consumers, symbols, or tool-surface files changed.

## Core Questions To Answer

### 1. What should count as a truly generic literature workflow?

Proposed candidate workflow families:

- `landscape_mapping`
- `gap_analysis`
- `paper_set_to_evidence`
- `topic_evolution`
- `paper_set_connections`
- `source_provenance_trace`

For each candidate, determine:

- Which steps are provider-neutral workflow semantics
- Which steps are atomic provider/source capabilities
- Which providers can satisfy the minimum capability contract
- Which degrade/fail-closed semantics are required when a provider cannot satisfy the full workflow

### 2. Is `workflow_recipe_v1` sufficient as-is?

Explicitly decide whether the current recipe schema can carry:

- capability-based step selection,
- provider preferences or fallback ordering,
- fail-closed unsupported states,
- provenance for provider/tool selection,
- and consumer-launcher execution hints.

If the answer is “no,” define the smallest schema/contract change required. Do **not** invent a sprawling new workflow system for convenience.

### 3. What is the executable consumer/launcher?

Determine which checked-in surface should actually consume the workflow-pack as authority:

- `research-team`
- a small shared workflow launcher/reader
- a recipe-driven helper under `packages/`
- or another clearly bounded consumer

The answer must result in a real checked-in authority path, not only metadata/package registration.

### 4. Which MCP tools remain public standard atomic tools?

Produce a deliberate retained-vs-demoted map for high-level literature tools.

At minimum evaluate:

- `inspire_discover_papers`
- `inspire_field_survey`
- `inspire_topic_analysis`
- `inspire_network_analysis`
- `inspire_find_connections`
- `inspire_trace_original_source`
- `inspire_deep_research`
- `inspire_critical_research`

The review must distinguish:

- **atomic bounded operator worth keeping**
- **workflow-like surface that should move behind workflow-pack / skill entry**
- **unclear/duplicate surface needing follow-up**

### 5. What is the minimal safe pruning plan?

Do not assume “remove everything high-level.” Instead decide:

- what must stay in `standard`,
- what can be demoted from `standard` but kept in `full`,
- what can be removed entirely,
- and what preconditions are required before each pruning step.

## Quality Bar

The follow-up is only successful if it improves all three of:

1. **Authority correctness**
   - generic workflow authority is not provider-specific in disguise
2. **Operator ergonomics**
   - users have a cleaner, more coherent high-level entry path
3. **Execution reality**
   - the new authority is actually consumed somewhere real and auditable

If a proposed pruning reduces tool count but makes workflows less usable, less auditable, or more implicit, reject it.

In the same way, if a future implementation “passes review” but still leaves the effective public surface unchanged, that review should be treated as insufficient rather than as a proof of success.

## Required Deliverables

1. A precise post-`NEW-LITFLOW-01` diagnosis:
   - what was achieved
   - what remains structurally incomplete
2. A recommended new slice registration:
   - suggested item name
   - whether it belongs as `NEW-LITFLOW-02`
   - dependencies
   - tracker note text
3. A capability matrix for generic literature workflows vs providers/sources
4. A recommendation for the executable workflow consumer/launcher
5. A retained/demoted/removed map for current public high-level MCP literature tools
6. A narrow update plan for:
   - `meta/remediation_tracker_v1.json`
   - `meta/REDESIGN_PLAN.md`
   - `meta/protocols/session_protocol_v1.md`
   - `meta/recipes/`
   - `packages/skills-market/`
   - user-facing docs
7. If implementation should proceed later, a checked-in canonical implementation prompt for that later slice

## Explicit Out of Scope

- Implementing `M-25` itself
- Reopening `M-24`
- Rebuilding `NEW-DISC-01`
- Broad repo-wide skill/agent redesign outside literature workflows
- Any “tool count reduction” that is not grounded in a better authority/consumer design

## Acceptance For The Governance / Planning Pass

- The diagnosis explicitly compares `NEW-LITFLOW-01` intent vs actual code/docs/tool surface
- The follow-up slice is clearly separated from `M-25`
- The proposal names an executable workflow consumer/launcher, not just metadata
- The proposal includes a concrete public-surface pruning strategy with explicit quality gates
- Any still-durable follow-up is recorded in checked-in SSOT, not left only in chat

## Review Scope Guidance

Formal review for any later implementation should at least include:

- `meta/` governance files and recipes
- `packages/hep-mcp` tool surface, catalogs, docs drift tests, and consumer-facing tests
- `packages/skills-market/`
- the chosen workflow consumer/launcher
- top-level docs that currently advertise literature entry surfaces

Do not reduce review to changed files only, and do not treat workflow-pack metadata alone as sufficient evidence that authority has actually moved.

Formal review must also answer the following explicitly:

1. **Executable authority check**
   - Is there a real checked-in consumer/launcher reading the workflow authority, or only metadata/docs?
2. **Provider-neutrality check**
   - Are the workflow recipes/contracts still hardcoding `inspire_*` / provider-specific paths, or do they truly express provider/capability-neutral semantics?
3. **Public-surface delta check**
   - Which high-level literature tools were retained, demoted, or removed?
   - Did `standard` / `full` tool counts change? If not, why is that still acceptable?
4. **Doc/front-door check**
   - Do README / protocol / consumer docs still route users first to high-level MCP tools rather than the workflow-pack / consumer layer?
5. **Test-lock check**
   - Are there tests that preserve the old high-level surface and thereby mask the fact that no real pruning occurred?
6. **Closeout-claim check**
   - If the implementation claims “no durable follow-up beyond `M-25`,” does source evidence truly support that, or does another structural follow-up remain necessary?

Reviewers should explicitly distinguish:

- “the prompt scope was completed as written”
- from
- “the underlying product/architecture problem is materially resolved”

These are not the same judgment, and this slice should fail review if the first is true but the second is not.

## Suggested First Step For A New Conversation

Open a new Plan-mode conversation and use this prompt as the canonical task brief. The first deliverable should be a structured governance/design plan, not immediate code edits.
