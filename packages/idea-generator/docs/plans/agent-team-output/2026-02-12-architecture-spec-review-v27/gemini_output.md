VERDICT: NOT_READY

## Blockers

1.  **Audit Gap in Evaluation Artifacts (Data Loss Risk)**:
    - **Context**: `eval.run` updates `IdeaNode.eval_info` (mutable, latest-only) and persists an `IdeaScorecards` artifact (immutable history).
    - **Problem**: `schemas/idea_node_v1.schema.json` defines `eval_info` as containing rich diagnostics (`fix_suggestions`, `failure_modes`, `novelty_delta_table`). However, `schemas/idea_scorecards_v1.schema.json` *omits* these fields, storing only `scores`, `evidence_uris`, and `notes`.
    - **Impact**: You lose the immutable provenance of *why* a node received a certain score (the suggestions and failure mode flags) once the node is updated by a subsequent eval. The artifact must be the superset SSOT.

## Non-blocking

1.  **RPC Response Payload Scalability**: `rank.compute` returns `RankingResult` which includes the full `ranked_nodes` list inline. For campaigns with >10k nodes, this JSON payload may bloat stdio/network.
    - *Suggestion*: In v1.1, make `ranked_nodes` inline optional or limited, relying on `ranking_artifact_ref` for the full dataset.
2.  **`node.promote` State Semantics**: The spec implies `node.promote` is a side-effect generator (creates handoff artifact) but doesn't explicitly mutate the node's state (e.g., locking it).
    - *Mitigation*: Ensure the implementation allows re-promoting (generating new handoff artifacts) if the `IdeaCard` is updated (revision incremented), effectively handling "fix-then-repromote".

## Real-research fit

- **Strong**: The `folklore_risk` and `grounding_audit` (active lookup) are critical for preventing "hallucinated novelty" in hep-th.
- **Strong**: The `RationaleDraft` (Explain) $\to$ `IdeaCard` (Formalize) split correctly models the physicist's workflow of "intuition first, rigor second".

## Robustness & safety

- **Excellent**: The strict idempotency contract (payload hashing, replay requirements) prevents "ghost runs" and "double spending" of budget.
- **Good**: `search.step` budget fuse (step-local) prevents a single runaway "deep think" step from draining the campaign.

## Specific patch suggestions

### 1. Fix `IdeaScorecards` Schema (Blocker)

The scorecard artifact must capture the full output of the evaluation agents.

**File**: `schemas/idea_scorecards_v1.schema.json`
**Action**: Add `fix_suggestions`, `failure_modes`, and `novelty_delta_table` to the items definition.

```json
// Inside properties -> scorecards -> items -> properties
"fix_suggestions": {
  "type": "array",
  "items": {
    "type": "object",
    "required": ["failure_mode", "suggested_action", "target_field", "priority"],
    "properties": {
      "failure_mode": { "type": "string" },
      "suggested_action": { "type": "string" },
      "target_field": { "type": "string" },
      "operator_hint": { "type": "string" },
      "priority": { "enum": ["critical", "major", "minor"] }
    }
  }
},
"novelty_delta_table": {
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "closest_prior_uris": { "type": "array", "items": { "type": "string" } },
      "delta_statement": { "type": "string" },
      "verification_hook": { "type": "string" }
    }
  }
},
"failure_modes": {
  "type": "array",
  "items": { "type": "string" }
}
```

### 2. Tighten `rank.compute` logic in Spec

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`
**Section**: 2.3 idea-core RPC 接口 (v1)

**Edit**: Explicitly mention that `RankingResult` RPC response *may* truncate the inline list, and the artifact is the source of truth.

> "For `rank.compute`: ... The `ranking_result` returned via RPC MAY truncate `ranked_nodes` for performance; the full ranking MUST be written to `ranking_artifact_ref`."

### 3. Clarify `node.promote` side-effect

**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`
**Section**: 8.2 输出 (handoff)

**Add**:
> "Note: `node.promote` is idempotent regarding the *generation* of the artifact. It does not lock the node; a node can be modified (revision++) and promoted again, generating a new versioned handoff artifact."
