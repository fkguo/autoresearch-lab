VERDICT: NOT_READY

## Blockers

### B1: `fcntl`-based locking is not portable (Linux/macOS only)
`src/idea_core/engine/store.py` uses `import fcntl` unconditionally. This will crash on Windows at import time. Even if Windows is not a primary target, it's a hard import-time failure that blocks CI on any Windows runner and violates the "testable artifact contracts" requirement. At minimum, this needs a conditional import or an abstraction layer.

### B2: `node.get` and `node.list` bypass result schema validation for `node.get`
In `service.py`, `handle()` calls `self.catalog.validate_result(method, result)` for every method. For `node.get`, the result is a raw `IdeaNode` dict. But the node was constructed internally (by `_seed_node`) and then mutated (by `eval_run`, `_mutate_node` in tests). There is **no re-validation against `idea_node_v1.schema.json` after mutation**. The `eval_run` handler mutates `eval_info` and `grounding_audit` onto the node but never validates the mutated node against the node schema before persisting. This means `node.get` can return a node that doesn't pass its own result schema if any mutation path produces an invalid intermediate state. The contract says result validation fires in `handle()`, but that's **after** the corrupted node is already persisted.

**Concrete risk**: `eval_run` sets `grounding_audit.status = "pass"` and `folklore_risk_score = 0.2` but doesn't populate `failures` or `timestamp` — meaning the grounding_audit sub-object may or may not match the schema depending on whether the schema requires those fields. If `grounding_audit_v1.schema.json` requires `timestamp`, nodes persisted by `eval_run` are silently invalid.

### B3: No contract schema files provided for several critical `$ref` targets
The review bundle includes only a subset of the `.schema.json` files. The following are `$ref`'d from the OpenRPC doc but not provided for audit:
- `campaign_charter_v1.schema.json`
- `seed_pack_v1.schema.json`
- `budget_envelope_v1.schema.json`
- `budget_snapshot_v1.schema.json`
- `budget_topup_v1.schema.json`
- `budget_limit_v1.schema.json`
- `campaign_init_result_v1.schema.json`
- `campaign_status_v1.schema.json`
- `campaign_mutation_result_v1.schema.json`
- `search_step_result_v1.schema.json`
- `idea_node_v1.schema.json`
- `idea_card_v1.schema.json`
- `idea_list_filter_v1.schema.json`
- `node_list_result_v1.schema.json`
- `eval_result_v1.schema.json`
- `evaluator_config_v1.schema.json`
- `formalism_registry_v1.schema.json`
- `abstract_problem_registry_v1.schema.json`
- `idempotency_meta_v1.schema.json`
- `elo_config_v1.schema.json`
- `novelty_delta_table_v1.schema.json`
- `grounding_audit_v1.schema.json` (referenced implicitly by node structure)

Without these, `$ref` closure validation passes only because the files presumably exist on disk, but **no reviewer can verify the contract correctness of the engine's behavior**. This is a blocker for audit completeness.

### B4: Idempotency store is not crash-safe (TOCTOU between load and save)
`_record_or_replay` loads the idempotency store, checks for key existence, and returns. Then `_store_idempotency` loads it *again*, adds the key, and saves. Between the two calls, the entire handler executes (including disk writes for nodes, campaign state, and artifacts). If the process crashes after writing nodes/campaign but before `_store_idempotency` completes, the system is in an inconsistent state: side-effects are committed but the idempotency record is not, so a retry will re-execute and double-write.

The mutation lock prevents concurrent access but **not crash recovery**. For a system that explicitly promises "no repeated side-effects on replay," this is a correctness blocker.

## Non-blocking

### N1: Deterministic scoring stub is a hash-based fake
`_deterministic_score` in `service.py` uses `sha256(node_id:dimension)` to generate scores. This is fine for bootstrap/testing, but the method should be clearly marked as a stub (e.g., via a `# STUB: replace with real evaluator dispatch` comment and a feature flag), since it silently produces meaningless physics scores that could be mistaken for real evaluation output downstream.

### N2: `_filter_nodes` doesn't validate filter keys against schema
Unknown filter keys are silently ignored (they don't fail, they just don't match). A caller passing `{"has_idea_cars": true}` (typo) gets back all nodes. Consider at least a warning or strict mode.

### N3: Pareto front computation is trivially incorrect
The "pareto" method just sorts by aggregate score and marks rank 1 as `pareto_front=True`. This is not Pareto dominance — it's single-objective ranking. For ≥2 dimensions, multiple nodes can be on the Pareto front. The stub nature of this is acceptable for M2 bootstrap, but the method name `pareto` creates a false contract: callers expect Pareto semantics.

### N4: `node.list` cursor is an integer offset string
Offset-based pagination is fragile under concurrent mutations (insertions shift offsets). For a single-writer system this is tolerable, but the contract should document that cursor stability is not guaranteed across mutations.

### N5: Missing `__init__.py` files in the bundle
Not shown whether `src/idea_core/__init__.py`, `src/idea_core/engine/__init__.py`, etc. exist. If missing, imports will fail with modern `setuptools.packages.find`.

### N6: `eval.run` doesn't check `node.campaign_id` consistency
Unlike `node.get` and `node.promote`, `eval.run` only checks `if node_id not in nodes` but does not verify `node["campaign_id"] == campaign_id`. Since nodes are loaded from `campaign_id`-scoped storage this is practically safe, but it's an asymmetry with the other methods.

### N7: OpenRPC declares `campaign.topup`, `campaign.pause`, `campaign.resume`, `campaign.complete`, `search.step` but the handler dispatch map in `service.py` does not include them
`handle()` will return `-32601 method_not_found` for these. The OpenRPC doc should either mark them as `x-not-implemented` or the service should return a specific "not yet implemented" error code to distinguish from truly unknown methods.

### N8: Artifact path traversal safety is incomplete
`load_artifact_from_ref` checks that the path starts with `str(root) + os.sep`, but this is bypassable on edge cases (e.g., symlinks). Consider using `Path.is_relative_to()` (Python 3.9+).

## Real-research fit

### R1: Evidence provenance chain is structurally incomplete
Seed nodes carry `source_uris` from the seed pack, and `idea_card.claims[].evidence_uris` exists, but there is no mechanism to:
1. Validate that evidence URIs resolve to actual papers/data (no arXiv/INSPIRE lookup integration).
2. Track which evidence was actually *used* to derive a score vs. merely *cited*.
3. Distinguish human-curated evidence from LLM-hallucinated references.

For HEP research credibility, the `evidence_uris` field needs at minimum a `verified: bool` flag and a `verification_method` enum (e.g., `"arxiv_api"`, `"inspire_api"`, `"human_audit"`).

### R2: Grounding audit is a pass-through stub
`eval_run` unconditionally sets `grounding_audit.status = "pass"` with `folklore_risk_score = 0.2` for any node evaluated with `"grounding"` in dimensions. In a real HEP context, grounding must check:
- Whether claims overlap with well-known results (folklore detection)
- Whether cited observables are actually measurable at current/planned experiments
- Whether the formalism is consistent with known symmetries

The current stub gives a false sense of safety. A `grounding_audit.method = "stub"` field would make this transparent.

### R3: No novelty check mechanism
The `novelty_delta_table_v1.schema.json` is referenced in scorecards but never populated. For HEP idea generation, novelty verification against arXiv/INSPIRE is the single most important hallucination mitigation. The schema exists but the implementation path is entirely missing.

### R4: Reduction audit / abstract problem registry defaults are toy-only
The default `abstract_problem_registry` contains only `"optimization"` with `known_solution_families: ["gradient-based"]`. This is not meaningful for HEP. The bootstrap story should include at least one HEP-relevant abstract problem type (e.g., `"symmetry_breaking"`, `"loop_calculation"`, `"effective_field_theory_matching"`).

## Robustness & safety

### S1: No rate limiting or abuse prevention on the RPC server
The stdio server processes every line unconditionally. A malicious or buggy caller can exhaust disk with unlimited campaign/node creation. The budget system limits steps/nodes/tokens per campaign but not total campaigns.

### S2: No schema versioning negotiation
`ContractCatalog` reads `info.version` but never exposes it to callers or checks compatibility. If the contract schemas are updated, there's no mechanism to detect or handle version mismatch between caller and engine.

### S3: Idempotency records grow unboundedly
The spec says "retained for campaign lifetime" but there's no cleanup mechanism. For long-running campaigns with many eval/rank cycles, the idempotency store JSON file will grow without bound. Consider JSONL append-only with a compaction strategy.

### S4: `_write_json` uses `tmp.replace(path)` which is atomic on POSIX but the `_append_jsonl` path does not have atomic semantics
If the process crashes during `_append_jsonl`, the JSONL file may have a partial line. The node log should be considered append-only best-effort and consumers should handle truncated last lines.

### S5: No input sanitization on `campaign_name` or `scope` strings
These are stored as-is in JSON files. While not a direct security risk in a local stdio-based system, if these are ever surfaced in logs/UIs, they could contain control characters or extremely large strings.

## Specific patch suggestions

### Patch 1: Crash-safe idempotency (B4)
**File**: `src/idea_core/engine/service.py`
**Change**: Move idempotency record storage to *before* committing side-effects, or implement a write-ahead log pattern. Minimal fix:

```python
# In each mutating handler (e.g., eval_run), replace the current pattern:
#   1. do work
#   2. validate result  
#   3. write artifacts/nodes/campaign
#   4. store idempotency
#
# With:
#   1. do work
#   2. validate result
#   3. store idempotency (with response, marking as "pending")
#   4. write artifacts/nodes/campaign
#   5. mark idempotency record as "committed"
#
# On replay, if record exists but is "pending", treat as crash recovery:
#   re-execute (the mutation lock prevents concurrent access).
```

Alternatively, write all state (nodes, campaign, idempotency) in a single `_write_json` call to a transaction journal, then apply.

### Patch 2: Post-mutation node validation (B2)
**File**: `src/idea_core/engine/service.py`, method `eval_run`
**Change**: After mutating nodes, validate each against the node schema before persisting:

```python
# After the scoring loop, before save:
for node_id in node_ids:
    try:
        self.catalog.validate_against_ref(
            "./idea_node_v1.schema.json",
            updated_nodes[node_id],
            base_name=f"eval.run/node/{node_id}",
        )
    except ContractRuntimeError as exc:
        raise self._schema_error(f"eval produced invalid node {node_id}: {exc}")
```

### Patch 3: Portable locking (B1)
**File**: `src/idea_core/engine/store.py`
**Change**: Replace `fcntl` with a portable file-lock abstraction:

```python
# Replace:
import fcntl

# With:
import sys
if sys.platform == "win32":
    import msvcrt
    def _lock(fh):
        msvcrt.locking(fh.fileno(), msvcrt.LK_LOCK, 1)
    def _unlock(fh):
        msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)
else:
    import fcntl
    def _lock(fh):
        fcntl.flock(fh.fileno(), fcntl.LOCK_EX)
    def _unlock(fh):
        fcntl.flock(fh.fileno(), fcntl.LOCK_UN)
```

Or better: add `filelock>=3.13` to dependencies and use `FileLock`.

### Patch 4: Mark stubs explicitly (N1, R2)
**File**: `src/idea_core/engine/service.py`
**Change**: Add stub markers to `_deterministic_score` and the grounding audit generation in `eval_run`:

```python
def _deterministic_score(self, node_id: str, dimension: str) -> float:
    """STUB: deterministic hash-based score for bootstrap testing only.
    
    TODO(M3+): Replace with real evaluator dispatch (multi-agent LLM scoring).
    """
    ...

# In eval_run, where grounding_audit is set:
node["grounding_audit"] = {
    "status": "pass",
    "method": "stub_deterministic",  # <-- ADD THIS
    "folklore_risk_score": 0.2,
    "failures": [],
    "timestamp": now,
}
```

### Patch 5: Unimplemented method differentiation (N7)
**File**: `src/idea_core/engine/service.py`, method `handle`
**Change**:

```python
NOT_YET_IMPLEMENTED = {
    "campaign.topup", "campaign.pause", "campaign.resume",
    "campaign.complete", "search.step",
}

def handle(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
    ...
    if method not in handlers:
        if method in self.NOT_YET_IMPLEMENTED:
            raise RpcError(
                code=-32601,
                message="method_not_implemented",
                data={"reason": "method_not_implemented", "details": {"method": method}},
            )
        raise RpcError(...)
```

### Patch 6: Add evidence verification flag to idea_card claims (R1)
**File**: `contracts/idea-generator-snapshot/schemas/idea_card_v1.schema.json` (not provided but needs this addition)
**Change**: Add to `claims[].properties`:

```json
"verified": {
  "type": "boolean",
  "default": false,
  "description": "Whether evidence_uris have been programmatically verified (arXiv/INSPIRE API check)."
},
"verification_method": {
  "enum": ["none", "arxiv_api", "inspire_api", "doi_resolve", "human_audit"],
  "default": "none"
}
```

### Patch 7: Include all schema files in the review bundle
**File**: Review process / documentation
**Change**: The next review iteration MUST include all `*.schema.json` files referenced by the OpenRPC document. Without them, contract alignment cannot be verified by external reviewers. At minimum: `idea_node_v1.schema.json`, `idea_card_v1.schema.json`, `budget_snapshot_v1.schema.json`, `idempotency_meta_v1.schema.json`, `eval_result_v1.schema.json`.
