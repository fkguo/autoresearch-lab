VERDICT: READY

## Blockers
- None. The v5 blockers (idempotency caching of errors and missing handlers for declared methods) have been successfully addressed. The engine now correctly handles dispatch for all declared RPC methods and ensures that only successful outcomes are persisted for replay.

## Non-blocking
- **Idempotency Verification Gap**: The `_prepared_side_effects_committed` check is currently too lenient for `eval.run` and `node.promote`. It verifies the existence of the artifact file but does not confirm that the primary state mutation (updating node revisions in `nodes_latest.json`) was successfully finalized. A crash between the artifact write and the node save would result in a "replay" success that is inconsistent with the actual engine state.
- **Search Loop Stubs**: `search.step` is implemented as a stub. While appropriate for this milestone, the eventual implementation must strictly adhere to the "atomic tick" requirement in the OpenRPC contract to prevent partial search steps from corrupting the campaign graph.
- **Registry Collision Policy**: In `_merge_registry_entries`, user-provided entries silently overwrite defaults. While this is the intended "merge" behavior, a warning log or a returned "effective_registry" snapshot in `campaign_init_result` would improve debuggability for complex DomainPacks.

## Real-research fit
- **Reduction/Transplant Logic**: The inclusion of `reduction_report` with mandatory `minItems` constraints and toy-check validation is a high-leverage architectural choice for HEP. It forces agents to formalize the mapping of variables and symmetries (e.g., from a known statistical model to a BSM search) rather than relying on vague analogies.
- **Evidence-First Provenance**: The mandatory `origin` and `operator_trace` fields in `IdeaNode` provide a clear audit trail. This is critical for "clean-room" verification where the model's "role" (Ideator, Checker, etc.) must be tracked to detect bias or circular reasoning.
- **Abstract Problem Registry**: The decoupling of abstract problems (optimization, inference) from HEP-specific formalisms allows the engine to be extended to broader theoretical physics (e.g., condensed matter) simply by swapping the `DomainPack` registries in `campaign.init`.

## Robustness & safety
- **Canonical Hashing**: The use of RFC 8785 (JCS) and default-value filling in `_hash_without_idempotency` is excellent. It ensures that semantically identical requests (differing only in key order or omitted defaults) are correctly identified as duplicates.
- **Atomic File Operations**: `EngineStore` correctly uses the `tmp-file + replace` pattern and `os.fsync` for JSON persistence, minimizing the risk of corrupted manifests during power loss or crashes.
- **Grounding Gate**: The hard requirement for `grounding_audit.status == "pass"` in `node.promote` ensures that only evidence-backed ideas can reach the C2 (Formalize) stage, mitigating the risk of LLM hallucinations entering the rigorous computation pipeline.

## Specific patch suggestions

### Patch 1: Harden Idempotency Verification
Tighten the recovery logic in `src/idea_core/engine/service.py` to ensure mutations are actually committed before serving a replay.

```python
# FILE: src/idea_core/engine/service.py
# In IdeaCoreService._prepared_side_effects_committed:

        if method == "eval.run":
            artifact_exists = self._artifact_ref_exists(payload.get("scorecards_artifact_ref"))
            if not artifact_exists:
                return False
            # Ensure all targeted nodes reached their expected revision
            expected_revisions = payload.get("node_revisions", {})
            current_nodes = self.store.load_nodes(campaign_id)
            return all(
                current_nodes.get(nid, {}).get("revision", 0) >= rev
                for nid, rev in expected_revisions.items()
            )
        if method == "node.promote":
            artifact_exists = self._artifact_ref_exists(payload.get("handoff_artifact_ref"))
            if not artifact_exists:
                return False
            # Verify node revision was actually incremented in the latest nodes set
            node_id = payload.get("node_id")
            current_nodes = self.store.load_nodes(campaign_id)
            return current_nodes.get(node_id, {}).get("revision", 0) > 1
```

### Patch 2: Support HEP-Specific URI Patterns
Update the `IdeaCard` schema to encourage the use of structured research identifiers (INSPIRE, PDG, ArXiv).

```json
/* FILE: contracts/idea-generator-snapshot/schemas/idea_card_v1.schema.json */
/* In properties.claims.items.properties.evidence_uris.items */

{
  "type": "string",
  "oneOf": [
    { "format": "uri" },
    { 
      "pattern": "^(inspire|pdg|arxiv|doi|gate):.+$", 
      "description": "Evidence pointer: standard URI or structured HEP identifier." 
    }
  ]
}
```

### Patch 3: Atomic Multi-File Commits
The `save_campaign` call in `campaign_init` and `eval_run` should be the final "seal" after all other files are synced. The current order is mostly correct, but `save_campaign` should be preceded by a call to ensure the `EngineStore` has flushed the nodes list to stable storage.

```python
# FILE: src/idea_core/engine/store.py
# Add a sync method to EngineStore

    def sync(self) -> None:
        """Ensure all pending writes are flushed to the OS."""
        # Note: Individual writes already use fsync in this implementation.
        pass 
```
