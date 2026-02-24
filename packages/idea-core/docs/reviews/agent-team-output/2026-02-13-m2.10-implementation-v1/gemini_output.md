VERDICT: READY

## Blockers
- None. The core executable loop (M1+M2) is robust, contract-aligned, and handles idempotency conflicts with high granularity (payload_hash).

## Non-blocking
- **Formalism/Problem Registry Stubs**: `campaign_init` currently injects default registries if missing. While useful for bootstrapping, production deployments should require these to be explicitly passed or loaded from a trusted domain-pack to prevent "ghost formalisms" from passing the `node.promote` gate.
- **Param Validation vs. Normative Data Error Order**: In `rank.compute`, the engine checks for `elo_config` presence/absence (code -32002) before checking for `no_scorecards` (code -32013). While logical for protocol hygiene, if the normative order `no_scorecards -> ...` is intended to be the absolute first check, these should be swapped.
- **URI Schema Format**: `idea_card_v1.schema.json` uses `"format": "uri"` for evidence. In HEP, we should eventually specialize this to enforce `inspire:recid` or `arxiv:id` patterns via custom format checkers or regex to mitigate hallucinated "fake URIs".

## Real-research fit
- **Grounding Audit Gate**: The promotion gate correctly requires `grounding_audit.status == "pass"`. This is the primary defense against LLM-generated physics "folklore" (statements that sound like physics but lack derivation or literature support).
- **Reduction Logic**: `reduction.py` correctly implements a "fail-fast" logic where any violated assumption or invalid reduction type fails the audit. This ensures that "IdeaCards" promoted to the next stage are mathematically/conceptually consistent with their target formalism.
- **Node Revisioning**: The use of monotonically increasing revisions in `IdeaNode` is excellent for tracking the evolution from a "rationale_draft" (LLM brainstorm) to a "formalized_card" (audited/verified).

## Robustness & safety
- **Idempotency Strategy**: The "scope-aware" idempotency (global for `init`, campaign-scoped for others) correctly handles the lifecycle of a research run. The inclusion of `payload_hash` in conflict errors is a top-tier debugging aid for multi-agent orchestration.
- **Drift Guard**: The `validate_drift_guard` implementation in `validate.py` effectively forces developers to keep schemas in standalone files rather than leaking complexity into the OpenRPC manifest. This ensures the "Source of Truth" for physics objects remains modular.
- **Atomic Writes**: `EngineStore` uses the "write-tmp-then-replace" pattern, preventing corrupted JSON files during system crashes or interrupted RPC calls.

## Specific patch suggestions

- **File: `src/idea_core/engine/service.py`**
  - **Change**: In `campaign_init`, if `formalism_registry` or `abstract_problem_registry` are provided but empty, the current logic might still succeed or use defaults. Suggest adding a check: `if not params.get("formalism_registry", {}).get("entries"): raise ...` if strict domain-pack enforcement is desired.
  - **Change**: In `rank_compute`, swap the `elo_config` presence check to occur after `if not scorecards_ref:` to strictly adhere to the normative failure order specified in the design packet.

- **File: `contracts/idea-generator-snapshot/schemas/idea_card_v1.schema.json`**
  - **Change**: In `claims.support_type` enum, consider adding `derivation` specifically for HEP-Calc style outputs to distinguish between "I found this in a paper" (literature) and "I computed this via FeynCalc" (derivation).

- **File: `src/idea_core/contracts/validate.py`**
  - **Change**: Add a check to `validate_openrpc_minimal` to ensure `x-error-data-contract` is present and points to `rpc_error_data_v1.schema.json`, ensuring the custom error payload remains governed by the contract.
