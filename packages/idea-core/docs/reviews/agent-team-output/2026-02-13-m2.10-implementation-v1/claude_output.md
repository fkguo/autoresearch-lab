VERDICT: NOT_READY

## Blockers

### B1. No vendored contract snapshot provided for audit — contract alignment is unverifiable

The review bundle references `contracts/idea-generator-snapshot/schemas/*` but none of the actual OpenRPC or JSON Schema files are included in the packet. Without seeing the normative contract, I cannot verify that `service.py` handlers actually conform to the declared method signatures, required fields, error codes, or result schemas. The entire "Contract Alignment Checklist" in §4 is self-attested but unauditable from this packet.

**Required action:** Include (or link) the vendored OpenRPC document and all `$ref`'d sibling schemas so the review can cross-check field names, types, enums, and MUST semantics.

### B2. No source code for `service.py`, `store.py`, `server.py`, or `validate.py` included

The diff stat says 6,263 lines were added across two commits, but the review bundle contains zero lines of implementation code. A design review that says "please review strictly against OpenRPC/schema MUST semantics" while providing no code to review is structurally incomplete.

**Required action:** Include at minimum the full text of:
- `src/idea_core/engine/service.py`
- `src/idea_core/engine/store.py`
- `src/idea_core/rpc/server.py`
- `src/idea_core/contracts/validate.py`
- All test files referenced in §4

### B3. Idempotency store durability and concurrency model unspecified

The bundle says "side-effecting methods store first response and replay on duplicate key+payload" but does not specify:
- Is the store in-memory only? (If so, replay is lost on restart — unacceptable for a system that claims "auditable replay behavior.")
- What happens under concurrent requests with the same idempotency key? (Race between check-and-store?)
- Is `payload_hash` computed over canonical JSON or raw bytes? (Canonicalization matters for conflict detection correctness.)

**Required action:** Specify the durability guarantee (in-memory → WAL-backed SQLite → pluggable), the concurrency model (single-threaded event loop? lock? optimistic CAS?), and the hash canonicalization algorithm. If in-memory is intentional for this phase, add an explicit `# TODO` with the invariant that must hold when swapped, and a test that exercises restart-replay.

### B4. `rank.compute` Elo implementation absent — "ranking" without a ranking algorithm

The bundle says `rank.compute` is implemented and echoes `effective_dimensions`, but there is no description of how rankings are actually computed. Elo requires pairwise comparisons — what generates the comparisons? What is the initial rating? What is the K-factor? If this is stubbed, the result schema's `ranked_nodes` array is fabricated data, which violates evidence-first safety. If it's real, the algorithm must be specified and tested for determinism (given `rng_seed_used`).

**Required action:** Either (a) explicitly label `rank.compute` as stub-only with a `ranking_method: "stub_identity"` field in the result so downstream consumers know not to trust it, or (b) include the ranking algorithm implementation and its determinism test.

### B5. No JSON-RPC transport-level error handling or batch semantics

The bundle mentions `rpc/server.py` implements stdio JSON-RPC but provides no detail on:
- Parse error (`-32700`), invalid request (`-32600`), method not found (`-32601`), invalid params (`-32602`) — are these implemented per JSON-RPC 2.0 spec?
- Batch request support (JSON-RPC 2.0 §6)?
- Notification (no `id`) handling?

For a "contract-first" system, the transport layer is part of the contract.

**Required action:** Confirm JSON-RPC 2.0 §4–§6 compliance or explicitly document deviations. Add at least one test for each transport-level error code.

---

## Non-blocking

### N1. Drift-guard relaxation for scalar arrays needs a principled rule

The fix log says drift-guard was relaxed to "allow scalar arrays in OpenRPC params while still rejecting inline object/complex compositions." This is a reasonable pragmatic fix, but the rule should be made explicit and documented:

```python
# drift_guard.py — allowed inline schemas in OpenRPC params:
# - {"type": "string"}, {"type": "integer"}, etc.
# - {"type": "array", "items": {"type": <scalar>}}
# Everything else MUST use $ref.
```

Without this, the next contributor will either re-tighten it (breaking builds) or further relax it (defeating the purpose).

### N2. `sync_contracts_snapshot.sh` — no integrity verification

The sync script copies contracts from an upstream source but (based on the bundle) does not verify a checksum or git commit hash of the source. This means a corrupted or tampered upstream could silently propagate. Recommend:

```bash
# sync_contracts_snapshot.sh
EXPECTED_SHA256="<hash>"
UPSTREAM_COMMIT="<commit>"
# After copy:
find contracts/idea-generator-snapshot -type f | sort | xargs sha256sum | sha256sum -c <<< "$EXPECTED_SHA256  -"
```

### N3. Test count seems low for the claimed scope

10 tests covering 6 RPC methods + idempotency + replay + conflict + ranking + reduction + schema validation + drift guard + `$ref` closure is roughly 1.5 tests per feature. The required tests listed in §4 are well-chosen but represent a minimum. Missing coverage includes:
- Happy-path round-trip for each RPC method
- `campaign.status` on nonexistent campaign
- `eval.run` with invalid `node_ids` references
- `node.promote` with each individual gate failing in isolation
- Schema validation rejecting malformed requests (fuzz-adjacent)

### N4. No logging, tracing, or observability hooks

For a system that aims for "auditable replay," there is no mention of structured logging. At minimum, each RPC call should emit a structured log line with `{method, idempotency_key, campaign_id, timestamp, outcome}`. This is straightforward to add later but should be in the design now.

### N5. `formalism_registry` is referenced but not defined

`node.promote` checks "formalism registry membership" but the registry's schema, population mechanism, and extensibility model are not described. Is it a static list? A plugin? A contract artifact? This needs at least a stub interface definition.

---

## Real-research fit

### R1. HEP domain grounding is structurally present but untestable without contracts

The `grounding_audit`, `reduction_audit`, and `abstract_problem` registry concepts are exactly the right abstractions for evidence-first HEP research. The gate structure in `node.promote` (grounding → reduction → formalism) mirrors the actual workflow of going from a speculative idea to a publishable calculation. However, without seeing the actual schema definitions, I cannot verify that the fields capture enough physics metadata (e.g., symmetry group, energy scale, loop order, relevant PDG particles).

### R2. `effective_dimensions` in `rank.compute` is a good abstraction

This maps well to the idea that HEP research ideas live in a space parameterized by {model_class, observable, energy_regime, loop_order, ...}. The requirement to echo this in ranking results enables downstream analysis of coverage gaps. Ensure the schema allows both categorical and continuous dimensions.

### R3. Missing: connection to calculation reproducibility

The idea generator should eventually produce artifacts that feed into `hep-calc` or equivalent. The current design has `scorecards_artifact_ref` and `ranking_artifact_ref` but no `calculation_spec_ref` or `phenomenology_target_ref`. These should be planned even if not implemented in this phase.

### R4. Extension path to broader theoretical physics

The formalism registry approach is correct for extensibility — new domains (cosmology, condensed matter) register their formalisms and reduction rules. The `abstract_problem` concept generalizes well. No structural barriers to extension are visible, though the implementation details are unavailable for verification.

---

## Robustness & safety

### S1. Hallucination mitigation: `node.promote` gates are necessary but insufficient

The grounding and reduction gates correctly prevent ungrounded ideas from advancing. However, the system currently has no mechanism to verify that the *content* of an idea card is physically meaningful — only that the required fields are present. A node with `idea_card.mechanism = "tachyonic gluon condensate"` would pass all structural gates. Consider:
- Adding a `physics_consistency_check` gate (even if stubbed) that flags obviously non-physical claims
- Requiring `literature_refs` with verifiable identifiers (arXiv IDs, INSPIRE keys) in the grounding audit

### S2. Provenance chain is incomplete

The idempotency key + payload hash provides request-level provenance, but there is no chain linking:
- Which LLM call generated a node's content
- What prompt/context was used
- What model version produced it
- What evidence corpus was consulted

This is critical for evidence-first safety. Recommend adding a `provenance` block to the node schema:

```json
{
  "provenance": {
    "generator_model": "string",
    "generator_version": "string", 
    "prompt_hash": "string",
    "evidence_corpus_snapshot": "string",
    "timestamp_utc": "string"
  }
}
```

### S3. No novelty checking mechanism

The design has no deduplication of *ideas* (as opposed to *requests*). Two nodes with semantically identical physics content but different idempotency keys would both proceed through the pipeline. At minimum, add a `semantic_similarity_check` hook point in `campaign.init` or `eval.run`.

### S4. Replay correctness under schema evolution

If the contract schema evolves between a first request and a replayed response, the stored response may not validate against the new schema. The idempotency store needs a `contract_version` field, and replay should fail-fast if the stored version doesn't match the current contract.

---

## Specific patch suggestions

### P1. `src/idea_core/engine/store.py` — Add contract version to idempotency records

```python
# CURRENT (inferred):
class IdempotencyRecord:
    key: str
    payload_hash: str
    response: dict

# PROPOSED:
class IdempotencyRecord:
    key: str
    payload_hash: str
    response: dict
    contract_version: str  # from OpenRPC info.version
    created_at: str        # ISO 8601 UTC
    
    def is_compatible(self, current_version: str) -> bool:
        """Fail-fast if stored response was created under a different contract."""
        return self.contract_version == current_version
```

### P2. `src/idea_core/engine/service.py` — Label stub ranking explicitly

```python
# In rank.compute handler, add to result:
result["ranking_metadata"] = {
    "method": "stub_identity",  # or "elo_v1" when real
    "deterministic": True,
    "warning": "Stub ranking: order reflects insertion order, not quality assessment"
}
```

### P3. `src/idea_core/contracts/validate.py` — Document drift-guard scalar-array exception

```python
# Add after the drift-guard check function:
DRIFT_GUARD_ALLOWED_INLINE = """
Drift-guard allows these inline schemas in OpenRPC method params/results:
  - Scalar types: {"type": "string"}, {"type": "integer"}, {"type": "number"}, {"type": "boolean"}
  - Scalar arrays: {"type": "array", "items": {"type": <scalar>}}
All other schemas (objects, anyOf/oneOf/allOf, nested arrays, $ref compositions)
MUST use $ref to a named schema in the sibling schemas directory.
"""
```

### P4. `scripts/sync_contracts_snapshot.sh` — Add integrity check

```bash
# After the copy step, add:
SNAPSHOT_DIR="contracts/idea-generator-snapshot"
MANIFEST="${SNAPSHOT_DIR}/.manifest.sha256"

# Generate manifest
find "$SNAPSHOT_DIR" -name '*.json' -type f | sort | xargs sha256sum > "$MANIFEST"

# On subsequent syncs, verify before overwrite:
if [ -f "$MANIFEST" ]; then
    sha256sum -c "$MANIFEST" --quiet || {
        echo "ERROR: Contract snapshot integrity check failed. Aborting sync."
        exit 1
    }
fi
```

### P5. `tests/` — Add minimum transport-level JSON-RPC tests

```python
# tests/rpc/test_jsonrpc_transport.py (new file)

def test_parse_error_returns_minus_32700(rpc_client):
    """Invalid JSON must return parse error per JSON-RPC 2.0 §5."""
    response = rpc_client.send_raw(b"not json{{{")
    assert response["error"]["code"] == -32700

def test_method_not_found_returns_minus_32601(rpc_client):
    response = rpc_client.call("nonexistent.method", {})
    assert response["error"]["code"] == -32601

def test_invalid_params_returns_minus_32602(rpc_client):
    response = rpc_client.call("campaign.init", {"wrong_field": True})
    assert response["error"]["code"] == -32602

def test_notification_no_response(rpc_client):
    """JSON-RPC notification (no id) must not produce a response."""
    response = rpc_client.send_raw(json.dumps({
        "jsonrpc": "2.0", "method": "campaign.status", "params": {}
    }).encode())
    assert response is None
```

### P6. `src/idea_core/engine/service.py` — Add provenance stub to node schema

```python
# In the node creation path (campaign.init or wherever nodes are instantiated):
node["provenance"] = {
    "generator_model": None,       # populated by upstream orchestrator
    "generator_version": None,
    "prompt_hash": None,
    "evidence_corpus_snapshot": None,
    "created_at": datetime.utcnow().isoformat() + "Z",
    "contract_version": self._contract_version,
}
```

### P7. `Makefile` — Add `make ci` target that enforces test count floor

```makefile
ci: validate
	@echo "[ci] Running tests..."
	@pytest --tb=short -q 2>&1 | tee .test-output.tmp
	@PASS_COUNT=$$(grep -oP '\d+ passed' .test-output.tmp | grep -oP '\d+'); \
	if [ "$$PASS_COUNT" -lt 10 ]; then \
		echo "ERROR: Expected >= 10 passing tests, got $$PASS_COUNT"; exit 1; \
	fi
	@rm -f .test-output.tmp
	@echo "[ci] OK"
```
