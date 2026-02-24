VERDICT: READY

## Blockers
- None. The schema definitions are self-consistent, and the ambiguity between `node_id` (snapshot) and `idea_id` (lineage) is resolved.

## Non-blocking
- **Grounding Audit Lifecycle**: It is implicitly assumed that `grounding_audit` on an `IdeaNode` is populated either by `search.step` (if a specific role like 'Checker' is active) or `eval.run`. Explicitly defining *when* this audit runs (e.g., as a mandatory pass in `eval.run` or a dedicated `audit.run` RPC method) would improve deterministic workflows.
- **Novelty Delta Enforcement**: The spec mandates `novelty_delta_table` when novelty is evaluated, but JSON Schema `if/then` conditionals cannot easily enforce "if configuration X is set, then output Y is required" across different objects. This remains a business-logic constraint.

## Real-research fit
- **Explain-Then-Formalize**: The separation of `RationaleDraft` (Stage 1, warm) and `IdeaCard` (Stage 2, cold, strict schema) is an excellent architectural choice for theoretical physics, mirroring the "blackboard -> LaTeX" transition.
- **Evidence Support Types**: The `support_type` enum in `IdeaCard` (`literature`, `calculation`, `assumption`) accurately reflects the varying rigidity of scientific claims.
- **Formalism Registry**: Decoupling the general idea structure from specific mathematical implementations (via `candidate_formalisms` + `formalism_registry`) is crucial for supporting different theoretical frameworks (e.g., S-matrix vs. Lagrangian) without schema churn.

## Robustness & safety
- **Circuit Breaking**: The `BudgetEnvelope` and `BudgetSnapshot` integration into the RPC response loop ensures the orchestrator can enforce strict cost/time limits.
- **Audit Gates**: The explicit `grounding_audit` object in `IdeaNode` and the `node.promote` error `-32011 grounding_audit_failed` provide a strong safety mechanism against hallucinated citations entering the C2 pipeline.

## Specific patch suggestions

### 1. Clarify Grounding Audit Trigger
**File:** `docs/plans/2026-02-12-idea-generator-architecture-spec.md`
**Location:** Section 4.2.1
**Change:** Explicitly state that `eval.run` is the standard trigger for populating the audit field when the config includes a grounding dimension.

```markdown
<!-- BEFORE -->
IdeaCard 只有在通过 grounding audit 后才被视为“有效可推广对象”...

<!-- AFTER -->
IdeaCard 只有在通过 grounding audit 后才被视为“有效可推广对象”。Grounding Audit 应作为 `eval.run` 的一部分执行（当 `EvaluatorConfig` 包含 `grounding` 维度时），或者由 'Checker' 角色在生成后立即执行。结果写入 `IdeaNode.grounding_audit`。
```

### 2. Strengthen Claim Verification Defaults
**File:** `schemas/idea_card_v1.schema.json`
**Location:** `claims` property definition
**Change:** explicitly default `verification_status` to `unverified` to ensure downstream systems don't assume "verified" by omission.

```json
// Add default to verification_status
"verification_status": { 
  "enum": ["verified", "unverified", "falsified"],
  "default": "unverified" 
},
```

### 3. Add `audit.run` to RPC (Optional but recommended for v1.1)
**File:** `schemas/idea_core_rpc_v1.openrpc.json`
**Location:** `methods` array
**Suggestion:** Consider reserving `audit.run` method name for purely objective compliance checks (schema + link resolution + checksums) distinct from subjective `eval.run`. For now, `eval.run` is sufficient.
