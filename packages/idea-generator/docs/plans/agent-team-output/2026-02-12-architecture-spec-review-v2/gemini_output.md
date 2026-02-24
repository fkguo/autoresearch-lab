VERDICT: READY

## Blockers
- None. The schema definitions and RPC specs provide a sufficient contract for implementation.

## Non-blocking
- **OpenRPC Return Type Specificity**: The return types for `idea.promote` and `search.step` are currently generic `object`s. While not blocking the architecture, strictly defining these (e.g., returning the `handoff_uri`) would improve the client-side developer experience.
- **Formalism Registry Validation**: The `IdeaCard` schema allows any string in `candidate_formalisms`. The strict check relies on the runtime `method_compiler` registry. This is an acceptable design choice for a plugin system, but requires the `idea.promote` implementation to be rigorous in returning `schema_validation_failed` if a formalism is unrecognized.

## Real-research fit
- **Evidence-First Core**: The `IdeaNode` schema's inclusion of `origin` (prompt hash, temp) and `operator_trace` (evidence URIs used) is excellent for scientific reproducibility. It treats the *process* of ideation as data, not just the result.
- **Folklore Handling**: Explicitly modeling `folklore_risk` and requiring a `grounding_audit` before promotion directly addresses the "re-inventing the wheel" problem common in AI-generated physics ideas.
- **Hybrid Workflow**: The separation of `rationale_draft` (Stage 1, messy/intuitive) and `idea_card` (Stage 2, formal/strict) mirrors actual theoretical work (blackboard scribbles vs. paper writing).

## Robustness & safety
- **Budget Circuit Breaker**: The RPC `search.step` with `n_steps` combined with the "budget exhausted" error code allows the orchestrator (`hepar`) to maintain strict control over computational costs, preventing runaways.
- **Grounding Audit Gate**: The architecture mandates that `idea.promote` fails if the audit doesn't pass. This prevents hallucinated claims from leaking into downstream C2 (method design) workflows.

## Specific patch suggestions

### 1. Schema: Add `folklore_risk_score` to Grounding Audit
The spec mentions `folklore_risk_score` in section 4.2.1, but it is missing from the `idea_node_v1` schema.

**File**: `schemas/idea_node_v1.schema.json`
**Change**: Add `folklore_risk_score` to `grounding_audit` properties.

```json
"grounding_audit": {
  "type": ["object", "null"],
  "properties": {
    "status": { "enum": ["pass", "fail", "partial"] },
    "folklore_risk_score": { "type": "number", "minimum": 0, "maximum": 1, "description": "1.0 = known folklore, 0.0 = novel" },
    "failures": { "type": "array", "items": { "type": "string" } },
    "timestamp": { "type": "string", "format": "date-time" }
  },
  "additionalProperties": false
},
```

### 2. OpenRPC: Tighten `idea.promote` return type
Ensure the client knows where to find the generated handoff artifact.

**File**: `schemas/idea_core_rpc_v1.openrpc.json`
**Change**: Define properties for `promotion_result`.

```json
{
  "name": "idea.promote",
  // ... params ...
  "result": {
    "name": "promotion_result",
    "schema": {
      "type": "object",
      "required": ["handoff_artifact_uri"],
      "properties": {
        "handoff_artifact_uri": { "type": "string", "format": "uri" },
        "status": { "enum": ["promoted"] }
      }
    }
  },
  // ... errors ...
}
```

### 3. OpenRPC: Tighten `search.step` return type
Return operational metrics to allow the distributor to adjust strategies.

**File**: `schemas/idea_core_rpc_v1.openrpc.json`
**Change**: Define properties for `search_step_result`.

```json
{
  "name": "search.step",
  // ... params ...
  "result": {
    "name": "search_step_result",
    "schema": {
      "type": "object",
      "properties": {
        "steps_taken": { "type": "integer" },
        "new_nodes_count": { "type": "integer" },
        "budget_remaining": { "type": "object" }
      }
    }
  },
  // ... errors ...
}
```
