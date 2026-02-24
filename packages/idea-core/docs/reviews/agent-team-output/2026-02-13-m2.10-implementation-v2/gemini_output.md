VERDICT: NOT_READY

## Blockers
- **Registry Merging Failure**: `campaign.init` currently overrides the `formalism_registry` and `abstract_problem_registry` if provided, instead of merging them. The OpenRPC contract explicitly states: "If provided, entries are merged (caller entries take precedence on formalism_id collision)".
- **Missing Duplicate Check**: The engine does not reject inputs with duplicate `abstract_problem_type` values in the `abstract_problem_registry` during `campaign.init`, violating a "MUST" requirement in the OpenRPC specification.
- **Incomplete Idempotency Contract**: The `IdeaCoreService` does not apply default-value filling before computing the `payload_hash`. This will lead to `idempotency_key_conflict` errors for semantically identical requests (e.g., one omitting `limit: 50` and another explicitly including it).

## Non-blocking
- **JCS Compliance**: `payload_hash` uses `json.dumps(sort_keys=True)` with separators, which is a common "canonical" approximation but not strictly RFC 8785 (JCS). This is acceptable for a baseline but may cause cross-language drift on float formatting.
- **Elo Implementation**: The Elo ranking is a simple deterministic stub. This is consistent with non-goals but should be expanded when moving beyond the baseline.
- **Persistence Atomicity**: The service updates multiple files (`nodes_latest.json`, `campaign.json`, `idempotency_store.json`) sequentially. A crash between these writes could leave the engine in an inconsistent state (e.g., node updated but budget not consumed).

## Real-research fit
- **Formalism/Problem Registries**: The modular registry approach is excellent for HEP. It allows specific formalisms (like `hep-toy` or `lattice-qcd`) to be injected without core engine changes.
- **Evidence-First Gates**: The `node.promote` method correctly enforces grounding and reduction audits, which are critical for preventing "hallucinated" physics results from being passed to more expensive formal solvers (C2).
- **Campaign Budgeting**: The five-dimension budget (tokens, cost, clock, steps, nodes) provides the necessary controls for high-throughput exploration vs. deep refinement.

## Robustness & safety
- **Idempotency Conflict Details**: Correctly includes `stored_payload_hash` and `payload_hash` in conflict errors, which is vital for debugging agent-side retries.
- **Drift-Guard**: The validation toolchain's `drift-guard` effectively prevents the OpenRPC and JSON schemas from diverging by forcing complex schemas into separate files.
- **Reduction Logic**: The `derive_reduction_status` correctly handles the "partial" state when toy checks are skipped or verification is pending, preventing premature promotion of unverified reductions.

## Specific patch suggestions

### 1. File: `src/idea_core/engine/service.py`
**Change**: Implement registry merging and duplicate checks in `campaign_init`.

```python
# Insert after _seed_node method
def _merge_registries(self, defaults: dict, overrides: dict, key: str) -> dict:
    merged = {entry[key]: entry for entry in defaults["entries"]}
    for entry in overrides.get("entries", []):
        merged[entry[key]] = entry
    return {"entries": list(merged.values())}

# Update campaign_init logic
def campaign_init(self, params: dict[str, Any]) -> dict[str, Any]:
    # ... existing idempotency check ...
    
    # 1. Define Defaults (should ideally be moved to a config file/constant)
    default_formalisms = {"entries": [{"formalism_id": "hep/toy", ...}]}
    default_problems = {"entries": [{"abstract_problem_type": "optimization", ...}]}

    # 2. Implement Merging
    formalism_registry = self._merge_registries(default_formalisms, params.get("formalism_registry", {}), "formalism_id")
    
    user_problems = params.get("abstract_problem_registry", {}).get("entries", [])
    problem_types = [p["abstract_problem_type"] for p in user_problems]
    if len(problem_types) != len(set(problem_types)):
        raise self._schema_error("duplicate abstract_problem_type in registry")
        
    abstract_problem_registry = self._merge_registries(default_problems, params.get("abstract_problem_registry", {}), "abstract_problem_type")
    
    # ... rest of campaign_init ...
```

### 2. File: `src/idea_core/engine/service.py`
**Change**: Apply defaults before hashing in `_hash_without_idempotency`.

```python
def _hash_without_idempotency(self, method: str, params: dict[str, Any]) -> str:
    # 1. Clone params to avoid side-effects
    work_params = copy.deepcopy(params)
    if "idempotency_key" in work_params:
        del work_params["idempotency_key"]
        
    # 2. Fill defaults from catalog for the specific method
    method_contract = self.catalog.methods.get(method)
    if method_contract:
        for p in method_contract.params:
            name = p["name"]
            if name not in work_params and "default" in p.get("schema", {}):
                work_params[name] = p["schema"]["default"]
                
    return payload_hash(work_params)
```

### 3. File: `src/idea_core/engine/service.py`
**Change**: Re-validate `IdeaCard` schema during `node.promote`.

```python
def node_promote(self, params: dict[str, Any]) -> dict[str, Any]:
    # ... after loading node ...
    idea_card = node.get("idea_card")
    if idea_card is None:
        # ... raise existing error ...
    
    # Explicit schema re-validation for the IdeaCard
    try:
        self.catalog._validate_with_schema(
            self.catalog._load_json(self.catalog.contract_dir / "idea_card_v1.schema.json"),
            idea_card,
            base_uri="internal://promotion/idea_card"
        )
    except ContractRuntimeError as exc:
        raise self._schema_error(f"idea_card_schema_invalid: {exc}")
```
