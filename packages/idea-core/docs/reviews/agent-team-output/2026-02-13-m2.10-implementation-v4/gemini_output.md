VERDICT: READY

## Blockers
None. The implementation is contract-aligned, follows the strict idempotency semantics (including JCS canonicalization and default filling), and enforces the promotion and ranking gates correctly. The out-of-scope methods (`search.step`, etc.) are correctly identified and do not impede the baseline functionality.

## Non-blocking
- **Offset Pagination:** `node.list` uses simple integer offsets as cursors. While nodes are append-only, if the engine ever supports prepending or re-ordering, this will skip items. For a baseline, this is acceptable, but a UUID-based or timestamp-lexicographical cursor is preferred for long-term robustness.
- **Merge Semantics:** The `_merge_registry_entries` logic ensures registries are never empty by preserving defaults, but it doesn't allow a caller to explicitly *remove* a default formalism. This is safer for discovery agents but may eventually need a "clear_defaults" flag.
- **Completeness:** The `campaign.complete` and `campaign.pause/resume` methods are in the OpenRPC contract but missing from the `handlers` dispatch. While "out of scope" for this milestone, adding them as no-op stubs would prevent `method_not_found` crashes if the orchestrator tries to clean up a campaign.

## Real-research fit
- **Grounding Gate:** Correctly prioritizes literature-based verification (`grounding_audit`) as a hard gate for promotion, which is critical in HEP to avoid rediscovering "folklore" (unwritten/well-known results).
- **Formalism/Problem Registries:** The implementation of these registries as mutable campaign state allows the system to bridge from HEP to other fields (e.g., lattice QCD to Condensed Matter) simply by providing a different `formalism_registry` during `init`.
- **Artifact Provenance:** The `reduction_audit` structure captures `auditor_origin`, ensuring that if a LLM performs the reduction, the provenance is baked into the promotion-ready artifact.

## Robustness & safety
- **Idempotency Hashing:** Using `jcs` (RFC 8785) for the payload hash is excellent; it ensures that semantically identical JSON objects produce the same hash regardless of key order or whitespace.
- **Atomic Persistence:** The use of `.tmp` + `replace` + `fsync` in `EngineStore` provides strong durability guarantees for campaign state.
- **Concurrent Access:** File-based locking via `fcntl.flock` provides safe per-campaign isolation for local execution.

## Specific patch suggestions

### 1. Register stubs for remaining campaign lifecycle methods
In `src/idea_core/engine/service.py`, add stubs to the `handlers` map to satisfy the OpenRPC contract and prevent unhandled method errors during orchestrator teardown.

```python
# FILE: src/idea_core/engine/service.py
# In handle() method, add stubs:
        handlers = {
            "campaign.init": self.campaign_init,
            "campaign.status": self.campaign_status,
            "campaign.pause": self._mutation_noop,
            "campaign.resume": self._mutation_noop,
            "campaign.complete": self._mutation_noop,
            "campaign.topup": self._mutation_noop,
            # ... existing handlers ...
        }

# Define the helper:
    def _mutation_noop(self, params: dict[str, Any]) -> dict[str, Any]:
        campaign = self._load_campaign_or_error(params["campaign_id"])
        idempotency_key = params.get("idempotency_key", "noop")
        p_hash = "sha256:noop"
        return {
            "campaign_id": campaign["campaign_id"],
            "status": campaign["status"],
            "budget_snapshot": self._budget_snapshot(campaign),
            "idempotency": {"idempotency_key": idempotency_key, "is_replay": False, "payload_hash": p_hash}
        }
```

### 2. Strengthen Handoff Artifact Self-containment
In `node_promote`, include the selected formalism's metadata in the handoff artifact so downstream agents don't have to query the engine for the `c2_schema_ref`.

```python
# FILE: src/idea_core/engine/service.py
# In node_promote(), find the selected formalism metadata:
            registry_entries = campaign.get("formalism_registry", {}).get("entries", [])
            selected_formalisms = [
                e for e in registry_entries 
                if e["formalism_id"] in node["idea_card"]["candidate_formalisms"]
            ]
            
            handoff_payload = {
                # ... existing fields ...
                "formalism_check": {
                    "status": "pass",
                    "effective_formalisms": selected_formalisms, # Add this
                },
            }
```

### 3. Cursor Validation
Add a small check to `node_list` to ensure the cursor is actually an integer, providing a better error than a 500.

```python
# FILE: src/idea_core/engine/service.py
# In node_list()
        try:
            start = int(raw_cursor) if raw_cursor else 0
        except ValueError:
             raise self._schema_error("cursor must be an integer offset")
```
