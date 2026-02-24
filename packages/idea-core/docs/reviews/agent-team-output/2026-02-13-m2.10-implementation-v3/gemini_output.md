VERDICT: NOT_READY

## Blockers
- **Method Omission**: `node.list` and `node.get` are defined in the OpenRPC contract but missing from the `handlers` dispatch map in `IdeaCoreService.handle`. This creates a "read-blind" API where clients can initialize a campaign but have no way to retrieve the `node_id`s of the generated seed nodes, effectively blocking the execution of `eval.run`, `rank.compute`, or `node.promote`.
- **Discovery Gap**: The `campaign.init` result (as implemented) does not return the created `node_ids`. Without `node.list`, there is zero path for an RPC client to discover its own state without bypassing the API and reading the raw filesystem logs.

## Non-blocking
- **Cross-File Atomicity**: The engine uses atomic file replacements (tmp + rename), but lacks a transaction log across multiple files (e.g., if a crash occurs between writing a scorecards artifact and updating the `campaign.json` manifest). This is acceptable for a minimal M2 baseline but should be hardened for production.
- **Incomplete Contract Coverage**: Methods like `campaign.topup`, `pause`, `resume`, and `complete` are missing. While not strictly required for a "minimal" loop, they are part of the defined contract.
- **Pagination Stub**: The `node.list` implementation (once added) will likely need a real cursor implementation; the current store structure (one large JSON for nodes) will scale poorly if campaign sizes exceed a few thousand nodes.

## Real-research fit
- **Reduction Logic**: The integration of `reduction_audit` as a hard gate for promotion is excellent. Requiring a passed toy-check and abstraction registry match for "Technique Transplant" nodes is a critical guardrail against physical hallucinations in theoretical HEP.
- **Grounding & Formalism Gates**: Enforcing these at the promotion level ensures that only ideas with verified literature provenance and a concrete mathematical implementation plan (via `candidate_formalisms`) reach the handoff stage.

## Robustness & safety
- **Idempotency Semantics**: The implementation of RFC 8785 (JCS) and the proactive injection of default values before hashing is a high-water mark for adapter safety. It prevents fragile "false conflicts" often caused by varying JSON serializations.
- **Mutation Locking**: Using `fcntl.flock` around the store operations provides safe concurrency protection for multi-adapter deployments hitting the same local `data_dir`.

## Specific patch suggestions

### File: `src/idea_core/engine/service.py`

Implement the missing discovery methods and add them to the `handle` dispatch map:

```python
    # Add to IdeaCoreService class
    def node_get(self, params: dict[str, Any]) -> dict[str, Any]:
        campaign = self._load_campaign_or_error(params["campaign_id"])
        nodes = self.store.load_nodes(campaign["campaign_id"])
        node_id = params["node_id"]
        if node_id not in nodes:
            data = {"reason": "node_not_found", "campaign_id": campaign["campaign_id"], "node_id": node_id}
            self.catalog.validate_error_data(data)
            raise RpcError(code=-32004, message="node_not_found", data=data)
        return nodes[node_id]

    def node_list(self, params: dict[str, Any]) -> dict[str, Any]:
        campaign = self._load_campaign_or_error(params["campaign_id"])
        all_nodes = self.store.load_nodes(campaign["campaign_id"])
        filtered = self._filter_nodes(all_nodes, params.get("filter"))
        limit = params.get("limit", 50)
        # Minimal baseline pagination
        return {
            "nodes": filtered[:limit],
            "total_count": len(filtered),
            "next_cursor": None
        }

    # Update dispatch map in handle()
    handlers = {
        "campaign.init": self.campaign_init,
        "campaign.status": self.campaign_status,
        "eval.run": self.eval_run,
        "rank.compute": self.rank_compute,
        "node.promote": self.node_promote,
        "node.list": self.node_list,  # Add
        "node.get": self.node_get,    # Add
    }
```

### File: `src/idea_core/engine/store.py`

To improve durability, consider writing the idempotency record *before* the main state change, or use a single state-file update if performance allows:

```python
    # Suggestion: Move idempotency save before campaign/nodes save 
    # OR wrap both in a single directory-level fsync to reduce partial-write window.
```
