VERDICT: READY

## Blockers
None. The architecture and schemas are exceptionally mature, with a clear focus on machine-enforceability and auditable evidence trails.

## Non-blocking
- **Abstract Problem Registry Extensibility**: While §7 of the spec mentions registries in the `DomainPack`, `campaign.init` currently only allows overriding the `formalism_registry`. Adding an `abstract_problem_registry` parameter to `campaign.init` (mirroring the formalism pattern) would allow callers to introduce specialized reduction targets (e.g., specific graph algorithms or PDE types) without modifying the core engine or DomainPack.
- **Idempotency Metadata Consistency**: The OpenRPC spec mandates an `idempotency.is_replay` flag in responses. While `search_step_result_v1` includes this, ensure that all other side-effecting result schemas (e.g., `campaign_init_result`, `promotion_result`) also explicitly include this object to satisfy the contract.
- **Failed Approach Integration**: §8.1 of the spec lists `failed_approach_v1.jsonl` as an input, but the `campaign.init` parameters don't explicitly include a path for prior failure records. Including these in the `seed_pack` or as a separate `init` parameter would strengthen the "anti-hallucination" and "anti-repetition" safety.

## Real-research fit
- **Problem Reduction (归约) Workflow**: This is a high-fidelity representation of actual theoretical physics work. Most breakthroughs stem from realizing a physics problem is isomorphic to a mature mathematical or computational structure. The mandatory `reduction_map` (min 8 items) and `invariants` prevent the "metaphorical analogy" trap.
- **Factorized Distributor**: Modeling the distributor with action-space factorization and cost-aware chemical potentials (Lagrangian penalties for tokens/USD) is the correct approach for real-world LLM orchestration where backends and team topologies have heterogeneous costs.

## Robustness & safety
- **JCS Idempotency**: Adopting RFC 8785 (JCS) for payload hashing is a very strong engineering choice. It ensures that semantic identity is preserved across different JSON implementations, preventing critical idempotency failures.
- **Audit Gate Chaining**: The combination of `grounding_audit` (provenance check) and `reduction_audit` (consistency check) as a hard block for `node.promote` is excellent. The inclusion of `toy_check_result` (pass/fail/skipped) provides a concrete "unit test" for new ideas before they enter the C2 pipeline.

## Specific patch suggestions

- **File**: `schemas/idea_core_rpc_v1.openrpc.json`
  - **Change**: Add `abstract_problem_registry` (type: object, ref to registry schema) to `campaign.init` parameters.
  - **Reason**: Enable cross-disciplinary extensibility by allowing users to provide custom abstract problem definitions (e.g., from a new MathPack) at runtime.

- **File**: `schemas/reduction_report_v1.schema.json`
  - **Change**: Add a `verification_status` field (enum: pending, satisfied, violated) to each item in the `reduction_map` array.
  - **Reason**: Allows the `reduction_audit` to record precisely which parts of the problem-to-abstract mapping were successfully verified.

- **File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`
  - **Change**: In §4.2.1.6 (Reduction Audit), add: "Promotion MUST fail with `reduction_report_missing` if a node was produced by a reduction operator but lacks a `reduction_report`."
  - **Reason**: Enforce the contract that reduction-based ideas must carry their derivation artifact to be eligible for promotion.

- **File**: `schemas/search_step_result_v1.schema.json`
  - **Change**: In `degradation_events`, add `cost_aware_weight_deltas` to the object.
  - **Reason**: Allow the distributor to record how it adjusted Lagrangian multipliers ($\lambda_k$) in response to budget pressure, improving auditability of the "early stop" logic.
